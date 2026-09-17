"""GET /api/night -- resume de la nuit en cours (score, crepuscules, Lune,
buee, vent, tendance nuages, courbe horaire complete). Meme source de verite
que l'onglet 'Ce soir' de app.py : mêmes fonctions partagees
(`scoring.night_summary`, `scoring.dew_risk`, `scoring.cloud_trend`,
`astro.moon_status`), simplement assemblees ici pour l'API plutot que pour
Streamlit."""
from datetime import date
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException

from api.deps import current_night, get_site, get_window_mode
from api.schemas import NightOut
from astro import local_now, moon_status
from scoring import cloud_trend, dew_risk, night_summary, score_label_fr, view_window_df, wind_quality

router = APIRouter()


def _nan_to_none(value) -> float | None:
    return None if value != value else float(value)  # NaN check sans importer pandas ici


def _current_wind_gust(df, now):
    """Rafale de l'heure courante (ou la plus proche disponible) -- meme
    logique de recherche d'heure courante que `scoring.cloud_trend`, pour une
    coherence visuelle entre la tendance nuages et la carte 'Rafales'."""
    if df.empty:
        return None
    idx = df.index[df.index <= now] if now is not None else df.index[:0]
    current_t = idx.max() if not idx.empty else df.index.min()
    return _nan_to_none(df.loc[current_t, "wind_gusts_10m"])


@router.get("/api/night", response_model=NightOut)
def get_night() -> dict:
    site = get_site()
    sel, df, tw = current_night(site)
    if sel is None:
        raise HTTPException(503, "Aucune donnee de nuit disponible pour les prochains jours.")

    window_mode = get_window_mode()
    view_df = view_window_df(df, window_mode)
    s = night_summary(view_df)
    pct, label = score_label_fr(s["score"])

    astro_dusk_aware = tw["astro_dusk"].replace(tzinfo=ZoneInfo(site["tz"]))
    moon = moon_status(astro_dusk_aware, site=site)
    dew = dew_risk(view_df)

    now = local_now(site) if sel == date.today() else None
    trend = cloud_trend(df, now)
    gust = _current_wind_gust(df, now)

    return {
        "date": sel.isoformat(),
        "civilDusk": tw["civil_dusk"].isoformat(), "civilDawn": tw["civil_dawn"].isoformat(),
        "nauticalDusk": tw["nautical_dusk"].isoformat(), "nauticalDawn": tw["nautical_dawn"].isoformat(),
        "astroDusk": tw["astro_dusk"].isoformat(), "astroDawn": tw["astro_dawn"].isoformat(),
        "score": s["score"], "scorePct": pct, "scoreLabel": label,
        "goHours": s["go_hours"], "bestWindow": s["best_window"],
        "moonIllum": moon["illum"], "moonWaxing": moon["waxing"], "moonSizeArcmin": moon["size_arcmin"],
        "dewSpread": dew["spread"], "dewRisk": dew["risk"], "dewAdvice": dew["advice"],
        "windGustsKmh": gust, "windQuality": wind_quality(gust or 0),
        "cloudTrend": {
            "direction": trend["direction"], "label": trend["label"],
            "nowPct": trend["now_pct"], "futurePct": trend["future_pct"], "delta": trend["delta"],
        } if trend else None,
        # Courbe complete (nuit entiere, non filtree par le mode de fenetre) :
        # meme choix que `_render_score_chart(df)`/`_render_cloud_chart`/
        # `_render_wind_chart`/`_render_time_series` dans app.py -- le mobile
        # sous-echantillonne cote client pour ses propres mini-viz.
        "hourly": [
            {
                "time": t.isoformat(), "score": df.at[t, "score"],
                "cloudCoverPct": _nan_to_none(df.at[t, "cloud_cover"]),
                "windGustsKmh": _nan_to_none(df.at[t, "wind_gusts_10m"]),
                "temperatureC": _nan_to_none(df.at[t, "temperature_2m"]),
                "dewPointC": _nan_to_none(df.at[t, "dew_point_2m"]),
            }
            for t in df.index
        ],
    }
