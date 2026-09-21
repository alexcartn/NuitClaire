"""GET/PUT /api/settings, POST /api/geocode."""
from fastapi import APIRouter, HTTPException

import settings as settings_store
from api.deps import settings_write_lock, site_from_settings
from api.schemas import GeocodeRequest, GeocodeResult, SettingsOut, SettingsUpdate
from api.translate import site_to_out
from geocode import GeocodeError, geocode

router = APIRouter()

_VALID_WINDOW_MODES = ("complete", "habituelle")


def _view_window_out(s: dict) -> dict:
    return {"startHour": s["view_window"]["start_hour"], "endHour": s["view_window"]["end_hour"]}


@router.get("/api/settings", response_model=SettingsOut)
def get_settings() -> dict:
    s = settings_store.load()
    return {"site": site_to_out(site_from_settings(s)), "windowMode": s["window_mode"],
            "viewWindow": _view_window_out(s), "alerts": s["alerts"]}


@router.put("/api/settings", response_model=SettingsOut)
def update_settings(body: SettingsUpdate) -> dict:
    if body.windowMode is not None and body.windowMode not in _VALID_WINDOW_MODES:
        raise HTTPException(422, f"windowMode doit etre l'un de {_VALID_WINDOW_MODES}")
    if body.viewWindow is not None and body.viewWindow.startHour >= body.viewWindow.endHour:
        raise HTTPException(422, "L'heure de debut doit etre avant l'heure de fin.")

    with settings_write_lock:
        s = settings_store.load()
        if body.site is not None:
            # Nominatim (voir POST /api/geocode) ne renvoie ni elevation ni
            # fuseau horaire : on les conserve du site effectif precedent,
            # meme logique que la barre laterale de app.py.
            current = site_from_settings(s)
            s["site"] = {**current, "name": body.site.name, "lat": body.site.lat, "lon": body.site.lon}
        if body.windowMode is not None:
            s["window_mode"] = body.windowMode
        if body.viewWindow is not None:
            s["view_window"] = {"start_hour": body.viewWindow.startHour, "end_hour": body.viewWindow.endHour}
        if body.alerts is not None:
            s["alerts"] = {**s["alerts"], **body.alerts}
        settings_store.save(s)

    return {"site": site_to_out(site_from_settings(s)), "windowMode": s["window_mode"],
            "viewWindow": _view_window_out(s), "alerts": s["alerts"]}


@router.post("/api/geocode", response_model=GeocodeResult)
def do_geocode(body: GeocodeRequest) -> dict:
    try:
        result = geocode(body.address)
    except GeocodeError as e:
        raise HTTPException(422, str(e))
    return {"lat": result["lat"], "lon": result["lon"], "displayName": result["display_name"]}
