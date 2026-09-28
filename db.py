"""Backend Supabase optionnel pour les stores settings.py/sessions.py/progress.py.

Actif uniquement si SUPABASE_URL et une cle (SUPABASE_SERVICE_ROLE_KEY ou
SUPABASE_KEY) sont definies en environnement -- sinon chaque store retombe
sur son fichier JSON local (voir leurs load()/save()). Une seule table
generique `app_state` (voir supabase/schema.sql) sert aux trois stores : ils
y ecrivent chacun sous leur propre cle ("settings", "sessions", "progress"),
meme genre de blob que les fichiers JSON qu'ils remplacent.

Necessaire pour deployer l'API sur une plateforme serverless (Vercel) dont
le systeme de fichiers n'est pas persistant entre les invocations --
contrairement a Railway/Fly.io, ou les fichiers JSON locaux suffisaient
jusqu'ici (voir Dockerfile)."""
import os

import requests

_TABLE = "app_state"
_TIMEOUT_S = 10


def enabled() -> bool:
    """Vrai si les identifiants Supabase sont presents en environnement."""
    return bool(_url() and _key())


def _url() -> str | None:
    return os.environ.get("SUPABASE_URL")


def _key() -> str | None:
    return os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")


def _endpoint() -> str:
    return f"{_url().rstrip('/')}/rest/v1/{_TABLE}"


def _headers() -> dict:
    # L'API REST de Supabase (PostgREST), appelee directement : deux
    # requetes suffisent, et le paquet `supabase` pesait ~25 Mo de plus dans
    # chaque deploiement Vercel (authentification, temps reel, stockage...,
    # dont on ne se sert pas).
    key = _key()
    return {"apikey": key, "Authorization": f"Bearer {key}"}


def load_blob(store: str) -> dict | None:
    """Lit le blob JSON associe a `store` ('settings'/'sessions'/'progress').
    Retourne None si aucune ligne n'existe encore pour ce store (premiere
    utilisation), pour que l'appelant puisse retomber sur ses valeurs par
    defaut comme il le ferait pour un fichier absent. Une erreur (reseau,
    identifiants) leve plutot que de retomber en silence sur un fichier
    local : en serverless, il serait ecrit sur un disque ephemere, jamais
    relu."""
    r = requests.get(_endpoint(), headers=_headers(), timeout=_TIMEOUT_S,
                     params={"select": "data", "store": f"eq.{store}", "limit": 1})
    r.raise_for_status()
    rows = r.json() or []
    return rows[0]["data"] if rows else None


def save_blob(store: str, data: dict) -> None:
    """Ecrit (upsert sur la cle primaire `store`) le blob JSON associe a
    `store`."""
    r = requests.post(_endpoint(), timeout=_TIMEOUT_S, params={"on_conflict": "store"},
                      headers={**_headers(), "Prefer": "resolution=merge-duplicates,return=minimal"},
                      json={"store": store, "data": data})
    r.raise_for_status()
