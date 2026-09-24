def test_api_is_open_when_no_token_is_configured(api_client, monkeypatch):
    monkeypatch.delenv("NUITCLAIRE_API_TOKEN", raising=False)
    assert api_client.get("/api/state").status_code == 200


def test_api_rejects_missing_or_wrong_token(api_client, monkeypatch):
    monkeypatch.setenv("NUITCLAIRE_API_TOKEN", "s3cret")
    assert api_client.get("/api/state").status_code == 401
    assert api_client.get("/api/state", headers={"Authorization": "Bearer nope"}).status_code == 401
    # Le jeton seul, sans le schema, ne passe pas non plus.
    assert api_client.get("/api/state", headers={"Authorization": "s3cret"}).status_code == 401


def test_api_accepts_the_configured_token(api_client, monkeypatch):
    monkeypatch.setenv("NUITCLAIRE_API_TOKEN", "s3cret")
    r = api_client.get("/api/state", headers={"Authorization": "Bearer s3cret"})
    assert r.status_code == 200


def test_writes_are_protected_too(api_client, monkeypatch):
    monkeypatch.setenv("NUITCLAIRE_API_TOKEN", "s3cret")
    r = api_client.post("/api/sessions/current/notes", json={"text": "intrus"})
    assert r.status_code == 401
