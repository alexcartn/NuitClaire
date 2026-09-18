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


def test_add_target_exposure_returns_new_entry(api_client):
    r = api_client.post("/api/progress/exposure/M31", json={"minutes": 30})
    assert r.status_code == 200
    entries = r.json()
    assert len(entries) == 1
    assert entries[0]["minutes"] == 30
    assert "id" in entries[0] and "at" in entries[0]


def test_add_target_exposure_accumulates_multiple_entries(api_client):
    api_client.post("/api/progress/exposure/M31", json={"minutes": 30})
    r = api_client.post("/api/progress/exposure/M31", json={"minutes": 15})
    assert [e["minutes"] for e in r.json()] == [30, 15]


def test_add_target_exposure_rejects_non_positive_minutes(api_client):
    r = api_client.post("/api/progress/exposure/M31", json={"minutes": 0})
    assert r.status_code == 422


def test_delete_target_exposure_removes_matching_entry(api_client):
    added = api_client.post("/api/progress/exposure/M31", json={"minutes": 30}).json()
    entry_id = added[0]["id"]

    r = api_client.delete(f"/api/progress/exposure/M31/{entry_id}")
    assert r.status_code == 200
    assert r.json() == []


def test_delete_target_exposure_unknown_entry_is_noop(api_client):
    api_client.post("/api/progress/exposure/M31", json={"minutes": 30})
    r = api_client.delete("/api/progress/exposure/M31/not-a-real-id")
    assert r.status_code == 200
    assert len(r.json()) == 1
