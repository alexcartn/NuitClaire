"""GET /api/targets, /api/messier, /api/search, /api/search/suggest,
/api/targets/{designation} -- mêmes lignes que les catalogues 'Cibles
faisables'/'Catalogue Messier' de app.py (via `api.deps.feasible_rows`, qui
appelle les memes fonctions partagees), plus une fiche detail qui assemble
en un seul appel ce qui, cote Streamlit, est reparti entre
`feasible_rows`/`_row_from_search` (liste) et `_target_detail_dialog`
(modale) : altitude series, temps de pose indicatif, resume Wikipedia."""
from fastapi import APIRouter, HTTPException, Query

import progress as progress_store
import sessions as sessions_store
import settings as settings_store
from api.deps import cached_wiki_summary, current_night, feasible_rows, get_horizon, get_site, \
    site_from_settings
from api.schemas import TargetDetailOut, TargetRowOut, TargetSuggestionOut
from api.translate import row_to_target_out
from astro import fits_in_fov
from catalog import find_target, load_messier, search_prefix
from imagery import dss_image_url
from rows import day_frame, filter_label, row_from_search
from scoring import discovery_sort_key, recommended_exposure_minutes, target_altitude_series
from wiki import wiki_title_candidates

router = APIRouter()


@router.get("/api/targets", response_model=list[TargetRowOut])
def list_targets(types: list[str] | None = Query(default=None)) -> list[dict]:
    s = settings_store.load()
    site, window_mode = site_from_settings(s), s["window_mode"]
    horizon = get_horizon()
    sel, df, _ = current_night(site)
    if sel is None:
        return []
    rows = feasible_rows(site, sel, horizon, window_mode, "targets", s["view_window"])
    # Meme tri que la galerie Streamlit (app.py) : Messier pas encore
    # captures d'abord, puis cadrages simples, puis heures disponibles.
    # `feasible_rows` rend l'ordre du catalogue (NGC0040, IC0010, NGC0103...),
    # ou les Messier manquants tombaient aux positions 9, 10, 11, 22, 25, 46...
    # L'appli mobile n'en affiche que 24 avant « Voir N cibles de plus » :
    # le classement que l'ecran annonce dans son sous-titre etait donc
    # invisible la ou il sert, alors que `discovery_sort_key` existait et
    # etait deja testee.
    captured = set(progress_store.load()["messier_captured"])
    rows = sorted(rows, key=lambda r: discovery_sort_key(r, captured))
    if types:
        rows = [r for r in rows if r["Type"] in types]
    return [row_to_target_out(r) for r in rows]


def _static_messier_row(tgt: dict) -> dict:
    """Ligne Messier sans nuit calculee : ce que le catalogue sait de l'objet,
    et rien sur ce soir (creneau et angles absents, `feasibleTonight` a None)."""
    return {
        "designation": tgt["name"], "isMessier": True, "messierId": tgt["messier"],
        "commonName": tgt.get("common_name", ""), "ngc": tgt.get("ngc_name"),
        "type": tgt.get("type_fr", ""), "typeCode": tgt.get("type", ""),
        "filter": filter_label(tgt.get("filter", "sans")),
        "start": None, "end": None, "hours": 0, "altMaxDeg": 0.0, "moonSepDeg": 0.0,
        "cadrage": fits_in_fov(tgt["w"], tgt["h"]) if tgt.get("w") and tgt.get("h") else "taille inconnue",
        "imageUrl": dss_image_url(tgt["ra"], tgt["dec"], tgt.get("w"), tgt.get("h")),
        "ra": tgt["ra"], "dec": tgt["dec"], "mag": tgt.get("mag"),
        "sizeW": tgt.get("w"), "sizeH": tgt.get("h"), "reasons": [], "feasibleTonight": None,
    }


