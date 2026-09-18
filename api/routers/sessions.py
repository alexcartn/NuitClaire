"""GET /api/sessions, POST /api/sessions/current/items,
PUT/DELETE /api/sessions/current/items/{designation},
POST/DELETE /api/sessions/current/items/{designation}/notes[/{note_id}],
POST/DELETE /api/sessions/current/notes[/{note_id}] (notes libres),
POST /api/sessions/current/close,
PUT /api/sessions/past/{closed_at}, POST /api/sessions/past/{closed_at}/reopen
-- journal de session (voir sessions.py)."""
from fastapi import APIRouter, HTTPException

import sessions as sessions_store
from api.deps import current_night, current_score_pct, get_site, sessions_write_lock
from api.schemas import AddNote, AddSessionItem, SessionsOut, UpdatePastSession, UpdateSessionItem
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
        if body.exposureMin is not None:
            sessions_store.set_item_exposure(data, designation, body.exposureMin)
        sessions_store.save(data)
        return sessions_to_out(data)


@router.delete("/api/sessions/current/items/{designation}", response_model=SessionsOut)
def delete_session_item(designation: str) -> dict:
    with sessions_write_lock:
        data = sessions_store.load()
        sessions_store.remove_item(data, designation)
        sessions_store.save(data)
        return sessions_to_out(data)


@router.post("/api/sessions/current/items/{designation}/notes", response_model=SessionsOut)
def add_session_item_note(designation: str, body: AddNote) -> dict:
    site = get_site()
    with sessions_write_lock:
        data = sessions_store.load()
        try:
            sessions_store.add_item_note(data, designation, body.text, local_now(site))
        except ValueError as exc:
            raise HTTPException(404, str(exc)) from exc
        sessions_store.save(data)
        return sessions_to_out(data)


@router.delete("/api/sessions/current/items/{designation}/notes/{note_id}", response_model=SessionsOut)
def delete_session_item_note(designation: str, note_id: str) -> dict:
    with sessions_write_lock:
        data = sessions_store.load()
        try:
            sessions_store.remove_item_note(data, designation, note_id)
        except ValueError as exc:
            raise HTTPException(404, str(exc)) from exc
        sessions_store.save(data)
        return sessions_to_out(data)


@router.post("/api/sessions/current/notes", response_model=SessionsOut)
def add_session_free_note(body: AddNote) -> dict:
    site = get_site()
    with sessions_write_lock:
        data = sessions_store.load()
        sessions_store.add_free_note(data, body.text, local_now(site), current_score_pct(site))
        sessions_store.save(data)
        return sessions_to_out(data)


@router.delete("/api/sessions/current/notes/{note_id}", response_model=SessionsOut)
def delete_session_free_note(note_id: str) -> dict:
    with sessions_write_lock:
        data = sessions_store.load()
        sessions_store.remove_free_note(data, note_id)
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


@router.put("/api/sessions/past/{closed_at}", response_model=SessionsOut)
def update_past_session(closed_at: str, body: UpdatePastSession) -> dict:
    with sessions_write_lock:
        data = sessions_store.load()
        try:
            sessions_store.set_past_note(data, closed_at, body.note)
        except ValueError as exc:
            raise HTTPException(404, str(exc)) from exc
        sessions_store.save(data)
        return sessions_to_out(data)


@router.post("/api/sessions/past/{closed_at}/reopen", response_model=SessionsOut)
def reopen_past_session(closed_at: str) -> dict:
    with sessions_write_lock:
        data = sessions_store.load()
        if data["current"]["items"] or data["current"]["freeNotes"]:
            raise HTTPException(409, "Une session est deja en cours -- cloturez-la avant de rouvrir une sortie passee.")
        try:
            sessions_store.reopen_session(data, closed_at)
        except ValueError as exc:
            raise HTTPException(404, str(exc)) from exc
        sessions_store.save(data)
        return sessions_to_out(data)
