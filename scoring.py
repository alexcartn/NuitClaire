"""Score horaire go/no-go, fenetres de visibilite et resume par cible."""
from itertools import groupby
from zoneinfo import ZoneInfo

import pandas as pd
from config import SCORE_MODEL, SEESTAR, SITE, VIEW_WINDOW
from astro import target_altaz, moon_separation, compass_sector, COMPASS_SECTORS


def _clamp(x, lo=0.0, hi=1.0):
    return max(lo, min(hi, x))


def wind_quality(gust_kmh: float) -> float:
    """Sous-score vent (0 = redhibitoire, 1 = ideal) a partir des seules
    rafales -- rafales > 40 km/h = images poubelle avec le S50. Factorise hors
    de `hourly_score` car reutilise par le graphe 'Vent' de l'appli (couleur
    des points, meme echelle rouge/jaune/vert que le score astro global)."""
    return 1 - _clamp((gust_kmh - 10) / 30)


def _num(value, default=None):
    """Valeur numerique d'une colonne, ou `default` si absente ou NaN."""
    return default if value is None or pd.isna(value) else value


def total_cloud_pct(row: pd.Series) -> float | None:
    """Couverture nuageuse totale (%) : celle d'Open-Meteo quand elle est la,
    sinon recombinee depuis les trois couches (probabilite qu'un point du
    ciel soit degage sous chacune). None quand la prevision ne couvre pas
    l'heure -- le score n'est alors pas calcule plutot qu'invente."""
    total = _num(row.get("cloud_cover"))
    if total is not None:
        return float(total)
    layers = [_num(row.get(k)) for k in ("cloud_cover_low", "cloud_cover_mid", "cloud_cover_high")]
    if all(v is None for v in layers):
        return None
    clear = 1.0
    for v in layers:
        clear *= 1 - _clamp((v or 0) / 100)
    return 100 * (1 - clear)


def sky_factor(row: pd.Series) -> float:
    """Tout ce qui ne depend pas de la cible : nuages, vent, buee, seeing.
    Multiplies entre eux, de 0 (heure perdue) a 1. NaN si la prevision
    nuages manque."""
    if (_num(row.get("precipitation_probability"), 0)) > 50:
        return 0.0
    cloud = total_cloud_pct(row)
    if cloud is None:
        return float("nan")
    m = SCORE_MODEL
    clouds = 1 - _clamp(cloud / m["cloud_opaque_pct"]) ** m["cloud_curve"]
    gust = _num(row.get("wind_gusts_10m"), 0)
    wind = 1 - (1 - m["wind_floor"]) * _clamp((gust - m["wind_calm_kmh"]) / (m["wind_max_kmh"] - m["wind_calm_kmh"]))
    # Ecart T - Td < 1 deg C = buee quasi certaine ; au-dela de 5, aucune.
    spread = _num(row.get("temperature_2m"), 10) - _num(row.get("dew_point_2m"), 0)
    dew = 1 - m["dew_max_penalty"] * (1 - _clamp((spread - 1) / 4))
    s, t = _num(row.get("seeing")), _num(row.get("transparency"))
    seeing = 1.0 if s is None or t is None else \
        1 - m["seeing_max_penalty"] * _clamp(((s - 1) / 7 + (t - 1) / 7) / 2)
    return clouds * wind * dew * seeing


def moon_light(row: pd.Series) -> float:
    """Part du ciel eclaire par la Lune, de 0 (sous l'horizon ou nouvelle) a
    1 (pleine et a plus de `moon_full_alt_deg`)."""
    alt = _num(row.get("moon_alt"), -90)
    if alt <= 0:
        return 0.0
    return _clamp(_num(row.get("moon_illum"), 0) / 100) * _clamp(alt / SCORE_MODEL["moon_full_alt_deg"])


