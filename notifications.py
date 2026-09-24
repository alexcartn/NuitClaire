"""Notifications push (Web Push, cle VAPID) : abonnements des telephones et
envoi.

Stockage a part des reglages (`settings.py`) : un abonnement n'est pas un
reglage mais l'adresse d'un appareil, qui change quand le navigateur la
renouvelle, et le store garde aussi la date du dernier envoi de chaque
alerte (pour ne jamais prevenir deux fois pour la meme nuit si la tache
planifiee est rejouee). Meme double persistance que les autres stores :
Supabase si configure (voir db.py), sinon `data/push.json`.

Cles VAPID en environnement (voir scripts/gen_vapid_keys.py) :
VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, et VAPID_SUBJECT (une adresse
`mailto:` que les services push peuvent contacter en cas d'abus)."""
import json
import os
from pathlib import Path

import db

PUSH_PATH = Path(__file__).parent / "data" / "push.json"


def default() -> dict:
    return {"subscriptions": [], "sent": {}}


def load(path: Path = PUSH_PATH) -> dict:
    if db.enabled():
        raw = db.load_blob("push")
    elif path.exists():
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            raw = None
    else:
        raw = None
    data = default()
    if isinstance(raw, dict):
        if isinstance(raw.get("subscriptions"), list):
            data["subscriptions"] = [s for s in raw["subscriptions"] if _valid(s)]
        if isinstance(raw.get("sent"), dict):
            data["sent"] = dict(raw["sent"])
    return data


def save(data: dict, path: Path = PUSH_PATH) -> None:
    if db.enabled():
        db.save_blob("push", data)
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, path)


def _valid(sub) -> bool:
    return (isinstance(sub, dict) and isinstance(sub.get("endpoint"), str)
            and isinstance(sub.get("keys"), dict)
            and all(isinstance(sub["keys"].get(k), str) for k in ("p256dh", "auth")))


def add_subscription(data: dict, sub: dict) -> dict:
    """Ajoute ou remplace (meme endpoint) un abonnement."""
    if not _valid(sub):
        raise ValueError("Abonnement push invalide.")
    clean = {"endpoint": sub["endpoint"], "keys": {"p256dh": sub["keys"]["p256dh"], "auth": sub["keys"]["auth"]}}
    data["subscriptions"] = [s for s in data["subscriptions"] if s["endpoint"] != clean["endpoint"]] + [clean]
    return data


def remove_subscription(data: dict, endpoint: str) -> dict:
    data["subscriptions"] = [s for s in data["subscriptions"] if s["endpoint"] != endpoint]
    return data


def public_key() -> str | None:
    return os.environ.get("VAPID_PUBLIC_KEY") or None


def configured() -> bool:
    return bool(public_key() and os.environ.get("VAPID_PRIVATE_KEY"))


def send(sub: dict, payload: dict) -> str:
    """Envoie `payload` (JSON) a un abonnement. Renvoie "ok", "gone" (le
    service push dit que l'abonnement n'existe plus : a retirer) ou
    "error" (a retenter une autre fois)."""
    from pywebpush import WebPushException, webpush  # import tardif : dependance lourde

    try:
        webpush(
            subscription_info=sub,
            data=json.dumps(payload, ensure_ascii=False),
            vapid_private_key=os.environ["VAPID_PRIVATE_KEY"],
            vapid_claims={"sub": os.environ.get("VAPID_SUBJECT", "mailto:nuitclaire@example.invalid")},
            ttl=6 * 3600,
        )
        return "ok"
    except WebPushException as e:
        status = getattr(e.response, "status_code", None)
        return "gone" if status in (404, 410) else "error"


def broadcast(data: dict, payload: dict) -> dict:
    """Envoie a tous les abonnements, retire ceux que le service declare
    perimes. Renvoie les compteurs ; `data` est modifie en place."""
    sent = failed = 0
    kept = []
    for sub in data["subscriptions"]:
        result = send(sub, payload)
        if result == "ok":
            sent += 1
            kept.append(sub)
        elif result == "error":
            failed += 1
            kept.append(sub)
    removed = len(data["subscriptions"]) - len(kept)
    data["subscriptions"] = kept
    return {"sent": sent, "failed": failed, "removed": removed}
