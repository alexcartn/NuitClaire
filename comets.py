"""Cometes visibles cette nuit, pour le Seestar.

Deux sources publiques, sans cle :
- les orbites du Minor Planet Center (MPC), publiees chaque jour au format
  XEphem que PyEphem lit tel quel (`ephem.readdb`) : position, hauteur et
  magnitude *prevue* par la formule du MPC ;
- la base d'observations COBS (cobs.si), qui donne la magnitude estimee a
  partir des observations reelles. La prevision du MPC se trompe souvent de
  1 a 3 magnitudes sur une comete active, et c'est elle qui decide si ca
  vaut la sortie.

La valeur COBS n'est prise que pour une comete proche de son perihelie :
pour les autres, son `current_mag` peut etre une vieille estimation (une
comete passee en 2019 y affiche encore 11,7). L'ecran dit toujours d'ou
vient la magnitude, « observee » ou « prevue ».

Les deux fichiers sont gardes 12 h en memoire ; injoignables, on garde la
derniere copie, et sans copie du tout on le dit plutot que d'inventer.
"""
import math
import time
from datetime import date, timedelta
from zoneinfo import ZoneInfo

import ephem
import requests

from extras import _observer, _sector, night_bounds

MPC_URL = "https://www.minorplanetcenter.net/iau/Ephemerides/Comets/Soft03Cmt.txt"
COBS_URL = "https://cobs.si/api/comet_list.api"
TTL_S = 12 * 3600
DEFAULT_MAG_MAX = 11.0
# Sous 20 deg, la turbulence et l'absorption rendent une comete peu
# photographiable, meme horizon degage.
MIN_ALT_DEG = 20
# La valeur COBS vaut pour une comete a moins de ce delai de son perihelie.
COBS_WINDOW_DAYS = 400

_cache: dict = {"mpc": (0.0, None), "cobs": (0.0, None)}
_HEADERS = {"User-Agent": "nuitclaire/1.0"}


def _fetch(kind: str, url: str, parse, now: float | None = None):
    now = time.time() if now is None else now
    at, value = _cache[kind]
    if value is not None and now - at < TTL_S:
        return value
    try:
        r = requests.get(url, timeout=15, headers=_HEADERS)
        r.raise_for_status()
        parsed = parse(r)
        if parsed:
            _cache[kind] = (now, parsed)
            return parsed
    except (requests.RequestException, ValueError, KeyError):
        pass
    return value


def parse_mpc(text: str) -> list[str]:
    """Lignes XEphem du fichier MPC, commentaires et lignes vides retires."""
    return [ln.strip() for ln in text.splitlines() if ln.strip() and not ln.startswith("#")]


def fetch_orbits(now: float | None = None) -> list[str] | None:
    return _fetch("mpc", MPC_URL, lambda r: parse_mpc(r.text), now)


def fetch_observed(now: float | None = None) -> dict | None:
    return _fetch("cobs", COBS_URL, lambda r: parse_cobs(r.json()), now)


def designation(name: str) -> str:
    """Cle commune aux deux sources : « 12P » pour « 12P/Pons-Brooks »,
    « C/2023 A3 » pour « C/2023 A3 (Tsuchinshan-ATLAS) »."""
    head = name.split(" (")[0].strip()
    if "/" in head and head.split("/")[0][:-1].isdigit():
        return head.split("/")[0]
    return head


def parse_cobs(data: dict) -> dict:
    """Par designation : magnitude estimee, pic attendu et perihelie."""
    out = {}
    for o in data.get("objects", []):
        try:
            mag = float(o["current_mag"]) if o.get("current_mag") not in (None, "") else None
        except ValueError:
            mag = None
        out[designation(o.get("fullname") or o["name"])] = {
            "mag": mag,
            "peakMag": float(o["peak_mag"]) if o.get("peak_mag") not in (None, "") else None,
            "peakDate": o.get("peak_mag_date"),
            "perihelion": (o.get("perihelion_date") or "")[:10] or None,
        }
    return out


def _observed_mag(obs: dict | None, day: date) -> float | None:
    if not obs or obs["mag"] is None or not obs["perihelion"]:
        return None
    try:
        peri = date.fromisoformat(obs["perihelion"])
    except ValueError:
        return None
    return obs["mag"] if abs((peri - day).days) <= COBS_WINDOW_DAYS else None


def _sector_floor(horizon: dict | None, az_deg: float) -> float | None:
    """Hauteur minimale ou le ciel est libre dans la direction `az_deg`,
    None si le secteur est bouche (voir progress.horizon_profile)."""
    if horizon is None:
        return 0.0
    return horizon.get(_sector(az_deg), 0.0)


def comets_tonight(lines: list[str], observed: dict | None, site: dict, day: date,
                   horizon: dict | None = None, mag_max: float = DEFAULT_MAG_MAX,
                   step_min: int = 15) -> list[dict]:
    """Cometes assez brillantes et assez hautes, dans un secteur degage,
    pendant la nuit du `day`. Les plus brillantes d'abord."""
    tz = ZoneInfo(site["tz"])
    dusk, dawn = night_bounds(site, day)
    middle = dusk + (dawn - dusk) / 2
    obs_mid = _observer(site, middle)
    out = []
    for line in lines:
        try:
            body = ephem.readdb(line)
            body.compute(obs_mid)
            predicted = float(body.mag)
        except (ValueError, RuntimeError):
            continue
        name = line.split(",")[0]
        key = designation(name)
        cobs = (observed or {}).get(key)
        seen = _observed_mag(cobs, day)
        mag = seen if seen is not None else predicted
        if math.isnan(mag) or mag > mag_max:
            continue
        samples = []
        t = dusk
        while t <= dawn:
            o = _observer(site, t)
            body.compute(o)
            alt, az = math.degrees(body.alt), math.degrees(body.az)
            floor = _sector_floor(horizon, az)
            samples.append((t, alt, az, floor is not None and alt >= max(MIN_ALT_DEG, floor)))
            t += timedelta(minutes=step_min)
        visible = [s for s in samples if s[3]]
        if not visible:
            continue
        best_t, best_alt, best_az, _ = max(visible, key=lambda s: s[1])
        body.compute(_observer(site, best_t))
        out.append({
            "name": name,
            "designation": key,
            "mag": round(mag, 1),
            "magSource": "observée" if seen is not None else "prévue",
            "predictedMag": round(predicted, 1),
            "peakMag": cobs["peakMag"] if cobs else None,
            "peakDate": cobs["peakDate"] if cobs else None,
            "constellation": ephem.constellation(body)[1],
            "from": visible[0][0].astimezone(tz).isoformat(),
            "to": visible[-1][0].astimezone(tz).isoformat(),
            "bestTime": best_t.astimezone(tz).isoformat(),
            "bestAlt": round(best_alt),
            "bestAz": round(best_az),
            "sector": _sector(best_az),
            "curve": [{"time": s[0].astimezone(tz).isoformat(), "alt": round(s[1], 1), "clear": s[3]}
                      for s in samples],
        })
    return sorted(out, key=lambda c: c["mag"])


def tonight(site: dict, day: date, horizon: dict | None, mag_max: float) -> dict:
    """Reponse de GET /api/comets : la liste, ou la raison de son absence."""
    lines = fetch_orbits()
    if not lines:
        return {"available": False, "reason": "Orbites des comètes indisponibles (Minor Planet Center injoignable).",
                "magMax": mag_max, "comets": []}
    observed = fetch_observed()
    return {
        "available": True,
        "observedAvailable": observed is not None,
        "magMax": mag_max,
        "comets": comets_tonight(lines, observed, site, day, horizon, mag_max),
    }
