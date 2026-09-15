"""Score horaire go/no-go et fenêtres de visibilité par cible."""
from datetime import datetime
import pandas as pd
from config import WEIGHTS, SEESTAR
from astro import target_altaz, moon_separation, TZ


def _clamp(x, lo=0.0, hi=1.0):
    return max(lo, min(hi, x))


def hourly_score(row: pd.Series) -> float:
    """Chaque sous-score va de 0 (rédhibitoire) à 1 (idéal)."""
    # Nuages : les bas pèsent plus que les hauts (les cirrus tuent la transparence mais pas tout)
    low, mid, high = row.get("cloud_cover_low", 0), row.get("cloud_cover_mid", 0), row.get("cloud_cover_high", 0)
    clouds = 1 - _clamp((0.6 * low + 0.3 * mid + 0.1 * high) / 100)

    # Lune : pénalité proportionnelle à illumination x altitude
    moon = 1.0
    if row.get("moon_alt", -90) > 0:
        moon = 1 - _clamp((row["moon_illum"] / 100) * _clamp(row["moon_alt"] / 60))

    # Vent : rafales > 40 km/h = images poubelle avec le S50
    gust = row.get("wind_gusts_10m", 0) or 0
    wind = 1 - _clamp((gust - 10) / 30)

    # Rosée : écart T - Td < 2°C = buée quasi certaine
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

    return round(
        WEIGHTS["clouds"] * clouds + WEIGHTS["moon"] * moon + WEIGHTS["wind"] * wind
        + WEIGHTS["dew"] * dew + WEIGHTS["seeing_transp"] * st, 3)


def score_frame(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["score"] = df.apply(hourly_score, axis=1)
    return df


def night_summary(df: pd.DataFrame) -> dict:
    """Résumé d'une nuit : score moyen, meilleures heures, heures 'go'."""
    if df.empty:
        return {"score": 0, "go_hours": 0, "best": None}
    go = df[df["score"] >= 0.6]
    return {
        "score": round(df["score"].mean(), 2),
        "go_hours": len(go),
        "best": go["score"].idxmax() if not go.empty else None,
        "moon_illum": round(df["moon_illum"].max(), 0),
    }


def target_windows(df: pd.DataFrame, target: tuple) -> dict:
    """Pour une cible, heures où alt dans la plage Seestar et score OK."""
    name, ttype, ra, dec, w, h, filt = target
    alts, seps = [], []
    for t in df.index:
        tl = t.to_pydatetime().replace(tzinfo=TZ)
        alt, _ = target_altaz(tl, ra, dec)
        alts.append(alt)
        seps.append(moon_separation(tl, ra, dec))
    d = df.assign(alt=alts, moon_sep=seps)
    ok = d[(d["alt"] >= SEESTAR["min_alt_deg"]) & (d["alt"] <= SEESTAR["max_alt_deg"]) & (d["score"] >= 0.6)]
    # Pénalité Lune proche (< 30°) quand elle est levée
    if not ok.empty:
        ok = ok[~((ok["moon_alt"] > 0) & (ok["moon_sep"] < 30) & (ok["moon_illum"] > 40))]
    return {
        "name": name, "type": ttype, "filter": filt,
        "hours": len(ok),
        "start": ok.index.min() if not ok.empty else None,
        "end": ok.index.max() if not ok.empty else None,
        "max_alt": round(d["alt"].max(), 0),
        "min_moon_sep": round(d["moon_sep"].min(), 0),
        "size": (w, h),
    }