def moon_penalty(light, moon_sep_deg=None, lp_filter: bool = False):
    """Ce que la Lune retire au score, pour une cible donnee ou pour la nuit.

    Sans cible (`moon_sep_deg` None), on prend le cas le plus defavorable --
    cible sans filtre, Lune proche -- : le score de la nuit reste severe, et
    c'est la liste des cibles qui dit ce qui reste faisable. Fonctionne sur
    des scalaires comme sur des colonnes pandas."""
    m = SCORE_MODEL
    k = m["moon_penalty_lp"] if lp_filter else m["moon_penalty_broadband"]
    if moon_sep_deg is None:
        return k * light
    far = ((moon_sep_deg - 30) / 90).clip(0, 1) if hasattr(moon_sep_deg, "clip") \
        else _clamp((moon_sep_deg - 30) / 90)
    return k * light * (1 - m["moon_far_relief"] * far)


def hourly_score(row: pd.Series) -> float:
    """Score astro d'une heure, de 0 (heure perdue) a 1 : facteur ciel
    (nuages, vent, buee, seeing) multiplie par l'obscurite laissee par la
    Lune, dans le cas le plus defavorable (voir `moon_penalty`)."""
    sky = sky_factor(row)
    if pd.isna(sky):
        return float("nan")
    return round(sky * (1 - moon_penalty(moon_light(row))), 3)


def in_observation_window(index: pd.DatetimeIndex, view_mode_key: str,
                           view_window: dict | None = None) -> pd.Series:
    """Masque booleen (indexe comme `index`) : True si l'horodatage tombe
    dans la fenetre d'observation -- toujours True en mode 'nuit complete'
    (`view_mode_key != "habituelle"`). `view_window` (dict `start_hour`/
    `end_hour`, voir `settings.py`) remplace `config.VIEW_WINDOW` quand
    fourni -- horaires personnalisables depuis les reglages plutot que
    fige pour tout le monde. Ne gere pas les fenetres a cheval sur minuit
    (start_hour doit etre < end_hour) : suffisant pour une plage en soiree,
    pas pour "22h-2h".

    Renvoie un masque plutot que de filtrer directement : reutilise par le
    graphe d'altitude (bande "pointable"), qui a besoin de garder tous les
    points affiches pour le contexte visuel plutot que de les retirer --
    contrairement a `view_window_df`, qui filtre pour de bon."""
    if view_mode_key != "habituelle":
        return pd.Series(True, index=index)
    vw = view_window if view_window is not None else VIEW_WINDOW
    start_h, end_h = vw["start_hour"], vw["end_hour"]
    return pd.Series(index.map(lambda t: start_h <= t.hour + t.minute / 60 <= end_h), index=index)


def view_window_df(df: pd.DataFrame, view_mode_key: str, view_window: dict | None = None) -> pd.DataFrame:
    """Filtre `df` sur la fenetre d'observation (voir `in_observation_window`),
    sauf si elle est vide ou que le mode 'nuit complete' est actif -- repli
    rapide qui renvoie `df` tel quel (meme objet, pas de copie) en mode
    complet, plutot que de filtrer sur un masque tout-vrai."""
    if view_mode_key != "habituelle":
        return df
    filtered = df[in_observation_window(df.index, view_mode_key, view_window)]
    return filtered if not filtered.empty else df


def score_frame(df: pd.DataFrame) -> pd.DataFrame:
    """Ajoute le score de la nuit, et ses deux composantes que les cibles
    recombinent a leur facon (voir `target_score`)."""
    df = df.copy()
    df["sky"] = df.apply(sky_factor, axis=1)
    df["moon_light"] = df.apply(moon_light, axis=1)
    df["score"] = df.apply(hourly_score, axis=1)
    return df


def score_label_fr(score: float) -> tuple[int, str]:
    """Score 0-1 -> (pourcentage entier, etiquette francaise)."""
    pct = round(score * 100)
    if score >= 0.70:
        return pct, "Bonnes conditions"
    if score >= 0.40:
        return pct, "Conditions moyennes"
    return pct, "Mauvaises conditions"


def best_window_span(df: pd.DataFrame) -> tuple[pd.Timestamp, pd.Timestamp] | None:
    """Plus longue plage horaire contigue avec score >= 0.6, bornes brutes (start, end).

    `best_window` formate ces bornes en chaine 'HH:MM-HH:MM' pour affichage texte ;
    les composants visuels (barre de crepuscule) ont besoin des Timestamp bruts pour
    se positionner sur un axe, d'ou cette fonction separee.
    """
    flags = [(t, s >= 0.6) for t, s in df["score"].items()]
    runs = []
    for ok, group in groupby(flags, key=lambda x: x[1]):
        group = list(group)
        if ok:
            runs.append((group[0][0], group[-1][0]))
    if not runs:
        return None
    start, last = max(runs, key=lambda r: r[1] - r[0])
    return start, last + pd.Timedelta(hours=1)


