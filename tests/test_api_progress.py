def test_put_horizon_updates_single_sector(api_client):
    r = api_client.put("/api/horizon", json={"sector": "S", "open": True})
    assert r.status_code == 200
    horizon = r.json()
    assert horizon["S"] is True
    assert horizon["N"] is True  # secteurs par defaut non fournis, inchanges

    state = api_client.get("/api/state").json()
    assert state["horizon"]["S"] is True


def test_put_horizon_rejects_unknown_sector(api_client):
    r = api_client.put("/api/horizon", json={"sector": "NOPE", "open": True})
    assert r.status_code == 422


def test_put_messier_capture_marks_and_unmarks(api_client):
    r = api_client.put("/api/messier/13", json={"captured": True})
    assert r.status_code == 200
    assert r.json() == ["13"]

    r2 = api_client.put("/api/messier/13", json={"captured": False})
    assert r2.status_code == 200
    assert r2.json() == []


def test_put_messier_capture_is_idempotent(api_client):
    api_client.put("/api/messier/13", json={"captured": True})
    r = api_client.put("/api/messier/13", json={"captured": True})
    assert r.json() == ["13"]  # pas de doublon
