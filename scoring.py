"""Score horaire go/no-go, fenetres de visibilite et resume par cible."""
from itertools import groupby

import pandas as pd
from config import WEIGHTS, SEESTAR, SITE
from astro import target_altaz, moon_separation, compass_sector, TZ, COMPASS_SECTORS


def _clamp(x, lo=0.0, hi=1.0):
    return max(lo, min(hi, x))


def hourly_score(row: pd.Series) -> float:
    """Chaque sous-score va de 0 (redhibitoire) a 1 (ideal)."""
    low, mid, high = row.get("cloud_cover_low", 0), row.get("cloud_cover_mid", 0), row.get("cloud_cover_high", 0)
    clouds = 1 - _clamp((0.6 * low + 0.3 * mid + 0.1 * high) / 100)

    moon = 1.0
    if row.get("moon_alt", -90) > 0:
        moon = 1 - _clamp((row["moon_illum"] / 100) * _clamp(row["moon_alt"] / 60))

    gust = row.get("wind_gusts_10m", 0) or 0
    wind = 1 - _clamp((gust - 10) / 30)

    spread = (row.get("temperature_2m", 10) or 10) - (row.get("dew_point_2m", 0) or 0)
    dew = _clamp((spread - 1) / 5)

    s, t = row.get("seeing"), row.get("transparency")
    if pd.notna(s) and pd.notna(t):
        st = 1 - _clamp(((s - 1) / 7 + (t - 1) / 7) / 2)
    else:
        st = 0.6

    if (row.get("precipitation_probability", 0) or 0) > 50:
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


def best_window(df: pd.DataFrame) -> str | None:
    """Plus longue plage horaire contigue avec score >= 0.6, formatee 'HH:MM–HH:MM'."""
    flags = [(t, s >= 0.6) for t, s in df["score"].items()]
    runs = []
    for ok, group in groupby(flags, key=lambda x: x[1]):
        group = list(group)
        if ok:
            runs.append((group[0][0], group[-1][0]))
    if not runs:
        return None
    start, last = max(runs, key=lambda r: r[1] - r[0])
    end = last + pd.Timedelta(hours=1)
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


def target_windows(df: pd.DataFrame, target: dict, horizon: dict | None = None,
                    site: dict = SITE) -> dict:
    """Pour une cible, heures ou alt/azimut dans les plages autorisees et score OK."""
    horizon = horizon if horizon is not None else {s: True for s in COMPASS_SECTORS}
    alts, azs, seps = [], [], []
    for t in df.index:
        tl = t.to_pydatetime().replace(tzinfo=TZ)
        alt, az = target_altaz(tl, target["ra"], target["dec"], site=site)
        alts.append(alt)
        azs.append(az)
        seps.append(moon_separation(tl, target["ra"], target["dec"], site=site))
    d = df.assign(alt=alts, az=azs, moon_sep=seps)
    d["sector"] = d["az"].apply(compass_sector)
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