def best_window(df: pd.DataFrame) -> str | None:
    """Plus longue plage horaire contigue avec score >= 0.6, formatee 'HH:MM–HH:MM'."""
    span = best_window_span(df)
    if span is None:
        return None
    start, end = span
    return f"{start.strftime('%H:%M')}–{end.strftime('%H:%M')}"


def night_summary(df: pd.DataFrame) -> dict:
    """Resume d'une nuit : score moyen, meilleures heures, heures 'go'."""
    if df.empty:
        return {"score": 0, "go_hours": 0, "best": None, "moon_illum": 0, "best_window": None}
    go = df[df["score"] >= 0.6]
    return {
        "score": round(df["score"].mean(), 2),
        "go_hours": len(go),
        "best": go["score"].idxmax() if not go.empty else None,
        "moon_illum": round(df["moon_illum"].max(), 0),
        "best_window": best_window(df),
    }


CLOUD_TREND_WINDOW_HOURS = 3
CLOUD_TREND_THRESHOLD_PCT = 10.0


def cloud_trend(df: pd.DataFrame, now: pd.Timestamp | None) -> dict | None:
    """Tendance nuages horaire simple : compare la couverture nuageuse totale
    'maintenant' a la moyenne des `CLOUD_TREND_WINDOW_HOURS` heures suivantes,
    pour dire si le ciel se degage, se degrade ou reste stable. Renvoie None
    quand `now` ne tombe pas dans `df` (nuit differente d'aujourd'hui) ou
    qu'il ne reste pas assez d'heures futures pour comparer.

    Volontairement limite a un seul point (la position du site) : pas
    d'anneau de points geographiques autour -- a cette echelle, l'ecart
    entre points proches serait surtout du bruit de modele, pas un vrai
    signal, et le site de l'utilisateur est fixe de toute facon."""
    if now is None or "cloud_cover" not in df:
        return None
    past_or_now = df.index[df.index <= now]
    if past_or_now.empty:
        return None
    current_t = past_or_now.max()
    now_pct = df.loc[current_t, "cloud_cover"]
    future = df.loc[df.index > current_t, "cloud_cover"].head(CLOUD_TREND_WINDOW_HOURS)
    if pd.isna(now_pct) or future.empty or future.isna().all():
        return None
    future_pct = future.mean()
    delta = future_pct - now_pct
    if delta <= -CLOUD_TREND_THRESHOLD_PCT:
        direction, label = "amelioration", "Amélioration"
    elif delta >= CLOUD_TREND_THRESHOLD_PCT:
        direction, label = "degradation", "Dégradation"
    else:
        direction, label = "stable", "Stable"
    return {
        "direction": direction, "label": label,
        "now_pct": round(now_pct), "future_pct": round(future_pct), "delta": round(delta),
    }


def dew_risk(df: pd.DataFrame) -> dict:
    """Risque de buee pour une nuit : plus petit ecart temperature/point de
    rosee observe sur `df`. Renvoie `spread=None` si `df` n'a pas les colonnes
    necessaires ou est vide -- meme seuils que la carte 'Risque de buee' de
    l'onglet 'Ce soir' (3° / 1.5°)."""
    spread = (df["temperature_2m"] - df["dew_point_2m"]).min()
    if pd.isna(spread):
        return {"spread": None, "risk": "Inconnu", "advice": "donnees manquantes"}
    risk = "Faible" if spread >= 3 else "Moyen" if spread >= 1.5 else "Élevé"
    advice = "Pas necessaire" if spread >= 3 else "Recommande" if spread >= 1.5 else "Indispensable"
    return {"spread": round(float(spread), 1), "risk": risk, "advice": advice}


