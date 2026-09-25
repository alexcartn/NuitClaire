"""PUT /api/horizon, PUT /api/messier/{id}, POST/DELETE /api/progress/exposure/{designation}
-- ecritures sur data/progress.json (horizon degage, Messier captures, journal
d'expo libre par cible), via les fonctions deja testees de `progress.py`."""
from fastapi import APIRouter, HTTPException

import progress as progress_store
from api.deps import get_site, progress_write_lock
from api.schemas import AddExposure, ExposureEntryOut, HorizonUpdate, MessierCaptureUpdate, MessierSeenUpdate
from astro import COMPASS_SECTORS, local_now

router = APIRouter()


@router.put("/api/horizon", response_model=dict[str, bool])
def update_horizon(body: HorizonUpdate) -> dict:
    if body.sector not in COMPASS_SECTORS:
        raise HTTPException(422, f"secteur invalide : {body.sector}")
    if body.minAlt is not None and not 0 <= body.minAlt <= 60:
        raise HTTPException(422, "La hauteur minimale doit etre entre 0 et 60 degres.")
    with progress_write_lock:
        prog = progress_store.load()
        prog["horizon"][body.sector] = body.open
        if body.minAlt is not None:
            prog["horizon_alt"][body.sector] = body.minAlt
        progress_store.save(prog)
        return prog["horizon"]


@router.put("/api/messier/{messier_id}/seen", response_model=list[str])
def update_messier_seen(messier_id: str, body: MessierSeenUpdate) -> list[str]:
    """Messier vu aux jumelles : objectif visuel, distinct des captures."""
    with progress_write_lock:
        prog = progress_store.load()
        seen = [m for m in prog["messier_seen"] if m != messier_id]
        if body.seen:
            seen.append(messier_id)
        prog["messier_seen"] = seen
        progress_store.save(prog)
        return seen


@router.put("/api/messier/{messier_id}", response_model=list[str])
def update_messier_capture(messier_id: str, body: MessierCaptureUpdate) -> list[str]:
    with progress_write_lock:
        prog = progress_store.load()
        captured = set(prog["messier_captured"])
        already = messier_id in captured
        if body.captured and not already:
            progress_store.toggle_messier(prog, messier_id)
        elif not body.captured and already:
            progress_store.toggle_messier(prog, messier_id)
        progress_store.save(prog)
        return prog["messier_captured"]


@router.post("/api/progress/exposure/{designation}", response_model=list[ExposureEntryOut])
def add_target_exposure(designation: str, body: AddExposure) -> list[dict]:
    with progress_write_lock:
        prog = progress_store.load()
        progress_store.add_exposure(prog, designation, body.minutes, local_now(get_site()))
        progress_store.save(prog)
        return prog["exposure_log"].get(designation, [])


@router.delete("/api/progress/exposure/{designation}/{entry_id}", response_model=list[ExposureEntryOut])
def delete_target_exposure(designation: str, entry_id: str) -> list[dict]:
    with progress_write_lock:
        prog = progress_store.load()
        progress_store.remove_exposure(prog, designation, entry_id)
        progress_store.save(prog)
        return prog["exposure_log"].get(designation, [])
