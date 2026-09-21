"""GET /api/state -- payload agrege pour le demarrage a froid du mobile
(site + horizon + mode de fenetre + Messier captures), pour eviter 2-3
allers-retours separes a l'ouverture de l'appli."""
from fastapi import APIRouter

import settings as settings_store
from api.deps import get_progress, site_from_settings
from api.schemas import StateOut
from api.translate import site_to_out

router = APIRouter()


@router.get("/api/state", response_model=StateOut)
def get_state() -> dict:
    prog = get_progress()
    s = settings_store.load()
    return {
        "site": site_to_out(site_from_settings(s)),
        "horizon": prog["horizon"],
        "windowMode": s["window_mode"],
        "viewWindow": {"startHour": s["view_window"]["start_hour"], "endHour": s["view_window"]["end_hour"]},
        "messierCaptured": prog["messier_captured"],
    }
