"""PUT /api/horizon, PUT /api/messier/{id} -- ecritures sur data/progress.json
(horizon degage + Messier captures), via les fonctions deja testees de
`progress.py` (`toggle_messier`)."""
from fastapi import APIRouter, HTTPException

import progress as progress_store
from api.deps import progress_write_lock
from api.schemas import HorizonUpdate, MessierCaptureUpdate
from astro import COMPASS_SECTORS

router = APIRouter()


@router.put("/api/horizon", response_model=dict[str, bool])
def update_horizon(body: HorizonUpdate) -> dict:
    if body.sector not in COMPASS_SECTORS:
        raise HTTPException(422, f"secteur invalide : {body.sector}")
    with progress_write_lock:
        prog = progress_store.load()
        prog["horizon"][body.sector] = body.open
        progress_store.save(prog)
        return prog["horizon"]


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
