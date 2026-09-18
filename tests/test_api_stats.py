def test_stats_empty_journal(api_client):
    r = api_client.get("/api/stats")
    assert r.status_code == 200
    assert r.json() == {
        "totalOutings": 0, "outingsByMonth": [], "capturesByMonth": [],
        "successfulOutings": 0, "avgScoreSuccessful": None,
        "exposureByTarget": [], "totalExposureMin": 0,
    }


def test_stats_reflects_closed_session_with_exposure(api_client):
    api_client.post("/api/sessions/current/items", json={"designation": "M13"})
    api_client.put("/api/sessions/current/items/M13", json={"done": True, "exposureMin": 30})
    api_client.post("/api/sessions/current/close")

    r = api_client.get("/api/stats")
    data = r.json()

    assert data["totalOutings"] == 1
    assert data["successfulOutings"] == 1
    assert data["avgScoreSuccessful"] is not None
    assert data["totalExposureMin"] == 30
    assert data["exposureByTarget"] == [{"designation": "M13", "totalMin": 30}]


def test_stats_exposure_accumulates_across_outings(api_client):
    api_client.post("/api/sessions/current/items", json={"designation": "M13"})
    api_client.put("/api/sessions/current/items/M13", json={"exposureMin": 20})
    api_client.post("/api/sessions/current/close")

    api_client.post("/api/sessions/current/items", json={"designation": "M13"})
    api_client.put("/api/sessions/current/items/M13", json={"exposureMin": 25})

    r = api_client.get("/api/stats")
    assert r.json()["exposureByTarget"] == [{"designation": "M13", "totalMin": 45}]
