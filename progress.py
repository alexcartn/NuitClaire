"""Persistance locale : secteurs d'horizon degages, Messiers captures, et
journal d'expo par cible (`exposure_log`).

`exposure_log` est un complement independant du temps d'expo par session
(voir `sessions.py`, `set_item_exposure`) : ce dernier suit le rythme d'une
sortie (ouverte/cloturee), alors qu'ici chaque entree n'est qu'une addition
libre, sans notion de nuit -- pratique pour rattraper des prises anterieures
a l'usage de l'appli (rien a "ouvrir", juste une cible et des minutes) ou
pour logger depuis la fiche detail d'une cible plutot que depuis le journal.
Les deux sources sont sommees par `stats.py` pour le total par cible."""
import json
import os
from datetime import datetime
from pathlib import Path
from types import MappingProxyType
from uuid import uuid4

import db

PROGRESS_PATH = Path(__file__).parent / "data" / "progress.json"

# Source de verite interne, totalement figee (MappingProxyType) : aucun code,
# y compris ce module, ne peut la muter par accident. N'y accedez jamais
# directement en dehors de default() ci-dessous.
# Le sous-dict "horizon" duplique intentionnellement config.DEFAULT_HORIZON
# (repli utilise ici quand aucun progress.json n'existe encore) : garder les
# deux synchronises.
_DEFAULT_FROZEN = MappingProxyType({
    "horizon": MappingProxyType({"N": True, "NE": True, "E": False, "SE": False,
                                  "S": False, "SW": False, "W": False, "NW": False}),
    "messier_captured": (),
    # Messier vus aux jumelles : un objectif a part, « vu » n'est pas
    # « photographie ».
    "messier_seen": (),
    "exposure_log": MappingProxyType({}),
    # Hauteur minimale (deg) au-dessus de laquelle chaque secteur ouvert est
    # vraiment degage : arbres, toits, collines. 0 = jusqu'a l'horizon.
    "horizon_alt": MappingProxyType({s: 0 for s in ("N", "NE", "E", "SE", "S", "SW", "W", "NW")}),
})


def default() -> dict:
    """Retourne une copie fraiche et independante des valeurs par defaut."""
    return {
        "horizon": dict(_DEFAULT_FROZEN["horizon"]),
        "messier_captured": list(_DEFAULT_FROZEN["messier_captured"]),
        "messier_seen": list(_DEFAULT_FROZEN["messier_seen"]),
        "exposure_log": dict(_DEFAULT_FROZEN["exposure_log"]),
        "horizon_alt": dict(_DEFAULT_FROZEN["horizon_alt"]),
    }


# Conserve pour compatibilite (comparaisons `data == DEFAULT`, `dict(DEFAULT)`,
# etc.) : c'est un dict normal et donc techniquement mutable, mais load()/
# save()/toggle_messier() s'appuient uniquement sur default()/_DEFAULT_FROZEN,
# jamais sur cet objet -- le muter directement (ex: DEFAULT["messier_captured"]
# .append(...)) reste une mauvaise idee mais ne corrompra plus les chargements
# futurs. Preferez default() si vous avez besoin d'une copie garantie propre.
DEFAULT = default()


def load(path: Path = PROGRESS_PATH) -> dict:
    """Charge la progression -- depuis Supabase si configure (voir db.py),
    sinon depuis `path`. Retombe sur les valeurs par defaut si la source est
    absente, illisible ou corrompue (JSON invalide ou racine non-objet),
    pour ne jamais faire planter l'appli sur des donnees editees a la main."""
    raw = db.load_blob("progress") if db.enabled() else _read_file(path)
    if raw is None:
        return default()

    merged = default()
    merged.update(raw)
    # Fusion cle-par-cle de "horizon" pour ne pas perdre les secteurs absents
    # d'une source partielle (un simple dict.update ecraserait tout le sous-dict).
    horizon_override = raw.get("horizon")
    if not isinstance(horizon_override, dict):
        horizon_override = {}
    merged["horizon"] = {**_DEFAULT_FROZEN["horizon"], **horizon_override}

    if not isinstance(merged.get("messier_seen"), list):
        merged["messier_seen"] = []

    alt_override = raw.get("horizon_alt")
    if not isinstance(alt_override, dict):
        alt_override = {}
    merged["horizon_alt"] = {**_DEFAULT_FROZEN["horizon_alt"], **alt_override}

    exposure_override = raw.get("exposure_log")
    merged["exposure_log"] = exposure_override if isinstance(exposure_override, dict) else {}
    return merged


