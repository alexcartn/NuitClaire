"""GET /api/sessions, POST /api/sessions/current/items,
PUT/DELETE /api/sessions/current/items/{designation},
POST/DELETE /api/sessions/current/items/{designation}/notes[/{note_id}],
POST/DELETE /api/sessions/current/notes[/{note_id}] (notes libres),
POST /api/sessions/current/close,
PUT /api/sessions/past/{closed_at}, POST /api/sessions/past/{closed_at}/reopen
-- journal de session (voir sessions.py)."""
from datetime import datetime

from fastapi import APIRouter, HTTPException

import sessions as sessions_store
from catalog import find_target
from api.deps import current_night, current_score_pct, get_site, sessions_write_lock
from api.schemas import AddNote, AddSessionItem, CloseSession, SessionsOut, UpdateFeeling, \
    UpdatePastSession, UpdateSessionItem
from api.translate import sessions_to_out
from astro import local_now

router = APIRouter()


def _written_at(at: str | None, site: dict) -> datetime:
    """Heure a retenir pour une saisie : celle du client quand il la fournit,
    sinon celle du serveur.

    Une saisie faite hors ligne part quand le reseau revient, parfois des
    heures plus tard : l'horodater a la reception collerait a une note ecrite
    a 22h40 l'heure de la synchronisation, et le fil de la nuit se
    retrouverait dans le desordre. Une date illisible retombe sur l'heure du
    serveur plutot que de faire echouer la saisie -- perdre une note vaut
    bien pire qu'une minute d'ecart."""
    if at:
        try:
            return datetime.fromisoformat(at)
        except ValueError:
            pass
    return local_now(site)


@router.get("/api/sessions", response_model=SessionsOut)
def get_sessions() -> dict:
    return sessions_to_out(sessions_store.load())


@router.post("/api/sessions/current/items", response_model=SessionsOut)
def add_session_item(body: AddSessionItem) -> dict:
    """Ajoute une cible a la session en cours, apres l'avoir resolue dans le
    catalogue.

    La resolution sert deux choses. Elle refuse ce que le catalogue ne connait
    pas : depuis que le journal detecte une designation en tete de note
    (« M31 tres contraste »), une faute de frappe creerait sinon une cible
    fantome, qui polluerait durablement l'historique et les statistiques. Et
    elle enregistre la forme du catalogue (`m31` -> `M31`, `ic434` ->
    `IC0434`), sans quoi une meme cible se dedoublerait et son temps de pose
    cumule avec elle."""
    site = get_site()
    found = find_target(body.designation)
    if not found:
        raise HTTPException(404, f"Aucun objet trouve pour « {body.designation} ».")
    with sessions_write_lock:
        data = sessions_store.load()
        sessions_store.add_item(data, found["name"], _written_at(body.at, site),
                                 current_score_pct(site))
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
        if "rating" in body.model_fields_set:
            sessions_store.set_item_rating(data, designation, body.rating)
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
            sessions_store.add_item_note(data, designation, body.text, _written_at(body.at, site),
                                          body.context.model_dump() if body.context else None)
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
        sessions_store.add_free_note(data, body.text, _written_at(body.at, site),
                                      current_score_pct(site),
                                      body.context.model_dump() if body.context else None)
        sessions_store.save(data)
        return sessions_to_out(data)


@router.delete("/api/sessions/current/notes/{note_id}", response_model=SessionsOut)
def delete_session_free_note(note_id: str) -> dict:
    with sessions_write_lock:
        data = sessions_store.load()
        sessions_store.remove_free_note(data, note_id)
        sessions_store.save(data)
        return sessions_to_out(data)


@router.put("/api/sessions/current/feeling", response_model=SessionsOut)
def update_feeling(body: UpdateFeeling) -> dict:
    """Ressenti de la sortie en cours. Seuls les champs presents dans la
    requete sont modifies (`model_fields_set`) : deux saisies successives sur
    des champs differents ne s'effacent pas l'une l'autre."""
    patch = {k: getattr(body, k) for k in body.model_fields_set}
    with sessions_write_lock:
        data = sessions_store.load()
        try:
            sessions_store.set_feeling(data, patch)
        except ValueError as exc:
            raise HTTPException(404, str(exc)) from exc
        sessions_store.save(data)
        return sessions_to_out(data)


@router.post("/api/sessions/current/close", response_model=SessionsOut)
def close_session(body: CloseSession | None = None) -> dict:
    site = get_site()
    body = body or CloseSession()
    with sessions_write_lock:
        data = sessions_store.load()
        sel, _, _ = current_night(site)
        sessions_store.close_session(
            data,
            sel or local_now(site).date(),
            _written_at(body.at, site),
            body.conditions.model_dump() if body.conditions else None,
        )
        sessions_store.save(data)
        return sessions_to_out(data)


@router.put("/api/sessions/past/{closed_at}", response_model=SessionsOut)
def update_past_session(closed_at: str, body: UpdatePastSession) -> dict:
    """Retouche d'une sortie cloturee : son resume et/ou son ressenti. Seuls
    les champs presents dans la requete sont modifies."""
    sent = body.model_fields_set
    feeling = {k: getattr(body, k) for k in sent if k != "note"}
    with sessions_write_lock:
        data = sessions_store.load()
        try:
            if "note" in sent and body.note is not None:
                sessions_store.set_past_note(data, closed_at, body.note)
            if feeling:
                sessions_store.set_past_feeling(data, closed_at, feeling)
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
