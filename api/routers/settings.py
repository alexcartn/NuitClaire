"""GET/PUT /api/settings, POST /api/geocode, POST /api/geocode/reverse."""
from fastapi import APIRouter, HTTPException

import settings as settings_store
from api.deps import settings_write_lock, site_from_settings
from api.schemas import GeocodeRequest, GeocodeResult, ReverseGeocodeRequest, ReverseGeocodeResult, \
    SettingsOut, SettingsUpdate
from api.translate import site_to_out
from geocode import GeocodeError, geocode, reverse_geocode

router = APIRouter()

_VALID_WINDOW_MODES = ("complete", "habituelle")


def _view_window_out(s: dict) -> dict:
    return {"startHour": s["view_window"]["start_hour"], "endHour": s["view_window"]["end_hour"]}


def _settings_out(s: dict) -> dict:
    site = site_from_settings(s)
    # Le lieu actif figure toujours dans la liste, meme avant tout changement.
    places = s["places"] if any(p["name"] == site["name"] for p in s["places"]) else [site] + s["places"]
    return {"site": site_to_out(site), "windowMode": s["window_mode"],
            "viewWindow": _view_window_out(s), "alerts": s["alerts"],
            "places": [site_to_out(p) for p in places]}


@router.get("/api/settings", response_model=SettingsOut)
def get_settings() -> dict:
    return _settings_out(settings_store.load())


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
            # Le lieu quitte reste dans la liste, pour y revenir d'un appui.
            settings_store.remember_place(s, current)
            s["site"] = {**current, "name": body.site.name, "lat": body.site.lat, "lon": body.site.lon}
            settings_store.remember_place(s, s["site"])
        if body.windowMode is not None:
            s["window_mode"] = body.windowMode
        if body.viewWindow is not None:
            s["view_window"] = {"start_hour": body.viewWindow.startHour, "end_hour": body.viewWindow.endHour}
        if body.alerts is not None:
            s["alerts"] = {**s["alerts"], **body.alerts}
        settings_store.save(s)

    return _settings_out(s)


@router.delete("/api/places/{name}", response_model=SettingsOut)
def delete_place(name: str) -> dict:
    with settings_write_lock:
        s = settings_store.load()
        if name == site_from_settings(s)["name"]:
            raise HTTPException(409, "C'est le lieu actif : choisissez-en un autre avant de le retirer.")
        settings_store.forget_place(s, name)
        settings_store.save(s)
    return _settings_out(s)


@router.post("/api/geocode", response_model=GeocodeResult)
def do_geocode(body: GeocodeRequest) -> dict:
    try:
        result = geocode(body.address)
    except GeocodeError as e:
        raise HTTPException(422, str(e))
    return {"lat": result["lat"], "lon": result["lon"], "displayName": result["display_name"]}


@router.post("/api/geocode/reverse", response_model=ReverseGeocodeResult)
def do_reverse_geocode(body: ReverseGeocodeRequest) -> dict:
    try:
        return {"name": reverse_geocode(body.lat, body.lon)}
    except GeocodeError as e:
        raise HTTPException(422, str(e))
