"""GET /api/extras/moon, /api/extras/planets, /api/extras/iss -- les extras
de la nuit (voir extras.py). Lune et planetes gardees une heure (elles ne
dependent que du lieu et de la date) ; l'ISS depend d'une orbite recuperee
chez Celestrak."""
import threading
from datetime import date, datetime, timezone

from cachetools import TTLCache
from fastapi import APIRouter

import extras
import settings as settings_store
from api.deps import site_from_settings

router = APIRouter()
_cache: TTLCache = TTLCache(maxsize=16, ttl=3600)
_lock = threading.Lock()


def _night_date(site: dict) -> date:
    """La nuit en cours : celle d'hier tant que le jour n'est pas leve."""
    from zoneinfo import ZoneInfo

    now = datetime.now(ZoneInfo(site["tz"]))
    return (now.date() if now.hour >= 12 else date.fromordinal(now.date().toordinal() - 1))


def _cached(kind: str, site: dict, fn):
    day = _night_date(site)
    key = (kind, site["lat"], site["lon"], day)
    with _lock:
        if key not in _cache:
            _cache[key] = fn(site, day)
        return _cache[key]


@router.get("/api/extras/moon")
def moon() -> dict:
    return _cached("moon", site_from_settings(settings_store.load()), extras.moon_tonight)


@router.get("/api/extras/planets")
def planets() -> list[dict]:
    return _cached("planets", site_from_settings(settings_store.load()), extras.planets_tonight)


@router.get("/api/extras/iss")
def iss() -> dict:
    site = site_from_settings(settings_store.load())
    tle = extras.fetch_iss_tle()
    if not tle:
        return {"available": False, "reason": "Orbite de l'ISS indisponible (Celestrak injoignable).", "passes": []}
    return {"available": True, "passes": extras.iss_passes(tle, site, datetime.now(timezone.utc))}
