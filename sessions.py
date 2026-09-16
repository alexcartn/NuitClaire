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
    """Charge le journal depuis `path`. Retombe sur les valeurs par defaut si
    le fichier est absent, illisible ou corrompu."""
    if not path.exists():
        return default()

    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            raise TypeError("le fichier de journal doit contenir un objet JSON")
    except (json.JSONDecodeError, TypeError, ValueError, OSError):
        return default()

    merged = default()
    current_override = data.get("current")
    if isinstance(current_override, dict):
        merged["current"].update(current_override)
        if not isinstance(merged["current"].get("items"), dict):
            merged["current"]["items"] = {}
    past_override = data.get("past")
    if isinstance(past_override, list):
        merged["past"] = past_override
    return merged


def save(data: dict, path: Path = SESSIONS_PATH) -> None:
    """Ecriture atomique (fichier temporaire + `os.replace`)."""
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
    si la session en cours est deja vide."""
    cur = data["current"]
    if cur["items"]:
        notes = [i["note"] for i in cur["items"].values() if i["note"]]
        data["past"].insert(0, {
            "date": today.isoformat(),
            "score": cur["scoreAtOpen"],
            "targets": sorted(cur["items"].keys()),
            "note": "; ".join(notes),
            "closedAt": now.isoformat(),
        })
    data["current"] = {"openedAt": None, "scoreAtOpen": None, "items": {}}
    return data
