"""Récupération météo : Open-Meteo (modèle AROME Météo-France) + 7Timer ASTRO."""
import requests
import pandas as pd
from config import SITE

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
SEVENTIMER_URL = "https://www.7timer.info/bin/astro.php"


def fetch_open_meteo(days: int = 5, site: dict = SITE) -> pd.DataFrame:
    """Prévision horaire. Modèle AROME (1.3 km) via meteofrance_seamless."""
    params = {
        "latitude": site["lat"],
        "longitude": site["lon"],
        "hourly": ",".join([
            "temperature_2m", "dew_point_2m", "relative_humidity_2m",
            "cloud_cover", "cloud_cover_low", "cloud_cover_mid", "cloud_cover_high",
            "wind_speed_10m", "wind_gusts_10m", "precipitation_probability",
            "visibility",
        ]),
        "models": "meteofrance_seamless",
        "timezone": site["tz"],
        "forecast_days": days,
        "wind_speed_unit": "kmh",
    }
    r = requests.get(OPEN_METEO_URL, params=params, timeout=15)
    r.raise_for_status()
    h = r.json()["hourly"]
    df = pd.DataFrame(h)
    df["time"] = pd.to_datetime(df["time"])
    return df.set_index("time")


def fetch_7timer(site: dict = SITE) -> pd.DataFrame:
    """Prévision ASTRO 7Timer (GFS, pas de 3h, ~72h) : seeing et transparence."""
    params = {"lon": site["lon"], "lat": site["lat"], "ac": 0,
              "unit": "metric", "output": "json", "tzshift": 0}
    r = requests.get(SEVENTIMER_URL, params=params, timeout=15)
    r.raise_for_status()
    data = r.json()
    init = pd.to_datetime(data["init"], format="%Y%m%d%H", utc=True)
    rows = []
    for p in data["dataseries"]:
        t = init + pd.Timedelta(hours=p["timepoint"])
        rows.append({
            "time": t.tz_convert(site["tz"]).tz_localize(None),
            "seeing": p["seeing"],            # 1 (excellent) .. 8 (mauvais)
            "transparency": p["transparency"],  # 1 (excellente) .. 8 (mauvaise)
            "cloud_7t": p["cloudcover"],      # 1 (0-6%) .. 9 (94-100%)
        })
    df = pd.DataFrame(rows).set_index("time")
    # Interpolation sur la grille horaire pour fusion facile
    return df.resample("1h").interpolate()


def fetch_all(days: int = 5, site: dict = SITE) -> pd.DataFrame:
    """Fusionne les deux sources sur un index horaire."""
    om = fetch_open_meteo(days, site)
    try:
        st = fetch_7timer(site)
        df = om.join(st, how="left")
    except Exception as e:  # 7Timer tombe parfois, on continue sans
        print(f"7Timer indisponible : {e}")
        df = om.assign(seeing=None, transparency=None, cloud_7t=None)
    return df