def temperature_range(df: pd.DataFrame, now: pd.Timestamp | None) -> dict:
    """Plage de temperature exterieure sur `df` (memes bornes que la fenetre
    d'affichage active, Habituelle ou Nuit complete) : mini/maxi observes sur
    la fenetre, plus la valeur "maintenant" -- pour savoir en un coup d'oeil
    s'il faut un manteau, sans aller lire la courbe detaillee.

    `now_c` retombe sur la premiere heure de `df` quand `now` est vide ou
    avant le debut de la fenetre (meme repli que `_current_wind_gust` dans
    l'API : on consulte typiquement cette carte avant que la fenetre du soir
    ne commence, "n/d" serait moins utile qu'une temperature indicative pour
    decider s'il faut un manteau). `min_c`/`max_c` restent `None` sur un
    `df` vide ou sans la colonne."""
    if "temperature_2m" not in df or df.empty:
        return {"now_c": None, "min_c": None, "max_c": None}
    temps = df["temperature_2m"]
    idx = df.index[df.index <= now] if now is not None else df.index[:0]
    current_t = idx.max() if not idx.empty else df.index.min()
    now_c = temps.loc[current_t]
    min_c, max_c = temps.min(), temps.max()
    return {
        "now_c": round(float(now_c), 1) if pd.notna(now_c) else None,
        "min_c": round(float(min_c), 1) if pd.notna(min_c) else None,
        "max_c": round(float(max_c), 1) if pd.notna(max_c) else None,
    }


_CADRAGE_RANK = {"cadre unique": 0, "mosaique 2x": 1, "mosaique large": 2,
                 "tient dans le champ": 0, "déborde du champ": 1}


def discovery_sort_key(row: dict, captured: set) -> tuple:
    """Cle de tri de la galerie 'Cibles faisables ce soir' : priorite aux
    Messier pas encore captures (gamification -- cf. onglet Catalogue
    Messier), puis aux cadrages simples (une mosaique demande plusieurs
    sessions et un assemblage, un cadre unique est plus sur a reussir en une
    nuit) ; les heures disponibles ne departagent qu'en dernier recours. Les
    objets sans identifiant Messier (la majorite du catalogue large) restent
    neutres sur le premier critere -- ni boostes ni relegues, juste tries par
    cadrage puis par heures comme les Messier deja captures."""
    is_new = row["MessierId"] is not None and row["MessierId"] not in captured
    return (not is_new, _CADRAGE_RANK.get(row["Cadrage"], 3), -row["Heures"])


def _target_sky_frame(df: pd.DataFrame, target: dict, site: dict = SITE) -> pd.DataFrame:
    """Altitude/azimut/secteur/separation lunaire de `target` a chaque horodatage
    de `df`, dans le fuseau de `site`. Base commune a `target_windows` (filtrage
    de faisabilite) et `target_altitude_series` (graphe de detail, sans filtrage)."""
    tz = ZoneInfo(site["tz"])
    alts, azs, seps = [], [], []
    for t in df.index:
        tl = t.to_pydatetime().replace(tzinfo=tz)
        alt, az = target_altaz(tl, target["ra"], target["dec"], site=site)
        alts.append(alt)
        azs.append(az)
        seps.append(moon_separation(tl, target["ra"], target["dec"], site=site))
    d = df.assign(alt=alts, az=azs, moon_sep=seps)
    d["sector"] = d["az"].apply(compass_sector)
    return d


def target_altitude_series(df: pd.DataFrame, target: dict, site: dict = SITE) -> pd.DataFrame:
    """Serie complete (non filtree) alt/az/secteur/separation lunaire de `target`
    sur toute la plage de `df`, pour le graphe de detail d'une cible."""
    return _target_sky_frame(df, target, site=site)[["alt", "az", "sector", "moon_sep"]]


def culmination_deg(dec_deg: float, lat_deg: float) -> float:
    """Hauteur maximale d'un objet au-dessus de l'horizon, a son passage au
    meridien (sans refraction)."""
    return 90 - abs(lat_deg - dec_deg)


def min_alt_for(target: dict, site: dict = SITE) -> float:
    """Hauteur minimale exigee pour cette cible : celle de l'instrument (le
    Seestar, ou les jumelles portees par `target["optics"]`), sauf pour un
    Messier qui ne monte jamais assez depuis ce site (voir
    `SEESTAR["low_messier_min_alt_deg"]`)."""
    base = (target.get("optics") or {}).get("min_alt_deg", SEESTAR["min_alt_deg"])
    if target.get("messier") and target.get("dec") is not None \
            and culmination_deg(target["dec"], site["lat"]) < SEESTAR["low_messier_culmination_deg"]:
        return min(base, SEESTAR["low_messier_min_alt_deg"])
    return base