@router.get("/api/messier", response_model=list[TargetRowOut])
def list_messier(onlyFeasible: bool = False) -> list[dict]:
    s = settings_store.load()
    site, horizon = site_from_settings(s), get_horizon()
    try:
        sel, df, _ = current_night(site)
    except Exception:
        # Meteo injoignable (Open-Meteo en panne, pas de reseau cote
        # serveur) : les 110 objets sont fixes, seule la faisabilite du soir
        # depend de la prevision. L'ecran garde donc sa liste et sa
        # progression, avec une faisabilite inconnue (None) plutot qu'une
        # erreur qui vidait tout l'ecran.
        sel = None
    if sel is None:
        return [] if onlyFeasible else [_static_messier_row(tgt) for tgt in load_messier()]
    # Respecte desormais le mode de fenetre comme le catalogue "targets"
    # (voir `api.deps.feasible_rows`) : coherent avec la liste de cibles et
    # le graphe d'altitude de la fiche detail plutot qu'une exception.
    rows = feasible_rows(site, sel, horizon, s["window_mode"], "messier", s["view_window"])
    if onlyFeasible:
        rows = [r for r in rows if r["Faisable ce soir"] == "Oui"]
    return [row_to_target_out(r) for r in rows]


@router.get("/api/search", response_model=list[TargetRowOut])
def search(q: str = Query(min_length=1)) -> list[dict]:
    site, horizon = get_site(), get_horizon()
    sel, df, _ = current_night(site)
    if sel is None:
        return []
    found = find_target(q)
    if not found:
        return []
    return [row_to_target_out(row_from_search(found, df, horizon, site))]


@router.get("/api/search/suggest", response_model=list[TargetSuggestionOut])
def search_suggest(q: str = Query(min_length=1), limit: int = Query(default=8, ge=1, le=20)) -> list[dict]:
    """Suggestions par prefixe pendant la frappe -- volontairement legeres
    (pas de fenetre de visibilite/score, qui demanderaient de calculer
    `target_windows` pour chaque candidat a chaque frappe) : juste de quoi
    distinguer les resultats et naviguer vers la fiche detail, qui elle
    calcule tout pour la cible choisie."""
    found = search_prefix(q, limit=limit)
    return [
        {
            "designation": tgt["name"], "isMessier": bool(tgt.get("messier")),
            "messierId": tgt.get("messier"), "commonName": tgt.get("common_name") or "",
            "type": tgt.get("type_fr") or "",
        }
        for tgt in found
    ]


@router.get("/api/targets/{designation}", response_model=TargetDetailOut)
def target_detail(designation: str) -> dict:
    site, horizon = get_site(), get_horizon()
    sel, df, _ = current_night(site)
    if sel is None:
        raise HTTPException(503, "Aucune donnee de nuit disponible pour les prochains jours.")
    target = find_target(designation)
    if not target:
        raise HTTPException(404, f"Aucun objet trouve pour « {designation} ».")

    row = row_from_search(target, df, horizon, site)
    out = row_to_target_out(row)

    series = target_altitude_series(day_frame(df, site), {"ra": row["RA"], "dec": row["Dec"]}, site=site)
    peak_t = series["alt"].idxmax()
    peak = series.loc[peak_t]
    low, high = recommended_exposure_minutes(row.get("TypeCode", ""), row.get("Mag"))
    wiki = cached_wiki_summary(wiki_title_candidates(row))

    # Deux sources de temps de pose, et une seule question pour qui regarde
    # la fiche : combien de temps ai-je pose sur cet objet ? Le journal
    # d'expo libre par cible (progress.py), saisi ici meme, et le temps
    # saisi par sortie dans le journal de session (sessions.py). Le total
    # les additionne -- c'est deja ce que font les statistiques
    # (`stats.exposure_by_target`), et afficher ici un total plus petit
    # donnait deux chiffres contradictoires pour la meme chose. Le detail
    # reste expose, pour savoir d'ou vient quoi.
    exposure_log = progress_store.load()["exposure_log"].get(out["designation"], [])
    free_min = sum(e["minutes"] for e in exposure_log)
    session_min = sessions_store.exposure_totals(sessions_store.load()).get(out["designation"], 0)

    out.update({
        "altitudeSeries": [
            {"time": t.isoformat(), "alt": a["alt"], "az": a["az"], "sector": a["sector"],
             "moonSep": a["moon_sep"]}
            for t, a in series.iterrows()
        ],
        "peakSector": peak["sector"], "peakAz": peak["az"], "peakTime": peak_t.isoformat(),
        "exposureLowMin": low, "exposureHighMin": high,
        "wiki": wiki,
        "exposureLog": exposure_log,
        "exposureFreeMin": free_min,
        "exposureSessionMin": session_min,
        "exposureTotalMin": free_min + session_min,
    })
    return out
