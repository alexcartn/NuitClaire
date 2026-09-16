"""GET /api/targets, /api/messier, /api/search, /api/targets/{designation} --
mêmes lignes que les catalogues 'Cibles faisables'/'Catalogue Messier' de
app.py (via `api.deps.feasible_rows`, qui appelle les memes fonctions
partagees), plus une fiche detail qui assemble en un seul appel ce qui, cote
Streamlit, est reparti entre `feasible_rows`/`_row_from_search` (liste) et
`_target_detail_dialog` (modale) : altitude series, temps de pose indicatif,
resume Wikipedia."""
from fastapi import APIRouter, HTTPException, Query

from api.deps import cached_wiki_summary, current_night, feasible_rows, get_horizon, get_site, \
    get_window_mode
from api.schemas import TargetDetailOut, TargetRowOut
from api.translate import row_to_target_out
from catalog import find_target
from rows import day_frame, row_from_search
from scoring import recommended_exposure_minutes, target_altitude_series
from wiki import wiki_title_candidates

router = APIRouter()


@router.get("/api/targets", response_model=list[TargetRowOut])
def list_targets(types: list[str] | None = Query(default=None)) -> list[dict]:
    site, horizon, window_mode = get_site(), get_horizon(), get_window_mode()
    sel, df, _ = current_night(site)
    if sel is None:
        return []
    rows = feasible_rows(site, sel, horizon, window_mode, "targets")
    if types:
        rows = [r for r in rows if r["Type"] in types]
    return [row_to_target_out(r) for r in rows]


@router.get("/api/messier", response_model=list[TargetRowOut])
def list_messier(onlyFeasible: bool = False) -> list[dict]:
    site, horizon = get_site(), get_horizon()
    sel, df, _ = current_night(site)
    if sel is None:
        return []
    # Messier ignore le mode de fenetre (voir `api.deps.feasible_rows`) --
    # window_mode n'a donc aucune influence ici, comme dans app.py.
    rows = feasible_rows(site, sel, horizon, "complete", "messier")
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

    out.update({
        "altitudeSeries": [
            {"time": t.isoformat(), "alt": a["alt"], "az": a["az"], "sector": a["sector"],
             "moonSep": a["moon_sep"]}
            for t, a in series.iterrows()
        ],
        "peakSector": peak["sector"], "peakAz": peak["az"], "peakTime": peak_t.isoformat(),
        "exposureLowMin": low, "exposureHighMin": high,
        "wiki": wiki,
    })
    return out
