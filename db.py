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

_TABLE = "app_state"
_client = None
_client_error: Exception | None = None


def enabled() -> bool:
    """Vrai si les identifiants Supabase sont presents en environnement."""
    return bool(_url() and _key())


def _url() -> str | None:
    return os.environ.get("SUPABASE_URL")


def _key() -> str | None:
    return os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")


def _get_client():
    """Cree (et met en cache) le client Supabase. Leve une erreur explicite
    plutot que de retomber silencieusement sur le fichier local si les
    identifiants sont presents mais que le client ne peut pas etre construit
    -- une erreur bruyante au demarrage vaut mieux qu'une perte de donnees
    silencieuse en production serverless (fichier local ecrit sur un disque
    ephemere, jamais relu)."""
    global _client, _client_error
    if _client is not None:
        return _client
    if _client_error is not None:
        raise _client_error
    try:
        from supabase import create_client
    except ImportError as exc:
        _client_error = RuntimeError(
            "SUPABASE_URL/SUPABASE_KEY sont definies mais le paquet 'supabase' "
            "n'est pas installe (pip install -r api/requirements-api.txt)."
        )
        raise _client_error from exc
    try:
        _client = create_client(_url(), _key())
    except Exception as exc:
        _client_error = exc
        raise
    return _client


def load_blob(store: str) -> dict | None:
    """Lit le blob JSON associe a `store` ('settings'/'sessions'/'progress').
    Retourne None si aucune ligne n'existe encore pour ce store (premiere
    utilisation), pour que l'appelant puisse retomber sur ses valeurs par
    defaut comme il le ferait pour un fichier absent."""
    client = _get_client()
    resp = client.table(_TABLE).select("data").eq("store", store).limit(1).execute()
    rows = resp.data or []
    return rows[0]["data"] if rows else None


def save_blob(store: str, data: dict) -> None:
    """Ecrit (upsert) le blob JSON associe a `store`."""
    client = _get_client()
    client.table(_TABLE).upsert({"store": store, "data": data}).execute()
