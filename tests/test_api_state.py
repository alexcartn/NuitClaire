def test_get_state_returns_default_site_horizon_and_progress(api_client):
    r = api_client.get("/api/state")
    assert r.status_code == 200
    data = r.json()
    assert data["site"] == {"name": "Marson", "lat": 48.9124, "lon": 4.529,
                             "elevationM": 100.0, "tz": "Europe/Paris"}
    assert data["horizon"] == {"N": True, "NE": True, "E": False, "SE": False,
                                "S": False, "SW": False, "W": False, "NW": False}
    assert data["windowMode"] == "complete"
    assert data["messierCaptured"] == []
