"""GET /api/sessions, POST /api/sessions/current/items,
PUT/DELETE /api/sessions/current/items/{designation},
POST /api/sessions/current/close -- journal de session (voir sessions.py)."""
from fastapi import APIRouter, HTTPException

import sessions as sessions_store
from api.deps import current_night, current_score_pct, get_site, sessions_write_lock
from api.schemas import AddSessionItem, SessionsOut, UpdateSessionItem
from api.translate import sessions_to_out
from astro import local_now

router = APIRouter()


@router.get("/api/sessions", response_model=SessionsOut)
def get_sessions() -> dict:
    return sessions_to_out(sessions_store.load())


@router.post("/api/sessions/current/items", response_model=SessionsOut)
def add_session_item(body: AddSessionItem) -> dict:
    site = get_site()
    with sessions_write_lock:
        data = sessions_store.load()
        sessions_store.add_item(data, body.designation, local_now(site), current_score_pct(site))
        sessions_store.save(data)
        return sessions_to_out(data)


@router.put("/api/sessions/current/items/{designation}", response_model=SessionsOut)
def update_session_item(designation: str, body: UpdateSessionItem) -> dict:
    with sessions_write_lock:
        data = sessions_store.load()
        if designation not in data["current"]["items"]:
            raise HTTPException(404, f"« {designation} » n'est pas dans la session en cours.")
        if body.done is not None and body.done != data["current"]["items"][designation]["done"]:
            sessions_store.toggle_item(data, designation)
        if body.note is not None:
            sessions_store.set_note(data, designation, body.note)
        sessions_store.save(data)
        return sessions_to_out(data)


@router.delete("/api/sessions/current/items/{designation}", response_model=SessionsOut)
def delete_session_item(designation: str) -> dict:
    with sessions_write_lock:
        data = sessions_store.load()
        sessions_store.remove_item(data, designation)
        sessions_store.save(data)
        return sessions_to_out(data)


@router.post("/api/sessions/current/close", response_model=SessionsOut)
def close_session() -> dict:
    site = get_site()
    with sessions_write_lock:
        data = sessions_store.load()
        sel, _, _ = current_night(site)
        sessions_store.close_session(data, sel or local_now(site).date(), local_now(site))
        sessions_store.save(data)
        return sessions_to_out(data)
