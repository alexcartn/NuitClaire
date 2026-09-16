"""GET /api/settings -- lecture seule en Phase 1 (ecriture prevue en Phase 2 :
geocodage, horizon, mode de fenetre, preferences d'alerte editables)."""
from fastapi import APIRouter

import settings as settings_store
from api.deps import get_site
from api.schemas import SettingsOut
from api.translate import site_to_out

router = APIRouter()


@router.get("/api/settings", response_model=SettingsOut)
def get_settings() -> dict:
    s = settings_store.load()
    return {"site": site_to_out(get_site()), "windowMode": s["window_mode"], "alerts": s["alerts"]}
