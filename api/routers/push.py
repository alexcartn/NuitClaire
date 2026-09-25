"""Notifications push : cle publique, abonnements, envoi de test, et la
tache planifiee qui evalue les alertes de la nuit (voir alerts.py)."""
import hmac
from datetime import datetime
import os
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

import alerts
import notifications
import settings as settings_store
from api.deps import current_night, push_write_lock, site_from_settings
from astro import moon_status
from scoring import night_summary, score_label_fr, view_window_df

router = APIRouter()


class PushKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscription(BaseModel):
    endpoint: str
    keys: PushKeys


class PushEndpoint(BaseModel):
    endpoint: str


def _require_configured() -> None:
    if not notifications.configured():
        raise HTTPException(503, "Notifications non configurées sur le serveur "
                                 "(VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY).")


@router.get("/api/push/key")
def get_public_key() -> dict:
    _require_configured()
    return {"publicKey": notifications.public_key()}


@router.post("/api/push/subscriptions")
def subscribe(body: PushSubscription) -> dict:
    with push_write_lock:
        data = notifications.add_subscription(notifications.load(), body.model_dump())
        notifications.save(data)
    return {"subscriptions": len(data["subscriptions"])}


@router.delete("/api/push/subscriptions")
def unsubscribe(body: PushEndpoint) -> dict:
    with push_write_lock:
        data = notifications.remove_subscription(notifications.load(), body.endpoint)
        notifications.save(data)
    return {"subscriptions": len(data["subscriptions"])}


@router.post("/api/push/test")
def send_test() -> dict:
    _require_configured()
    with push_write_lock:
        data = notifications.load()
        if not data["subscriptions"]:
            raise HTTPException(409, "Aucun appareil abonné.")
        result = notifications.broadcast(data, {
            "title": "NuitClaire", "body": "Les notifications arrivent bien sur ce téléphone.",
            "url": "/", "tag": "test",
        })
        notifications.save(data)
    return result


def _check_cron_auth(authorization: str | None) -> None:
    """Vercel Cron envoie `Authorization: Bearer $CRON_SECRET` quand la
    variable est definie. A defaut, on accepte le code d'acces de l'API
    (voir api/auth.py), pour pouvoir declencher la tache a la main. Sans
    aucun des deux, la route est ouverte, comme le reste de l'API."""
    expected = os.environ.get("CRON_SECRET") or os.environ.get("NUITCLAIRE_API_TOKEN")
    if not expected:
        return
    scheme, _, given = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not hmac.compare_digest(given.encode(), expected.encode()):
        raise HTTPException(401, "Secret de la tâche planifiée manquant ou incorrect.")


@router.get("/api/cron/alerts")
def run_alerts(authorization: str | None = Header(default=None)) -> dict:
    """Evalue les alertes de la nuit et les envoie. Appelee par Vercel Cron
    (vercel.json) une fois par jour en fin d'apres-midi."""
    _check_cron_auth(authorization)
    if not notifications.configured():
        return {"skipped": "notifications non configurées"}
    s = settings_store.load()
    if not any(s["alerts"].values()):
        return {"skipped": "aucune alerte activée"}
    site = site_from_settings(s)
    try:
        sel, df, tw = current_night(site)
    except Exception as e:  # meteo injoignable : on le dit, sans planter
        return {"skipped": f"prévision indisponible ({e.__class__.__name__})"}
    if sel is None:
        return {"skipped": "pas de nuit calculable"}

    view_df = view_window_df(df, s["window_mode"], s["view_window"])
    summary = night_summary(view_df)
    pct, _ = score_label_fr(summary["score"])
    moon = moon_status(tw["astro_dusk"].replace(tzinfo=ZoneInfo(site["tz"])), site=site)
    facts = alerts.night_facts(view_df, pct, summary["best_window"], moon["illum"])

    night = sel.isoformat()
    with push_write_lock:
        data = notifications.load()
        messages = alerts.evaluate(night, s["alerts"], facts, data["sent"])
        if s["alerts"].get("iss"):
            import extras
            from datetime import timezone as _tz

            tle = extras.fetch_iss_tle()
            if tle:
                msg = alerts.iss_message(night, s["alerts"],
                                         extras.iss_passes(tle, site, datetime.now(_tz.utc), days=1),
                                         data["sent"])
                if msg:
                    messages.append(msg)
        results = {}
        for msg in messages:
            results[msg["alert"]] = notifications.broadcast(
                data, {k: msg[k] for k in ("title", "body", "url", "tag")})
            # Marque comme envoyee des qu'un appareil l'a recue : un
            # rejeu de la tache ne doit pas prevenir deux fois.
            if results[msg["alert"]]["sent"] > 0:
                data["sent"][msg["alert"]] = night
        notifications.save(data)
    return {"night": night, "facts": facts, "sent": results}
