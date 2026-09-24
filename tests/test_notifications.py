import json

import pytest

import notifications

SUB = {"endpoint": "https://push.example/abc", "keys": {"p256dh": "k", "auth": "a"}}


def test_add_subscription_replaces_same_endpoint():
    data = notifications.default()
    notifications.add_subscription(data, SUB)
    notifications.add_subscription(data, {**SUB, "keys": {"p256dh": "k2", "auth": "a2"}})
    assert len(data["subscriptions"]) == 1
    assert data["subscriptions"][0]["keys"]["p256dh"] == "k2"


def test_add_subscription_rejects_garbage():
    with pytest.raises(ValueError):
        notifications.add_subscription(notifications.default(), {"endpoint": "x"})


def test_broadcast_drops_gone_subscriptions(monkeypatch):
    data = notifications.default()
    notifications.add_subscription(data, SUB)
    notifications.add_subscription(data, {**SUB, "endpoint": "https://push.example/gone"})
    notifications.add_subscription(data, {**SUB, "endpoint": "https://push.example/flaky"})
    outcome = {"https://push.example/abc": "ok", "https://push.example/gone": "gone",
               "https://push.example/flaky": "error"}
    monkeypatch.setattr(notifications, "send", lambda sub, payload: outcome[sub["endpoint"]])
    result = notifications.broadcast(data, {"title": "t"})
    assert result == {"sent": 1, "failed": 1, "removed": 1}
    assert [s["endpoint"] for s in data["subscriptions"]] == [
        "https://push.example/abc", "https://push.example/flaky"]


def test_load_and_save_round_trip(tmp_path, monkeypatch):
    monkeypatch.setattr(notifications.db, "enabled", lambda: False)
    path = tmp_path / "push.json"
    data = notifications.add_subscription(notifications.default(), SUB)
    data["sent"]["score"] = "2026-09-24"
    notifications.save(data, path)
    assert notifications.load(path) == data
    path.write_text("{pas du json")
    assert notifications.load(path) == notifications.default()


def test_send_signs_with_generated_vapid_keys(monkeypatch):
    """Chaine complete sans reseau : cles generees par le script, chiffrement
    et signature VAPID par pywebpush, requete interceptee."""
    import base64

    import requests
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import ec

    from scripts.gen_vapid_keys import generate

    pub, priv = generate()
    monkeypatch.setenv("VAPID_PUBLIC_KEY", pub)
    monkeypatch.setenv("VAPID_PRIVATE_KEY", priv)
    monkeypatch.setenv("VAPID_SUBJECT", "mailto:test@example.org")

    # Cles d'un faux navigateur abonne.
    browser = ec.generate_private_key(ec.SECP256R1())
    p256dh = base64.urlsafe_b64encode(browser.public_key().public_bytes(
        serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)).rstrip(b"=").decode()
    auth = base64.urlsafe_b64encode(b"0123456789abcdef").rstrip(b"=").decode()
    sub = {"endpoint": "https://fcm.googleapis.com/fcm/send/xyz", "keys": {"p256dh": p256dh, "auth": auth}}

    captured = {}

    class Resp:
        status_code = 201
        text = ""
        headers: dict = {}

    def fake_post(url, data=None, headers=None, timeout=None, **kw):
        captured.update(url=url, headers=headers, data=data)
        return Resp()

    monkeypatch.setattr(requests, "post", fake_post)
    assert notifications.send(sub, {"title": "t", "body": json.dumps("é")}) == "ok"
    assert captured["url"] == sub["endpoint"]
    auth_header = captured["headers"].get("Authorization") or captured["headers"].get("authorization")
    assert auth_header.startswith("vapid t=") and f"k={pub}" in auth_header
    assert captured["data"]  # charge utile chiffree
