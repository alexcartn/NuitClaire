"""Calculs astro avec PyEphem : Soleil, Lune, altitude des cibles."""
import math
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import ephem
import pandas as pd
from config import SITE, SEESTAR

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


_TWILIGHT_LABEL_BY_THRESHOLD = {-6.0: "civil", -12.0: "nautical", -18.0: "astro"}


def night_hours(date_local, sun_limit: float = -6.0, site: dict = SITE) -> list[datetime]:
    """Heures locales, sur la grille horaire, couvrant la nuit du `date_local` a
    partir du seuil `sun_limit` -- civil (-6 deg) par defaut : le Seestar reste
    utilisable pour des cibles brillantes des la fin du crepuscule civil, et
    couper des le seuil nautique (-12, ancien defaut) ecartait a tort le debut de
    soiree (typiquement 20h-22h) des calculs de score/faisabilite alors que les
    cibles y sont deja bien placees.

    Bornes issues de `twilight_times` (calcul ephem precis), arrondies a l'heure
    pleine englobante pour rester sur la grille horaire d'Open-Meteo -- sans quoi
    une heure presque entierement "de nuit" pouvait etre perdue par un test au
    sommet de l'heure seulement (ex: crepuscule civil a 20:26 ne validait pas
    l'heure 20:00 avec un test instantane, alors que l'essentiel de cette heure
    est bien apres le seuil).
    """
    tz = ZoneInfo(site["tz"])
    label = _TWILIGHT_LABEL_BY_THRESHOLD.get(sun_limit)
    if label is None:
        # Seuil non standard (utilise par exemple par des tests cibles) : repli
        # sur le scan horaire simple, sans les bornes precises de twilight_times.
        start = datetime(date_local.year, date_local.month, date_local.day, 12, tzinfo=tz)
        return [start + timedelta(hours=i) for i in range(24)
                if sun_moon(start + timedelta(hours=i), site)["sun_alt"] < sun_limit]

    tw = twilight_times(date_local, site=site)
    dusk, dawn = tw[f"{label}_dusk"], tw[f"{label}_dawn"]
    t = dusk.replace(minute=0, second=0, microsecond=0, tzinfo=tz)
    end = dawn.replace(minute=0, second=0, microsecond=0, tzinfo=tz)
    hours = []
    while t <= end:
        hours.append(t)
        t += timedelta(hours=1)
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


def _to_local(ephem_date: ephem.Date, tz: ZoneInfo) -> datetime:
    return ephem_date.datetime().replace(tzinfo=timezone.utc).astimezone(tz)


def format_ra(ra_h: float) -> str:
    """Ascension droite (heures decimales) -> 'HHhMMm'."""
    h = int(ra_h)
    m = round((ra_h - h) * 60)
    if m == 60:
        h, m = h + 1, 0
    return f"{h:02d}h{m:02d}m"


def format_dec(dec_deg: float) -> str:
    """Declinaison (degres decimaux) -> \"+DD°MM'\"."""
    sign = "+" if dec_deg >= 0 else "-"
    d = abs(dec_deg)
    deg = int(d)
    minutes = round((d - deg) * 60)
    if minutes == 60:
        deg, minutes = deg + 1, 0
    return f"{sign}{deg:02d}°{minutes:02d}'"


def twilight_times(date_local, site: dict = SITE) -> dict:
    """Crepuscule/aube civil (-6 deg), nautique (-12 deg), astronomique (-18 deg)
    pour la nuit du `date_local`, en heure locale (naive, dans le fuseau du site)."""
    tz = ZoneInfo(site["tz"])
    base = datetime(date_local.year, date_local.month, date_local.day, 12, tzinfo=tz)
    obs = _observer(base, site)
    sun = ephem.Sun()
    result = {}
    for label, horizon in (("civil", "-6"), ("nautical", "-12"), ("astro", "-18")):
        obs.horizon = horizon
        dusk = obs.next_setting(sun, use_center=True)
        dawn = obs.next_rising(sun, use_center=True)
        result[f"{label}_dusk"] = _to_local(dusk, tz).replace(tzinfo=None)
        result[f"{label}_dawn"] = _to_local(dawn, tz).replace(tzinfo=None)
    return result
