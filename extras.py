"""Les extras de la nuit, surtout pour les jumelles : la Lune et ses reliefs,
les planetes visibles, les passages de la station spatiale.

Tout vient de PyEphem, sauf l'orbite de l'ISS (un « TLE » publie par
Celestrak, renouvele chaque jour) : sans reseau cote serveur, la section ISS
le dit plutot que de proposer des passages calcules sur une orbite perimee.
"""
import math
import time
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import ephem
import requests

# Reliefs lunaires faciles aux jumelles : (nom, longitude, latitude
# selenographiques, en degres ; longitude positive a l'est). Ils ressortent
# quand le terminateur -- la limite jour/nuit -- passe a proximite : ombres
# longues, relief rasant.
LUNAR_FEATURES = [
    ("Mer des Crises", 58.8, 17.0), ("Mer de la Tranquillité", 31.4, 8.5),
    ("Mer de la Sérénité", 17.5, 28.0), ("Mer des Pluies", -15.6, 32.8),
    ("Océan des Tempêtes", -57.4, 18.4), ("Mer des Nuées", -16.6, -21.3),
    ("Mer des Humeurs", -39.6, -24.4), ("Mer de la Fécondité", 51.3, -7.8),
    ("Mer du Nectar", 35.5, -15.2), ("Langrenus", 61.0, -8.9), ("Petavius", 60.4, -25.1),
    ("Theophilus", 26.4, -11.4), ("Posidonius", 29.9, 31.8), ("Ptolémée", -1.8, -9.3),
    ("Copernic", -20.1, 9.6), ("Kepler", -38.0, 8.1), ("Aristarque", -47.5, 23.7),
    ("Tycho", -11.4, -43.3), ("Clavius", -14.4, -58.4), ("Platon", -9.3, 51.6),
    ("Archimède", -4.0, 29.7), ("Gassendi", -40.1, -17.6), ("Grimaldi", -68.3, -5.2),
    ("Schickard", -54.6, -44.4), ("Golfe des Iris", -31.5, 44.1), ("Monts Apennins", -3.0, 18.9),
    ("Mur Droit", -7.8, -22.1), ("Janssen", 40.8, -45.4), ("Maurolycus", 14.0, -41.8),
]
TERMINATOR_BAND_DEG = 15

PLANETS = [("Mercure", ephem.Mercury), ("Vénus", ephem.Venus), ("Mars", ephem.Mars),
           ("Jupiter", ephem.Jupiter), ("Saturne", ephem.Saturn), ("Uranus", ephem.Uranus)]
JUPITER_MOONS = [("Io", ephem.Io), ("Europe", ephem.Europa), ("Ganymède", ephem.Ganymede),
                 ("Callisto", ephem.Callisto)]
SECTORS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]

CELESTRAK_ISS = "https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE"
TLE_TTL_S = 12 * 3600
_tle_cache: dict = {"at": 0.0, "lines": None}


def _observer(site: dict, when: datetime) -> ephem.Observer:
    obs = ephem.Observer()
    obs.lat, obs.lon = str(site["lat"]), str(site["lon"])
    obs.elevation = site.get("elevation_m", 0)
    obs.date = when.astimezone(timezone.utc)
    return obs


def _local(d: ephem.Date, tz: ZoneInfo) -> datetime:
    return d.datetime().replace(tzinfo=timezone.utc).astimezone(tz)


def _sector(az_deg: float) -> str:
    return SECTORS[round((az_deg % 360) / 45) % 8]


def _norm180(x: float) -> float:
    return (x + 180) % 360 - 180


def night_bounds(site: dict, day) -> tuple[datetime, datetime]:
    """Du coucher du Soleil (-6 deg) au lever du lendemain, en heure locale."""
    tz = ZoneInfo(site["tz"])
    noon = datetime(day.year, day.month, day.day, 12, tzinfo=tz)
    obs = _observer(site, noon)
    obs.horizon = "-6"
    dusk = _local(obs.next_setting(ephem.Sun(), use_center=True), tz)
    obs.date = dusk.astimezone(timezone.utc)
    dawn = _local(obs.next_rising(ephem.Sun(), use_center=True), tz)
    return dusk, dawn


def features_near_terminator(colong_deg: float, illum: float) -> list[str]:
    """Reliefs pres du terminateur, cote eclaire : ceux qui ressortent ce
    soir. Vide pres de la pleine Lune, ou le Soleil tombe d'aplomb."""
    if illum >= 97:
        return []
    morning = _norm180(-colong_deg)    # le Soleil s'y leve
    evening = _norm180(180 - colong_deg)  # il s'y couche
    out = []
    for name, lon, _lat in LUNAR_FEATURES:
        after_sunrise = (lon - morning) % 360
        before_sunset = (evening - lon) % 360
        if after_sunrise <= TERMINATOR_BAND_DEG or before_sunset <= TERMINATOR_BAND_DEG:
            out.append(name)
    return out


