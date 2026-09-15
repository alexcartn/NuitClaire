"""Calculs astro avec PyEphem : Soleil, Lune, altitude des cibles."""
import math
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import ephem
import pandas as pd
from config import SITE, SEESTAR

TZ = ZoneInfo(SITE["tz"])


def _observer(t_local: datetime) -> ephem.Observer:
    obs = ephem.Observer()
    obs.lat, obs.lon = str(SITE["lat"]), str(SITE["lon"])
    obs.elevation = SITE["elevation_m"]
    obs.pressure = 0  # pas de réfraction, on veut l'altitude géométrique
    obs.date = t_local.astimezone(timezone.utc)
    return obs


def sun_moon(t_local: datetime) -> dict:
    obs = _observer(t_local)
    sun, moon = ephem.Sun(obs), ephem.Moon(obs)
    return {
        "sun_alt": math.degrees(sun.alt),
        "moon_alt": math.degrees(moon.alt),
        "moon_az": math.degrees(moon.az),
        "moon_illum": moon.phase,  # 0..100 %
        "_moon": moon,
    }


def target_altaz(t_local: datetime, ra_h: float, dec_deg: float) -> tuple[float, float]:
    obs = _observer(t_local)
    body = ephem.FixedBody()
    body._ra, body._dec = ephem.hours(ra_h * 15 * math.pi / 180), ephem.degrees(str(dec_deg))
    body.compute(obs)
    return math.degrees(body.alt), math.degrees(body.az)


def moon_separation(t_local: datetime, ra_h: float, dec_deg: float) -> float:
    obs = _observer(t_local)
    body = ephem.FixedBody()
    body._ra, body._dec = ephem.hours(ra_h * 15 * math.pi / 180), ephem.degrees(str(dec_deg))
    body.compute(obs)
    moon = ephem.Moon(obs)
    return math.degrees(ephem.separation(body, moon))


def night_hours(date_local, sun_limit: float = -12.0) -> list[datetime]:
    """Heures (locales) entre crépuscule et aube nautiques pour la nuit du `date_local`."""
    start = datetime(date_local.year, date_local.month, date_local.day, 12, tzinfo=TZ)
    hours = []
    for i in range(24):
        t = start + timedelta(hours=i)
        if sun_moon(t)["sun_alt"] < sun_limit:
            hours.append(t)
    return hours


def sky_frame(hours: list[datetime]) -> pd.DataFrame:
    rows = []
    for t in hours:
        sm = sun_moon(t)
        rows.append({"time": t.replace(tzinfo=None), "sun_alt": sm["sun_alt"],
                     "moon_alt": sm["moon_alt"], "moon_illum": sm["moon_illum"]})
    return pd.DataFrame(rows).set_index("time")


def fits_in_fov(size_arcmin_w: float, size_arcmin_h: float) -> str:
    w, h = SEESTAR["fov_w_deg"] * 60, SEESTAR["fov_h_deg"] * 60
    if size_arcmin_w <= w and size_arcmin_h <= h:
        return "cadre unique"
    if size_arcmin_w <= 2 * w and size_arcmin_h <= 2 * h:
        return "mosaïque 2x"
    return "mosaïque large"