def max_alt_for(target: dict) -> float:
    """Hauteur maximale : le Seestar decroche pres du zenith, pas des jumelles."""
    return (target.get("optics") or {}).get("max_alt_deg", SEESTAR["max_alt_deg"])


def sector_floor(horizon: dict, sector: str) -> float | None:
    """Hauteur minimale pour ce secteur, ou None s'il est bouche. Accepte les
    deux formes d'horizon : booleens (ouvert = libre jusqu'a 0 deg, forme de
    l'appli Streamlit et des anciens reglages) ou profil avec hauteurs (voir
    `progress.horizon_profile`)."""
    value = horizon.get(sector, False)
    if value is None or value is False:
        return None
    if value is True:
        return 0.0
    return float(value)


def _sector_ok(d: pd.DataFrame, horizon: dict) -> pd.Series:
    """Heures ou la cible est dans un secteur degage, au-dessus de ce qui
    bouche ce secteur (arbres, toits)."""
    floors = pd.Series([sector_floor(horizon, s) for s in d["sector"]], index=d.index, dtype=float)
    return floors.notna() & (d["alt"] >= floors.fillna(0))


def _uses_lp(target: dict) -> bool:
    """Cible peu genee par la Lune. Au Seestar : objet en emission
    photographie avec le filtre LP (colonne `filter` du catalogue :
    nebuleuses, regions HII, planetaires, remanents). Aux jumelles : amas
    d'etoiles et doubles, qui restent nets a l'oeil sous la Lune, quand
    nebuleuses et galaxies s'effacent (voir optics.MOON_TOLERANT_TYPES)."""
    if target.get("optics"):
        from optics import MOON_TOLERANT_TYPES
        return target.get("type") in MOON_TOLERANT_TYPES
    return target.get("filter") == "LP"


def target_score(d: pd.DataFrame, target: dict) -> pd.Series:
    """Score horaire pour cette cible : meme facteur ciel que la nuit, mais une
    penalite lunaire qui tient compte de la separation Lune-cible et du
    filtre. Une nebuleuse en emission reste photographiable sous une Lune qui
    rend une galaxie inexploitable. Repli sur le score de la nuit pour un
    tableau qui ne porte pas les composantes."""
    if "sky" not in d or "moon_light" not in d:
        return d["score"]
    return d["sky"] * (1 - moon_penalty(d["moon_light"], d["moon_sep"], _uses_lp(target)))


def _moon_veto(d: pd.DataFrame, target: dict) -> pd.Series:
    """Heures ou la Lune, brillante et levee, est trop pres de la cible pour
    quoi que ce soit : 30 deg sans filtre, 15 deg avec le filtre LP."""
    limit = 15 if _uses_lp(target) else 30
    return (d["moon_alt"] > 0) & (d["moon_sep"] < limit) & (d["moon_illum"] > 40)


def target_windows(df: pd.DataFrame, target: dict, horizon: dict | None = None,
                    site: dict = SITE) -> dict:
    """Pour une cible, heures ou alt/azimut dans les plages autorisees et score
    OK -- le score propre a la cible (voir `target_score`), pas celui de la nuit."""
    horizon = horizon if horizon is not None else {s: True for s in COMPASS_SECTORS}
    d = _target_sky_frame(df, target, site=site)
    min_alt = min_alt_for(target, site)
    ok = d[(d["alt"] >= min_alt) & (d["alt"] <= max_alt_for(target))
           & (target_score(d, target) >= 0.6) & _sector_ok(d, horizon)
           & ~_moon_veto(d, target)]
    return {
        "name": target["name"], "type": target.get("type_fr", target.get("type", "")),
        "filter": target.get("filter", "sans"),
        "messier": target.get("messier"),
        "hours": len(ok),
        "start": ok.index.min() if not ok.empty else None,
        "end": ok.index.max() if not ok.empty else None,
        "max_alt": round(d["alt"].max(), 0),
        "min_moon_sep": round(d["moon_sep"].min(), 0),
        "size": (target.get("w"), target.get("h")),
        "min_alt": min_alt,
    }


