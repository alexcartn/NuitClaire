"""GET/PUT /api/settings, POST /api/geocode."""
from fastapi import APIRouter, HTTPException

import settings as settings_store
from api.deps import get_site, settings_write_lock
from api.schemas import GeocodeRequest, GeocodeResult, SettingsOut, SettingsUpdate
from api.translate import site_to_out
from geocode import GeocodeError, geocode

router = APIRouter()

_VALID_WINDOW_MODES = ("complete", "habituelle")


@router.get("/api/settings", response_model=SettingsOut)
def get_settings() -> dict:
    s = settings_store.load()
    return {"site": site_to_out(get_site()), "windowMode": s["window_mode"], "alerts": s["alerts"]}


@router.put("/api/settings", response_model=SettingsOut)
def update_settings(body: SettingsUpdate) -> dict:
    if body.windowMode is not None and body.windowMode not in _VALID_WINDOW_MODES:
        raise HTTPException(422, f"windowMode doit etre l'un de {_VALID_WINDOW_MODES}")

    with settings_write_lock:
        s = settings_store.load()
        if body.site is not None:
            # Nominatim (voir POST /api/geocode) ne renvoie ni elevation ni
            # fuseau horaire : on les conserve du site effectif precedent,
            # meme logique que la barre laterale de app.py.
            current = get_site()
            s["site"] = {**current, "name": body.site.name, "lat": body.site.lat, "lon": body.site.lon}
        if body.windowMode is not None:
            s["window_mode"] = body.windowMode
        if body.alerts is not None:
            s["alerts"] = {**s["alerts"], **body.alerts}
        settings_store.save(s)

    return {"site": site_to_out(get_site()), "windowMode": s["window_mode"], "alerts": s["alerts"]}


@router.post("/api/geocode", response_model=GeocodeResult)
def do_geocode(body: GeocodeRequest) -> dict:
    try:
        result = geocode(body.address)
    except GeocodeError as e:
        raise HTTPException(422, str(e))
    return {"lat": result["lat"], "lon": result["lon"], "displayName": result["display_name"]}
