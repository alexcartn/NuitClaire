def test_get_sessions_returns_empty_defaults(api_client):
    r = api_client.get("/api/sessions")
    assert r.status_code == 200
    assert r.json() == {"current": {"openedAt": None, "scoreAtOpen": None, "items": []}, "past": []}


def test_add_item_opens_session_with_current_score(api_client):
    r = api_client.post("/api/sessions/current/items", json={"designation": "M13"})
    assert r.status_code == 200
    data = r.json()
    assert data["current"]["openedAt"] is not None
    assert data["current"]["scoreAtOpen"] is not None
    assert [i["designation"] for i in data["current"]["items"]] == ["M13"]
    assert data["current"]["items"][0]["done"] is False


def test_add_second_item_does_not_reopen_session(api_client):
    first = api_client.post("/api/sessions/current/items", json={"designation": "M13"}).json()
    second = api_client.post("/api/sessions/current/items", json={"designation": "M27"}).json()
    assert second["current"]["openedAt"] == first["current"]["openedAt"]
    assert second["current"]["scoreAtOpen"] == first["current"]["scoreAtOpen"]
    assert sorted(i["designation"] for i in second["current"]["items"]) == ["M13", "M27"]


def test_update_item_toggles_done_and_sets_note(api_client):
    api_client.post("/api/sessions/current/items", json={"designation": "M13"})
    r = api_client.put("/api/sessions/current/items/M13", json={"done": True, "note": "Beau ciel"})
    assert r.status_code == 200
    item = r.json()["current"]["items"][0]
    assert item["done"] is True
    assert item["note"] == "Beau ciel"


def test_update_unknown_item_returns_404(api_client):
    r = api_client.put("/api/sessions/current/items/M13", json={"done": True})
    assert r.status_code == 404


def test_delete_item_removes_it(api_client):
    api_client.post("/api/sessions/current/items", json={"designation": "M13"})
    r = api_client.delete("/api/sessions/current/items/M13")
    assert r.status_code == 200
    assert r.json()["current"]["items"] == []


def test_close_session_moves_items_to_past(api_client):
    api_client.post("/api/sessions/current/items", json={"designation": "M13"})
    api_client.put("/api/sessions/current/items/M13", json={"note": "Belle nuit"})

    r = api_client.post("/api/sessions/current/close")
    assert r.status_code == 200
    data = r.json()
    assert data["current"]["items"] == []
    assert len(data["past"]) == 1
    assert data["past"][0]["targets"] == ["M13"]
    assert data["past"][0]["note"] == "Belle nuit"

    assert api_client.get("/api/sessions").json() == data


def test_close_session_noop_when_nothing_open(api_client):
    r = api_client.post("/api/sessions/current/close")
    assert r.status_code == 200
    assert r.json()["past"] == []


def test_update_past_session_note(api_client):
    api_client.post("/api/sessions/current/items", json={"designation": "M13"})
    closed = api_client.post("/api/sessions/current/close").json()
    closed_at = closed["past"][0]["closedAt"]

    r = api_client.put(f"/api/sessions/past/{closed_at}", json={"note": "Corrige apres coup"})
    assert r.status_code == 200
    assert r.json()["past"][0]["note"] == "Corrige apres coup"


def test_update_unknown_past_session_returns_404(api_client):
    r = api_client.put("/api/sessions/past/2026-01-01T00:00:00", json={"note": "x"})
    assert r.status_code == 404


def test_reopen_past_session_restores_current(api_client):
    api_client.post("/api/sessions/current/items", json={"designation": "M13"})
    api_client.put("/api/sessions/current/items/M13", json={"note": "Belle nuit", "done": True})
    closed = api_client.post("/api/sessions/current/close").json()
    closed_at = closed["past"][0]["closedAt"]

    r = api_client.post(f"/api/sessions/past/{closed_at}/reopen")
    assert r.status_code == 200
    data = r.json()
    assert data["past"] == []
    item = data["current"]["items"][0]
    assert item["designation"] == "M13"
    assert item["note"] == "Belle nuit"
    assert item["done"] is True


def test_reopen_past_session_conflicts_when_current_open(api_client):
    api_client.post("/api/sessions/current/items", json={"designation": "M13"})
    closed = api_client.post("/api/sessions/current/close").json()
    closed_at = closed["past"][0]["closedAt"]
    api_client.post("/api/sessions/current/items", json={"designation": "M27"})

    r = api_client.post(f"/api/sessions/past/{closed_at}/reopen")
    assert r.status_code == 409


def test_reopen_unknown_past_session_returns_404(api_client):
    r = api_client.post("/api/sessions/past/2026-01-01T00:00:00/reopen")
    assert r.status_code == 404
