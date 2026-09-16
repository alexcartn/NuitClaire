def test_get_settings_returns_defaults(api_client):
    r = api_client.get("/api/settings")
    assert r.status_code == 200
    data = r.json()
    assert data["windowMode"] == "complete"
    assert data["alerts"] == {"score": True, "dew": False}
    assert data["site"]["name"] == "Marson"
    assert data["site"]["tz"] == "Europe/Paris"
