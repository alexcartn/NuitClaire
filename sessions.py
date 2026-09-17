"""Persistance locale : journal de session d'observation -- session en cours
(cibles ajoutees ce soir, cochees au fur et a mesure, note libre) et
historique des sorties cloturees. Meme pattern default()/load()/save() que
progress.py/settings.py, mais fichier separe : celui-ci grandit par
accumulation (une entree par sortie cloturee) alors que les deux autres
restent des blobs de taille fixe -- deux rythmes de croissance differents,
deux fichiers.

Aucune donnee fabriquee : contrairement au mockup de design (qui affichait
un exemple du type "28 min - 84 poses retenues"), rien ici n'est mesure --
le Seestar n'est pas integre a cette appli. Chaque entree ne contient que ce
que l'utilisateur a explicitement saisi (une note libre) ou ce que l'appli
sait reellement (l'heure d'ajout, le score de la nuit au moment de l'ouverture
de la session). Ne jamais reformater `note` en un format qui ressemblerait a
des statistiques d'exposition -- ce serait remettre la donnee fabriquee du
mockup par la petite porte.

Le score de la nuit est capture une seule fois, a l'ouverture de la session
(premiere cible ajoutee) et reutilise tel quel a la cloture -- jamais
re-interroge en direct a ce moment-la : c'est une prevision, pas une mesure
retrospective, et cloturer une session au petit matin ne doit pas figer dans
l'historique le score d'une tout autre nuit."""
import json
import os
from datetime import date, datetime
from pathlib import Path
from types import MappingProxyType

import db

SESSIONS_PATH = Path(__file__).parent / "data" / "sessions.json"

_DEFAULT_FROZEN = MappingProxyType({
    "current": MappingProxyType({"openedAt": None, "scoreAtOpen": None, "items": MappingProxyType({})}),
    "past": (),
})


def default() -> dict:
    """Retourne une copie fraiche et independante des valeurs par defaut."""
    return {
        "current": {"openedAt": None, "scoreAtOpen": None, "items": {}},
        "past": [],
    }


DEFAULT = default()


def load(path: Path = SESSIONS_PATH) -> dict:
    """Charge le journal -- depuis Supabase si configure (voir db.py), sinon
    depuis `path`. Retombe sur les valeurs par defaut si la source est
    absente, illisible ou corrompue."""
    raw = db.load_blob("sessions") if db.enabled() else _read_file(path)
    if raw is None:
        return default()

    merged = default()
    current_override = raw.get("current")
    if isinstance(current_override, dict):
        merged["current"].update(current_override)
        if not isinstance(merged["current"].get("items"), dict):
            merged["current"]["items"] = {}
    past_override = raw.get("past")
    if isinstance(past_override, list):
        merged["past"] = past_override
    return merged


def _read_file(path: Path) -> dict | None:
    if not path.exists():
        return None
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            raise TypeError("le fichier de journal doit contenir un objet JSON")
    except (json.JSONDecodeError, TypeError, ValueError, OSError):
        return None
    return data


def save(data: dict, path: Path = SESSIONS_PATH) -> None:
    """Ecrit le journal -- sur Supabase si configure, sinon sur `path` en
    ecriture atomique (fichier temporaire + `os.replace`)."""
    if db.enabled():
        db.save_blob("sessions", data)
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def add_item(data: dict, designation: str, now: datetime, score_now: int | None) -> dict:
    """Ajoute `designation` a la session en cours. Si la session est vide,
    l'ouvre (fige `openedAt`/`scoreAtOpen`) -- idempotent si la cible y est deja."""
    cur = data["current"]
    if not cur["items"]:
        cur["openedAt"] = now.isoformat()
        cur["scoreAtOpen"] = score_now
    cur["items"].setdefault(designation, {"addedAt": now.isoformat(), "done": False, "note": ""})
    return data


def remove_item(data: dict, designation: str) -> dict:
    """Retire `designation` de la session en cours ; referme la session
    (openedAt/scoreAtOpen remis a None) si c'etait la derniere cible."""
    data["current"]["items"].pop(designation, None)
    if not data["current"]["items"]:
        data["current"]["openedAt"] = None
        data["current"]["scoreAtOpen"] = None
    return data


def toggle_item(data: dict, designation: str) -> dict:
    item = data["current"]["items"].get(designation)
    if item is not None:
        item["done"] = not item["done"]
    return data


def set_note(data: dict, designation: str, note: str) -> dict:
    item = data["current"]["items"].get(designation)
    if item is not None:
        item["note"] = note
    return data


def close_session(data: dict, today: date, now: datetime) -> dict:
    """Cloture la session en cours : si elle contient au moins une cible, la
    range dans `past` (triee la plus recente en tete) puis la vide. Sans effet
    si la session en cours est deja vide.

    `openedAt` et `items` (copie complete, cochees/notes par cible incluses)
    sont conserves dans l'entree passee en plus de `targets`/`note` (formes
    resumees pour l'affichage) : c'est ce qui permet a `reopen_session` de
    restaurer une sortie cloturee par erreur a l'identique plutot qu'a vide."""
    cur = data["current"]
    if cur["items"]:
        notes = [i["note"] for i in cur["items"].values() if i["note"]]
        data["past"].insert(0, {
            "date": today.isoformat(),
            "score": cur["scoreAtOpen"],
            "targets": sorted(cur["items"].keys()),
            "note": "; ".join(notes),
            "closedAt": now.isoformat(),
            "openedAt": cur["openedAt"],
            "items": {k: dict(v) for k, v in cur["items"].items()},
        })
    data["current"] = {"openedAt": None, "scoreAtOpen": None, "items": {}}
    return data


def set_past_note(data: dict, closed_at: str, note: str) -> dict:
    """Modifie la note libre d'une sortie cloturee -- independamment des
    notes par cible figees a la cloture, pour laisser un vrai journal de bord
    (corriger ou completer apres-coup) sans devoir rouvrir la session."""
    entry = next((p for p in data["past"] if p["closedAt"] == closed_at), None)
    if entry is None:
        raise ValueError(f"aucune sortie cloturee a {closed_at}")
    entry["note"] = note
    return data


def reopen_session(data: dict, closed_at: str) -> dict:
    """Rouvre une sortie cloturee par erreur : la retire de `past` et restaure
    son etat (cibles, coches, notes par cible) comme session en cours.
    Refuse si une session est deja en cours -- il n'y en a jamais deux a la
    fois. Sur une entree ancienne sans `items`/`openedAt` (creee avant ce
    champ), reconstruit des items neufs (non coches, sans note) a partir de
    `targets` plutot que d'echouer."""
    if data["current"]["items"]:
        raise ValueError("une session est deja en cours")
    idx = next((i for i, p in enumerate(data["past"]) if p["closedAt"] == closed_at), None)
    if idx is None:
        raise ValueError(f"aucune sortie cloturee a {closed_at}")
    entry = data["past"].pop(idx)
    items = entry.get("items")
    if not items:
        items = {t: {"addedAt": entry["closedAt"], "done": False, "note": ""} for t in entry["targets"]}
    data["current"] = {
        "openedAt": entry.get("openedAt") or entry["closedAt"],
        "scoreAtOpen": entry["score"],
        "items": items,
    }
    return data
