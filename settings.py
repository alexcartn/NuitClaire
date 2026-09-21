"""Persistance locale : position active (site), mode de fenetre d'observation
et preferences d'alerte -- distinct de `progress.py` (horizon degage + suivi
Messier) : ce module grandit par ecrasement (un reglage a la fois change de
valeur), `progress.py` par accumulation lente (captures Messier au fil des
sorties) -- deux patterns de croissance differents, deux fichiers separes.

`site: None` signifie "pas de reglage sauvegarde encore" -- l'appelant retombe
alors sur `config.SITE`. Une fois qu'une adresse est geocodee via l'API mobile
(Phase 2), ce champ est rempli et prend le pas sur `config.SITE` a chaque
demarrage, ce qui n'est PAS le cas de `st.session_state.site` de l'appli
Streamlit (ephemere, reinitialise a `config.SITE` a chaque session de
navigateur) -- les deux frontends peuvent donc diverger sur la position
active ; c'est un choix delibere plutot qu'un oubli (voir le plan
d'implementation mobile)."""
import json
import os
from pathlib import Path
from types import MappingProxyType

import db
from config import VIEW_WINDOW

SETTINGS_PATH = Path(__file__).parent / "data" / "settings.json"

_DEFAULT_FROZEN = MappingProxyType({
    "site": None,
    "window_mode": "complete",  # "complete" | "habituelle" -- memes valeurs que app.py
    # Horaires de la fenetre "habituelle" -- seed depuis config.VIEW_WINDOW,
    # mais editables par l'utilisateur (voir PUT /api/settings) : ne pas
    # relire VIEW_WINDOW directement ailleurs que pour ce seed, c'est ce
    # dict-ci qui fait foi une fois un reglage sauvegarde.
    "view_window": MappingProxyType({"start_hour": VIEW_WINDOW["start_hour"],
                                      "end_hour": VIEW_WINDOW["end_hour"]}),
    "alerts": MappingProxyType({"score": True, "dew": False}),
})


def default() -> dict:
    """Retourne une copie fraiche et independante des valeurs par defaut."""
    return {
        "site": None,
        "window_mode": _DEFAULT_FROZEN["window_mode"],
        "view_window": dict(_DEFAULT_FROZEN["view_window"]),
        "alerts": dict(_DEFAULT_FROZEN["alerts"]),
    }


# Voir le commentaire equivalent dans progress.py : conserve pour compat
# (comparaisons `data == DEFAULT`), mais load()/save() ne s'appuient que sur
# default()/_DEFAULT_FROZEN. Preferez default() si vous avez besoin d'une
# copie garantie propre.
DEFAULT = default()


def load(path: Path = SETTINGS_PATH) -> dict:
    """Charge les reglages -- depuis Supabase si configure (voir db.py),
    sinon depuis `path`. Retombe sur les valeurs par defaut si la source est
    absente, illisible ou corrompue (JSON invalide ou racine non-objet),
    pour ne jamais faire planter l'API sur des donnees editees a la main."""
    raw = db.load_blob("settings") if db.enabled() else _read_file(path)
    if raw is None:
        return default()

    merged = default()
    merged.update(raw)
    alerts_override = raw.get("alerts")
    if not isinstance(alerts_override, dict):
        alerts_override = {}
    merged["alerts"] = {**_DEFAULT_FROZEN["alerts"], **alerts_override}

    view_window_override = raw.get("view_window")
    if not isinstance(view_window_override, dict):
        view_window_override = {}
    merged["view_window"] = {**_DEFAULT_FROZEN["view_window"], **view_window_override}
    return merged


def _read_file(path: Path) -> dict | None:
    if not path.exists():
        return None
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            raise TypeError("le fichier de reglages doit contenir un objet JSON")
    except (json.JSONDecodeError, TypeError, ValueError, OSError):
        return None
    return data


def save(data: dict, path: Path = SETTINGS_PATH) -> None:
    """Ecrit les reglages -- sur Supabase si configure, sinon sur `path` en
    ecriture atomique (fichier temporaire + `os.replace`) : un crash ou une
    coupure en plein milieu de l'ecriture laisse l'ancien fichier intact
    plutot qu'un JSON tronque -- important une fois ce fichier ecrit par une
    API qui peut recevoir plusieurs requetes concurrentes (contrairement au
    script Streamlit, execute une requete a la fois)."""
    if db.enabled():
        db.save_blob("settings", data)
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)
