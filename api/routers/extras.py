"""GET /api/extras/moon, /api/extras/planets, /api/extras/iss -- les extras
de la nuit (voir extras.py). Lune et planetes gardees une heure (elles ne
dependent que du lieu et de la date) ; l'ISS depend d'une orbite recuperee
chez Celestrak. GET /api/comets (voir comets.py) et GET /api/news (voir
news.py) suivent la meme logique : sources externes gardees en memoire, et
leur absence dite plutot que cachee."""
import threading
from datetime import date, datetime, timezone

from cachetools import TTLCache
from fastapi import APIRouter

import comets
import extras
import news
import sky_events
import settings as settings_store
from api.deps import get_horizon, site_from_settings

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


@router.get("/api/comets")
def comets_tonight() -> dict:
    s = settings_store.load()
    site = site_from_settings(s)
    horizon = get_horizon()
    day = _night_date(site)
    key = ("comets", site["lat"], site["lon"], day, tuple(sorted(horizon.items())), s["comet_mag_max"])
    with _lock:
        if key in _cache:
            return _cache[key]
    result = comets.tonight(site, day, horizon, s["comet_mag_max"])
    # Une source injoignable ne reste pas en cache une heure : on reessaie
    # au prochain appel.
    if result["available"]:
        with _lock:
            _cache[key] = result
    return result


@router.get("/api/news")
def latest_news(refresh: bool = False) -> dict:
    return news.latest(refresh)


@router.get("/api/sky-events")
def sky_agenda() -> list[dict]:
    """Agenda des 30 prochains jours (voir sky_events.py), garde une heure :
    il ne depend que du lieu et de la date."""
    site = site_from_settings(settings_store.load())
    return _cached("sky-events", site, lambda st, day: sky_events.upcoming(st, day, 30))
