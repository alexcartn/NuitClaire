"""GET /api/state -- payload agrege pour le demarrage a froid du mobile
(site + horizon + mode de fenetre + Messier captures), pour eviter 2-3
allers-retours separes a l'ouverture de l'appli."""
from fastapi import APIRouter

import settings as settings_store
from api.deps import get_progress, get_site
from api.schemas import StateOut
from api.translate import site_to_out

router = APIRouter()


@router.get("/api/state", response_model=StateOut)
def get_state() -> dict:
    prog = get_progress()
    s = settings_store.load()
    return {
        "site": site_to_out(get_site()),
        "horizon": prog["horizon"],
        "windowMode": s["window_mode"],
        "messierCaptured": prog["messier_captured"],
    }