def _read_file(path: Path) -> dict | None:
    if not path.exists():
        return None
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            raise TypeError("le fichier de progression doit contenir un objet JSON")
    except (json.JSONDecodeError, TypeError, ValueError, OSError):
        return None
    return data


def save(data: dict, path: Path = PROGRESS_PATH) -> None:
    """Ecrit la progression -- sur Supabase si configure, sinon sur `path` en
    ecriture atomique (fichier temporaire + `os.replace`) : un crash ou une
    coupure en plein milieu de l'ecriture laisse l'ancien fichier intact
    plutot qu'un JSON tronque -- important maintenant que ce fichier peut
    aussi etre ecrit par l'API mobile (requetes concurrentes possibles,
    contrairement au script Streamlit qui traite une requete a la fois)."""
    if db.enabled():
        db.save_blob("progress", data)
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def toggle_messier(data: dict, messier_id: str) -> dict:
    captured = set(data["messier_captured"])
    if messier_id in captured:
        captured.discard(messier_id)
    else:
        captured.add(messier_id)
    # Tri lexicographique (pas numerique) : "10" passe avant "2". Sans
    # consequence pour l'instant, rien ne depend d'un ordre numerique ici.
    data["messier_captured"] = sorted(captured)
    return data


def add_exposure(data: dict, designation: str, minutes: int, now: datetime) -> dict:
    """Ajoute une entree d'expo libre pour `designation` -- pas de session a
    ouvrir, juste une addition horodatee (meme forme d'entree que les notes
    de sessions.py : id/valeur/horodatage). Plusieurs entrees possibles par
    cible, jamais d'ecrasement -- pratique pour cumuler plusieurs prises
    (avant ou apres l'usage de l'appli) sans devoir tout mettre dans une
    seule valeur."""
    entry = {"id": uuid4().hex, "minutes": minutes, "at": now.isoformat()}
    data["exposure_log"].setdefault(designation, []).append(entry)
    return data


def remove_exposure(data: dict, designation: str, entry_id: str) -> dict:
    """Retire une entree precise (correction d'une saisie erronee) -- sans
    effet si la cible ou l'entree n'existe pas."""
    entries = data["exposure_log"].get(designation)
    if entries is not None:
        data["exposure_log"][designation] = [e for e in entries if e["id"] != entry_id]
    return data


def exposure_totals(data: dict) -> dict[str, int]:
    """Minutes d'expo cumulees par cible, toutes entrees confondues --
    ignore les cibles dont le total tombe a zero (toutes leurs entrees ont
    ete retirees)."""
    totals = {}
    for designation, entries in data["exposure_log"].items():
        total = sum(e["minutes"] for e in entries)
        if total:
            totals[designation] = total
    return totals


def horizon_profile(prog: dict) -> dict:
    """Profil d'horizon utilise par les calculs : pour chaque secteur, la
    hauteur minimale (deg) a partir de laquelle le ciel est libre, ou None si
    le secteur est bouche. Combine les secteurs ouverts/fermes (`horizon`)
    et leurs hauteurs (`horizon_alt`)."""
    return {s: (float(prog["horizon_alt"].get(s, 0) or 0) if is_open else None)
            for s, is_open in prog["horizon"].items()}
