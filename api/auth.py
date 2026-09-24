"""Jeton d'acces de l'API.

L'API n'avait aucune authentification : le CORS n'empeche que les
navigateurs d'appeler depuis une autre origine, pas un `curl`. Quiconque
connaissait l'URL Vercel pouvait donc lire et reecrire le journal, les
reglages et la progression Messier.

Un seul utilisateur, donc un seul secret partage : `NUITCLAIRE_API_TOKEN`.
Tant qu'il n'est pas defini, rien ne change (dev local, tests, deploiement
existant) -- le poser suffit a fermer l'API. Le mobile ne l'embarque pas dans
son bundle (qui est public) : il est saisi une fois sur le telephone et garde
sur l'appareil (voir mobile/src/components/TokenGate.tsx)."""
import hmac
import os

from fastapi import Header, HTTPException, Request

TOKEN_ENV = "NUITCLAIRE_API_TOKEN"


def require_token(request: Request, authorization: str | None = Header(default=None)) -> None:
    # La tache planifiee a son propre secret (CRON_SECRET, envoye par Vercel
    # Cron) et fait sa verification elle-meme (voir api/routers/push.py).
    if request.url.path.startswith("/api/cron/"):
        return
    expected = os.environ.get(TOKEN_ENV)
    if not expected:
        return
    scheme, _, given = (authorization or "").partition(" ")
    # compare_digest : une comparaison qui s'arrete au premier caractere
    # different laisse deviner le jeton a la duree de la reponse.
    if scheme.lower() != "bearer" or not hmac.compare_digest(given.encode(), expected.encode()):
        raise HTTPException(401, "Code d'acces manquant ou incorrect.")
