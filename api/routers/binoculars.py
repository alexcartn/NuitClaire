"""GET /api/binoculars/now -- « En attendant le Seestar » : quelques cibles
faciles aux jumelles configurees, maintenant, ou a la nuit tombee si elle
n'est pas encore la (voir binocular_now.py). Gardees dix minutes : le ciel
tourne, mais pas assez vite pour recalculer a chaque ouverture."""
import threading
from datetime import datetime
from zoneinfo import ZoneInfo

from cachetools import TTLCache
from fastapi import APIRouter

import extras
import settings as settings_store
from api.deps import get_horizon, site_from_settings
from api.routers.extras import _night_date
from api.translate import binoculars_to_out
from binocular_now import binocular_picks
from optics import binocular_optics

router = APIRouter()
_cache: TTLCache = TTLCache(maxsize=16, ttl=600)
_lock = threading.Lock()


@router.get("/api/binoculars/now")
def binoculars_now() -> dict:
    s = settings_store.load()
    site, horizon, optics = site_from_settings(s), get_horizon(), binocular_optics(s)
    tz = ZoneInfo(site["tz"])
    now = datetime.now(tz)
    dusk, dawn = extras.night_bounds(site, _night_date(site))
    if now >= dawn:
        # Jour leve : la prochaine nuit.
        dusk, dawn = extras.night_bounds(site, now.date())
    at, when = ("maintenant", now) if dusk <= now < dawn else ("à la nuit tombée", dusk)
    when = when.replace(second=0, microsecond=0, minute=when.minute - when.minute % 10)
    key = (site["lat"], site["lon"], tuple(sorted(horizon.items())), tuple(sorted(optics.items())), when)
    with _lock:
        if key not in _cache:
            _cache[key] = binocular_picks(site, horizon, optics, when.astimezone(tz).replace(tzinfo=None))
        picks = _cache[key]
    return {"at": at, "time": when.isoformat(), "binoculars": binoculars_to_out(optics), "picks": picks}
