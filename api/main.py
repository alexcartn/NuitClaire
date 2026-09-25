"""API FastAPI pour l'appli mobile NuitClaire -- expose la meme logique de
planification que app.py (Streamlit), sans dupliquer le calcul : les deux
frontends appellent les memes fonctions partagees (`scoring.py`, `astro.py`,
`rows.py`, `catalog.py`, `progress.py`, `settings.py`).

Lancement (depuis la racine du depot) : `uvicorn api.main:app --reload --port 8000`.
Documentation interactive : http://localhost:8000/docs
"""
import os
import sys
from pathlib import Path

# Garantit que les modules racine (catalog.py, scoring.py, ...) se resolvent
# quelle que soit la facon dont uvicorn est lance (repertoire courant,
# --app-dir, etc.) -- meme filet de securite que tests/conftest.py.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi import Depends, FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from api.auth import require_token  # noqa: E402
from api.routers import catalog, night, progress, push, sessions, settings, sky, state, stats  # noqa: E402

# Jeton exige sur toutes les routes des que NUITCLAIRE_API_TOKEN est defini
# (voir api/auth.py). Les pre-requetes CORS (OPTIONS) sont traitees par le
# middleware avant d'atteindre les routes : elles passent sans jeton.
app = FastAPI(title="NuitClaire API", dependencies=[Depends(require_token)])

# Origines de dev Vite habituelles (localhost + IP LAN, pour tester depuis un
# telephone sur le meme Wi-Fi) toujours autorisees, plus l'origine de
# production (ex. https://nuitclaire.vercel.app) si ALLOWED_ORIGIN est
# definie -- l'appli reste a usage personnel, pas d'authentification, donc
# pas de restriction plus stricte a faire au-dela de l'origine elle-meme.
_prod_origin = os.environ.get("ALLOWED_ORIGIN")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[_prod_origin] if _prod_origin else [],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+):\d+",
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(night.router)
app.include_router(catalog.router)
app.include_router(settings.router)
app.include_router(state.router)
app.include_router(progress.router)
app.include_router(sessions.router)
app.include_router(stats.router)
app.include_router(push.router)
app.include_router(sky.router)