def target_feasibility_reasons(df: pd.DataFrame, target: dict, horizon: dict | None = None,
                                site: dict = SITE) -> list[str]:
    """Pourquoi une cible n'a aucune heure faisable cette nuit (`target_windows`
    renvoie `hours == 0`) : chaque contrainte de `target_windows` (altitude,
    horizon degage, meteo, Lune) est testee independamment sur toute la nuit ;
    une raison est ajoutee pour chaque contrainte jamais satisfaite. Plusieurs
    raisons peuvent s'accumuler (ex. meteo ET Lune toutes les deux mauvaises).
    Renvoie une liste vide si la cible est en fait faisable."""
    horizon = horizon if horizon is not None else {s: True for s in COMPASS_SECTORS}
    d = _target_sky_frame(df, target, site=site)

    min_alt = min_alt_for(target, site)
    alt_ok = (d["alt"] >= min_alt) & (d["alt"] <= max_alt_for(target))
    sector_ok = _sector_ok(d, horizon)
    score_ok = target_score(d, target) >= 0.6  # meme seuil que target_windows
    moon_ok = ~_moon_veto(d, target)

    reasons = []
    if not alt_ok.any():
        reasons.append(
            f"Ne monte jamais entre {min_alt:.0f}° et {max_alt_for(target):.0f}° "
            f"d'altitude cette nuit (maximum atteint : {d['alt'].max():.0f}°).")
    elif not (alt_ok & sector_ok).any():
        reasons.append("Ne passe dans un secteur d'horizon degage (au-dessus de ce qui "
                        "le bouche) que hors de sa fenetre d'altitude exploitable.")
    if not score_ok.any():
        reasons.append("Aucune heure de la nuit n'atteint le score minimum pour cette "
                        "cible (nuages, Lune, vent, seeing...).")
    if not moon_ok.any():
        reasons.append("Trop proche d'une Lune brillante toute la nuit.")
    if not reasons and not (alt_ok & sector_ok & score_ok & moon_ok).any():
        # Chaque contrainte est parfois vraie individuellement, mais jamais
        # toutes en meme temps (ex. bonne altitude seulement quand la meteo
        # est mauvaise, et inversement).
        reasons.append("Les conditions favorables (altitude, horizon, meteo, Lune) "
                        "ne coincident jamais toutes en meme temps cette nuit.")
    return reasons


# (temps_bas_min, temps_haut_min, magnitude de reference) par type de cible --
# objets compacts/brillants (amas ouverts, doubles) demandent peu de pose,
# les objets a faible brillance de surface (galaxies, nebuleuses diffuses)
# beaucoup plus. Purement indicatif : aucune donnee reelle de temps
# d'integration par objet n'est disponible dans le catalogue (juste type +
# magnitude), donc `recommended_exposure_minutes` reste une heuristique.
_EXPOSURE_BASE = {
    "OCl": (10, 20, 6.0), "*Ass": (10, 20, 6.0), "**": (10, 20, 6.0),
    "GCl": (15, 30, 7.0),
    "PN": (20, 40, 9.0),
    "G": (45, 90, 9.5),
    "Neb": (40, 75, 8.0), "EmN": (40, 75, 8.0), "HII": (40, 75, 8.0),
    "RfN": (40, 75, 8.0), "SNR": (40, 75, 8.0), "Cl+N": (30, 60, 7.5),
}
_EXPOSURE_DEFAULT = (30, 60, 8.0)


def recommended_exposure_minutes(type_code: str, mag: float | None) -> tuple[int, int]:
    """Fourchette de temps de pose totale (minutes) indicative pour le Seestar
    S50, par type d'objet et magnitude -- ordre de grandeur, pas une mesure
    de temps d'integration reelle (donnee absente du catalogue). Chaque
    magnitude d'ecart avec la reference du type ajuste la fourchette de 15%."""
    low, high, ref_mag = _EXPOSURE_BASE.get(type_code, _EXPOSURE_DEFAULT)
    if mag is None:
        return low, high
    factor = _clamp(1 + 0.15 * (mag - ref_mag), 0.6, 2.5)
    return max(5, round(low * factor)), max(low + 5, round(high * factor))
