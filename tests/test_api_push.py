import notifications

SUB = {"endpoint": "https://push.example/abc", "keys": {"p256dh": "k", "auth": "a"}}


def _configure(monkeypatch):
    monkeypatch.setenv("VAPID_PUBLIC_KEY", "PUBLIC")
    monkeypatch.setenv("VAPID_PRIVATE_KEY", "PRIVATE")


def test_key_is_503_until_configured(api_client, monkeypatch):
    monkeypatch.delenv("VAPID_PUBLIC_KEY", raising=False)
    assert api_client.get("/api/push/key").status_code == 503
    _configure(monkeypatch)
    assert api_client.get("/api/push/key").json() == {"publicKey": "PUBLIC"}


def test_subscribe_then_unsubscribe(api_client):
    assert api_client.post("/api/push/subscriptions", json=SUB).json() == {"subscriptions": 1}
    assert api_client.post("/api/push/subscriptions", json=SUB).json() == {"subscriptions": 1}
    r = api_client.request("DELETE", "/api/push/subscriptions", json={"endpoint": SUB["endpoint"]})
    assert r.json() == {"subscriptions": 0}


def test_test_notification_needs_a_subscriber(api_client, monkeypatch):
    _configure(monkeypatch)
    assert api_client.post("/api/push/test").status_code == 409
    api_client.post("/api/push/subscriptions", json=SUB)
    monkeypatch.setattr(notifications, "send", lambda sub, payload: "ok")
    assert api_client.post("/api/push/test").json()["sent"] == 1


def test_cron_sends_the_score_alert_once_per_night(api_client, monkeypatch):
    _configure(monkeypatch)
    api_client.post("/api/push/subscriptions", json=SUB)
    sent = []
    monkeypatch.setattr(notifications, "send", lambda sub, payload: sent.append(payload) or "ok")
    # Le score reel depend de la Lune du jour : seuil abaisse pour que le
    # test porte sur l'envoi et le dedoublonnage, pas sur la phase lunaire.
    import alerts
    monkeypatch.setattr(alerts, "SCORE_THRESHOLD_PCT", 0)
    first = api_client.get("/api/cron/alerts").json()
    assert first["sent"]["score"]["sent"] == 1
    assert [p["title"] for p in sent] == ["Bonne nuit en vue"]
    api_client.get("/api/cron/alerts")
    assert len(sent) == 1  # pas de doublon au rejeu


def test_cron_requires_its_secret_when_set(api_client, monkeypatch):
    monkeypatch.setenv("CRON_SECRET", "cron")
    monkeypatch.setenv("NUITCLAIRE_API_TOKEN", "api")
    assert api_client.get("/api/cron/alerts").status_code == 401
    assert api_client.get("/api/cron/alerts", headers={"Authorization": "Bearer api"}).status_code == 401
    r = api_client.get("/api/cron/alerts", headers={"Authorization": "Bearer cron"})
    assert r.status_code == 200


def test_push_routes_are_behind_the_api_token(api_client, monkeypatch):
    monkeypatch.setenv("NUITCLAIRE_API_TOKEN", "api")
    assert api_client.post("/api/push/subscriptions", json=SUB).status_code == 401
