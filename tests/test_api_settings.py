def test_get_settings_returns_defaults(api_client):
    r = api_client.get("/api/settings")
    assert r.status_code == 200
    data = r.json()
    assert data["windowMode"] == "complete"
    assert data["alerts"] == {"score": True, "dew": False}
    assert data["site"]["name"] == "Marson"
    assert data["site"]["tz"] == "Europe/Paris"


def test_put_settings_updates_window_mode_and_alerts(api_client):
    r = api_client.put("/api/settings", json={"windowMode": "habituelle", "alerts": {"dew": True}})
    assert r.status_code == 200
    data = r.json()
    assert data["windowMode"] == "habituelle"
    assert data["alerts"] == {"score": True, "dew": True}  # "score" conserve, non fourni

    assert api_client.get("/api/settings").json()["windowMode"] == "habituelle"


def test_put_settings_rejects_invalid_window_mode(api_client):
    r = api_client.put("/api/settings", json={"windowMode": "n-importe-quoi"})
    assert r.status_code == 422


def test_put_settings_site_preserves_elevation_and_timezone(api_client):
    r = api_client.put("/api/settings", json={"site": {"name": "Reims", "lat": 49.26, "lon": 4.03}})
    assert r.status_code == 200
    site = r.json()["site"]
    assert site["name"] == "Reims" and site["lat"] == 49.26 and site["lon"] == 4.03
    assert site["elevationM"] == 100.0 and site["tz"] == "Europe/Paris"  # conserves de config.SITE


def test_post_geocode_returns_coordinates(api_client, monkeypatch):
    import api.routers.settings as settings_router

    monkeypatch.setattr(
        settings_router, "geocode",
        lambda address: {"lat": 48.85, "lon": 2.35, "display_name": "Paris, France"},
    )
    r = api_client.post("/api/geocode", json={"address": "Paris"})
    assert r.status_code == 200
    assert r.json() == {"lat": 48.85, "lon": 2.35, "displayName": "Paris, France"}


def test_post_geocode_returns_422_on_geocode_error(api_client, monkeypatch):
    import api.routers.settings as settings_router
    from geocode import GeocodeError

    def raise_error(address):
        raise GeocodeError("adresse introuvable")

    monkeypatch.setattr(settings_router, "geocode", raise_error)
    r = api_client.post("/api/geocode", json={"address": "???"})
    assert r.status_code == 422
