"""Score horaire go/no-go, fenetres de visibilite et resume par cible."""
from itertools import groupby
from zoneinfo import ZoneInfo

import pandas as pd
from config import WEIGHTS, SEESTAR, SITE
from astro import target_altaz, moon_separation, compass_sector, COMPASS_SECTORS


def _clamp(x, lo=0.0, hi=1.0):
    return max(lo, min(hi, x))


def wind_quality(gust_kmh: float) -> float:
    """Sous-score vent (0 = redhibitoire, 1 = ideal) a partir des seules
    rafales -- rafales > 40 km/h = images poubelle avec le S50. Factorise hors
    de `hourly_score` car reutilise par le graphe 'Vent' de l'appli (couleur
    des points, meme echelle rouge/jaune/vert que le score astro global)."""
    return 1 - _clamp((gust_kmh - 10) / 30)


def hourly_score(row: pd.Series) -> float:
    """Chaque sous-score va de 0 (redhibitoire) a 1 (ideal)."""
    # Nuages : les bas pesent plus que les hauts (les cirrus tuent la transparence mais pas tout)
    low, mid, high = row.get("cloud_cover_low", 0), row.get("cloud_cover_mid", 0), row.get("cloud_cover_high", 0)
    clouds = 1 - _clamp((0.6 * low + 0.3 * mid + 0.1 * high) / 100)

    # Lune : penalite proportionnelle a illumination x altitude
    moon = 1.0
    if row.get("moon_alt", -90) > 0:
        moon = 1 - _clamp((row["moon_illum"] / 100) * _clamp(row["moon_alt"] / 60))

    wind = wind_quality(row.get("wind_gusts_10m", 0) or 0)

    # Rosee : ecart T - Td < 2 deg C = buee quasi certaine
    spread = (row.get("temperature_2m", 10) or 10) - (row.get("dew_point_2m", 0) or 0)
    dew = _clamp((spread - 1) / 5)

    # Seeing / transparence 7Timer (1 = excellent, 8 = mauvais)
    s, t = row.get("seeing"), row.get("transparency")
    if pd.notna(s) and pd.notna(t):
        st = 1 - _clamp(((s - 1) / 7 + (t - 1) / 7) / 2)
    else:
        st = 0.6  # inconnu : neutre

    # Pluie : veto
    if (row.get("precipitation_probability", 0) or 0) > 50:
        return 0.0

    # Nuages bas : veto -- une couche basse quasi opaque bouche le ciel
    # quelles que soient les couches au-dessus (contrairement a la moyenne
    # ponderee de `clouds`, qui dilue ce cas et laisse remonter le score).
    if low > 80:
        return 0.0

    return round(
        WEIGHTS["clouds"] * clouds + WEIGHTS["moon"] * moon + WEIGHTS["wind"] * wind
        + WEIGHTS["dew"] * dew + WEIGHTS["seeing_transp"] * st, 3)


def score_frame(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
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


def target_windows(df: pd.DataFrame, target: dict, horizon: dict | None = None,
                    site: dict = SITE) -> dict:
    """Pour une cible, heures ou alt/azimut dans les plages autorisees et score OK."""
    horizon = horizon if horizon is not None else {s: True for s in COMPASS_SECTORS}
    d = _target_sky_frame(df, target, site=site)
    open_sectors = {s for s, is_open in horizon.items() if is_open}
    ok = d[(d["alt"] >= SEESTAR["min_alt_deg"]) & (d["alt"] <= SEESTAR["max_alt_deg"])
           & (d["score"] >= 0.6) & (d["sector"].isin(open_sectors))]
    if not ok.empty:
        ok = ok[~((ok["moon_alt"] > 0) & (ok["moon_sep"] < 30) & (ok["moon_illum"] > 40))]
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
    open_sectors = {s for s, is_open in horizon.items() if is_open}

    alt_ok = (d["alt"] >= SEESTAR["min_alt_deg"]) & (d["alt"] <= SEESTAR["max_alt_deg"])
    sector_ok = d["sector"].isin(open_sectors)
    score_ok = d["score"] >= 0.6  # meme seuil que target_windows
    moon_ok = ~((d["moon_alt"] > 0) & (d["moon_sep"] < 30) & (d["moon_illum"] > 40))

    reasons = []
    if not alt_ok.any():
        reasons.append(
            f"Ne monte jamais entre {SEESTAR['min_alt_deg']:.0f}° et {SEESTAR['max_alt_deg']:.0f}° "
            f"d'altitude cette nuit (maximum atteint : {d['alt'].max():.0f}°).")
    elif not (alt_ok & sector_ok).any():
        reasons.append("Ne passe dans un secteur d'horizon degage que hors de sa "
                        "fenetre d'altitude exploitable.")
    if not score_ok.any():
        reasons.append("Aucune heure de la nuit n'atteint le score meteo minimum "
                        "(nuages, vent, seeing...).")
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
