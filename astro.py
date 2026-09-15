"""Calculs astro avec PyEphem : Soleil, Lune, altitude des cibles."""
import math
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import ephem
import pandas as pd
from config import SITE, SEESTAR

TZ = ZoneInfo(SITE["tz"])

COMPASS_SECTORS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]


def compass_sector(azimuth_deg: float) -> str:
    """Secteur cardinal (45 degres) pour un azimut donne."""
    idx = int(((azimuth_deg % 360) + 22.5) // 45) % 8
    return COMPASS_SECTORS[idx]


def _observer(t_local: datetime, site: dict = SITE) -> ephem.Observer:
    obs = ephem.Observer()
    obs.lat, obs.lon = str(site["lat"]), str(site["lon"])
    obs.elevation = site["elevation_m"]
    obs.pressure = 0  # pas de refraction, on veut l'altitude geometrique
    obs.date = t_local.astimezone(timezone.utc)
    return obs


def sun_moon(t_local: datetime, site: dict = SITE) -> dict:
    obs = _observer(t_local, site)
    sun, moon = ephem.Sun(obs), ephem.Moon(obs)
    return {
        "sun_alt": math.degrees(sun.alt),
        "moon_alt": math.degrees(moon.alt),
        "moon_az": math.degrees(moon.az),
        "moon_illum": moon.phase,  # 0..100 %
        "_moon": moon,
    }


def target_altaz(t_local: datetime, ra_h: float, dec_deg: float,
                  site: dict = SITE) -> tuple[float, float]:
    obs = _observer(t_local, site)
    body = ephem.FixedBody()
    body._ra, body._dec = ephem.hours(ra_h * 15 * math.pi / 180), ephem.degrees(str(dec_deg))
    body.compute(obs)
    return math.degrees(body.alt), math.degrees(body.az)


def moon_separation(t_local: datetime, ra_h: float, dec_deg: float,
                     site: dict = SITE) -> float:
    obs = _observer(t_local, site)
    body = ephem.FixedBody()
    body._ra, body._dec = ephem.hours(ra_h * 15 * math.pi / 180), ephem.degrees(str(dec_deg))
    body.compute(obs)
    moon = ephem.Moon(obs)
    return math.degrees(ephem.separation(body, moon))


def night_hours(date_local, sun_limit: float = -12.0, site: dict = SITE) -> list[datetime]:
    """Heures (locales) entre crepuscule et aube nautiques pour la nuit du `date_local`."""
    start = datetime(date_local.year, date_local.month, date_local.day, 12, tzinfo=TZ)
    hours = []
    for i in range(24):
        t = start + timedelta(hours=i)
        if sun_moon(t, site)["sun_alt"] < sun_limit:
            hours.append(t)
    return hours


def sky_frame(hours: list[datetime], site: dict = SITE) -> pd.DataFrame:
    rows = []
    for t in hours:
        sm = sun_moon(t, site)
        rows.append({"time": t.replace(tzinfo=None), "sun_alt": sm["sun_alt"],
                     "moon_alt": sm["moon_alt"], "moon_illum": sm["moon_illum"]})
    return pd.DataFrame(rows).set_index("time")


def fits_in_fov(size_arcmin_w: float, size_arcmin_h: float) -> str:
    w, h = SEESTAR["fov_w_deg"] * 60, SEESTAR["fov_h_deg"] * 60
    if size_arcmin_w <= w and size_arcmin_h <= h:
        return "cadre unique"
    if size_arcmin_w <= 2 * w and size_arcmin_h <= 2 * h:
        return "mosaique 2x"
    return "mosaique large"


def _to_local(ephem_date: ephem.Date) -> datetime:
    return ephem_date.datetime().replace(tzinfo=timezone.utc).astimezone(TZ)


def twilight_times(date_local, site: dict = SITE) -> dict:
    """Crepuscule/aube civil (-6 deg), nautique (-12 deg), astronomique (-18 deg)
    pour la nuit du `date_local`, en heure locale (naive, dans le fuseau du site)."""
    base = datetime(date_local.year, date_local.month, date_local.day, 12, tzinfo=TZ)
    obs = _observer(base, site)
    sun = ephem.Sun()
    result = {}
    for label, horizon in (("civil", "-6"), ("nautical", "-12"), ("astro", "-18")):
        obs.horizon = horizon
        dusk = obs.next_setting(sun, use_center=True)
        dawn = obs.next_rising(sun, use_center=True)
        result[f"{label}_dusk"] = _to_local(dusk).replace(tzinfo=None)
        result[f"{label}_dawn"] = _to_local(dawn).replace(tzinfo=None)
    return result