def moon_tonight(site: dict, day) -> dict:
    tz = ZoneInfo(site["tz"])
    dusk, dawn = night_bounds(site, day)
    obs = _observer(site, dusk)
    moon = ephem.Moon(obs)
    illum = float(moon.phase)
    prev_new = ephem.previous_new_moon(obs.date)
    waxing = ephem.next_full_moon(obs.date) < ephem.next_new_moon(obs.date)
    colong = math.degrees(moon.colong)

    def event(fn) -> str | None:
        try:
            return _local(fn(ephem.Moon(), start=ephem.Date(obs.date - 0.5)), tz).isoformat()
        except (ephem.AlwaysUpError, ephem.NeverUpError):
            return None

    features = features_near_terminator(colong, illum)
    if illum >= 97:
        tip = "Pleine Lune : reliefs écrasés, mais les rayons de Tycho et de Copernic ressortent."
    elif illum <= 3:
        tip = "Nouvelle Lune : rien à voir, mais le ciel est au plus noir."
    else:
        tip = "Le relief ressort le long du terminateur, la limite entre le jour et la nuit."
    return {
        "illum": round(illum),
        "ageDays": round(float(obs.date - prev_new), 1),
        "waxing": waxing,
        "rise": event(obs.next_rising),
        "set": event(obs.next_setting),
        "terminatorFeatures": features,
        "tip": tip,
    }


def _jupiter_moons(obs: ephem.Observer) -> list[dict]:
    out = []
    for name, cls in JUPITER_MOONS:
        m = cls(obs)
        # x : vers l'est, en rayons de Jupiter ; cache si derriere la planete.
        out.append({"name": name, "x": round(float(m.x), 2), "y": round(float(m.y), 2),
                    "visible": bool(m.earth_visible)})
    return out


def planets_tonight(site: dict, day, step_min: int = 15) -> list[dict]:
    """Planetes visibles cette nuit (plus de 8 deg au-dessus de l'horizon,
    Soleil couche) : creneau, meilleur moment, eclat, et pour Jupiter et
    Saturne ce que les jumelles montrent en plus."""
    tz = ZoneInfo(site["tz"])
    dusk, dawn = night_bounds(site, day)
    out = []
    for name, cls in PLANETS:
        visible = []
        t = dusk
        while t <= dawn:
            obs = _observer(site, t)
            body = cls(obs)
            alt = math.degrees(body.alt)
            if alt >= 8:
                visible.append((t, alt, math.degrees(body.az)))
            t += timedelta(minutes=step_min)
        if not visible:
            continue
        best_t, best_alt, best_az = max(visible, key=lambda v: v[1])
        obs = _observer(site, best_t)
        body = cls(obs)
        item = {
            "name": name, "mag": round(float(body.mag), 1),
            "constellation": ephem.constellation(body)[1],
            "from": visible[0][0].isoformat(), "to": visible[-1][0].isoformat(),
            "bestTime": best_t.astimezone(tz).isoformat(), "bestAlt": round(best_alt),
            "bestAz": round(best_az), "sector": _sector(best_az),
            "binocular": float(body.mag) <= 6.0,
        }
        if name == "Jupiter":
            item["moons"] = _jupiter_moons(obs)
        if name == "Saturne":
            item["ringTiltDeg"] = round(abs(math.degrees(body.earth_tilt)), 1)
        out.append(item)
    return out


def fetch_iss_tle(now: float | None = None) -> list[str] | None:
    """Orbite de l'ISS chez Celestrak, gardee 12 h. None si injoignable."""
    now = time.time() if now is None else now
    if _tle_cache["lines"] and now - _tle_cache["at"] < TLE_TTL_S:
        return _tle_cache["lines"]
    try:
        r = requests.get(CELESTRAK_ISS, timeout=10, headers={"User-Agent": "nuitclaire/1.0"})
        r.raise_for_status()
        lines = [ln.strip() for ln in r.text.strip().splitlines() if ln.strip()]
        if len(lines) < 3 or not lines[1].startswith("1 ") or not lines[2].startswith("2 "):
            return _tle_cache["lines"]
        _tle_cache.update(at=now, lines=lines[:3])
        return _tle_cache["lines"]
    except requests.RequestException:
        return _tle_cache["lines"]


def iss_passes(tle: list[str], site: dict, start: datetime, days: int = 3, limit: int = 6) -> list[dict]:
    """Passages visibles a l'oeil nu : l'ISS eclairee par le Soleil, le ciel
    deja sombre (Soleil sous -6 deg), au moins 10 deg de hauteur."""
    tz = ZoneInfo(site["tz"])
    iss = ephem.readtle(*tle)
    obs = _observer(site, start)
    end = ephem.Date(obs.date + days)
    out = []
    for _ in range(60):
        if obs.date >= end or len(out) >= limit:
            break
        try:
            rise_t, rise_az, max_t, max_alt, set_t, set_az = obs.next_pass(iss)
        except ValueError:
            break
        if rise_t is None or set_t is None:
            obs.date = ephem.Date(obs.date + ephem.minute * 30)
            continue
        probe = ephem.Observer()
        probe.lat, probe.lon, probe.elevation = obs.lat, obs.lon, obs.elevation
        probe.date = max_t
        iss.compute(probe)
        sun_alt = math.degrees(ephem.Sun(probe).alt)
        peak = math.degrees(max_alt)
        if sun_alt < -6 and not iss.eclipsed and peak >= 10:
            out.append({
                "start": _local(rise_t, tz).isoformat(), "startDir": _sector(math.degrees(rise_az)),
                "peak": _local(max_t, tz).isoformat(), "peakAlt": round(peak),
                "end": _local(set_t, tz).isoformat(), "endDir": _sector(math.degrees(set_az)),
                "brightness": "très brillante" if peak >= 50 else "brillante" if peak >= 25 else "basse sur l'horizon",
            })
        obs.date = ephem.Date(set_t + ephem.minute)
    return out
