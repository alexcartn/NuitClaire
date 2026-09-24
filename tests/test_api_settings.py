def test_get_settings_returns_defaults(api_client):
    r = api_client.get("/api/settings")
    assert r.status_code == 200
    data = r.json()
    assert data["windowMode"] == "complete"
    assert data["viewWindow"] == {"startHour": 20.0, "endHour": 22.5}
    assert data["alerts"] == {"score": True, "dew": False}
    assert data["site"]["name"] == "Marson"
    assert data["site"]["tz"] == "Europe/Paris"


def test_put_settings_updates_view_window(api_client):
    r = api_client.put("/api/settings", json={"viewWindow": {"startHour": 21.0, "endHour": 23.0}})
    assert r.status_code == 200
    assert r.json()["viewWindow"] == {"startHour": 21.0, "endHour": 23.0}
    assert api_client.get("/api/settings").json()["viewWindow"] == {"startHour": 21.0, "endHour": 23.0}


def test_put_settings_rejects_view_window_start_after_end(api_client):
    r = api_client.put("/api/settings", json={"viewWindow": {"startHour": 23.0, "endHour": 21.0}})
    assert r.status_code == 422


def test_put_settings_rejects_view_window_start_equal_end(api_client):
    r = api_client.put("/api/settings", json={"viewWindow": {"startHour": 20.0, "endHour": 20.0}})
    assert r.status_code == 422


def test_put_settings_rejects_view_window_out_of_bounds(api_client):
    r = api_client.put("/api/settings", json={"viewWindow": {"startHour": -1.0, "endHour": 22.0}})
    assert r.status_code == 422


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


def test_post_reverse_geocode_returns_place_name(api_client, monkeypatch):
    import api.routers.settings as settings_router

    monkeypatch.setattr(settings_router, "reverse_geocode", lambda lat, lon: "Marson")
    r = api_client.post("/api/geocode/reverse", json={"lat": 48.91, "lon": 4.53})
    assert r.status_code == 200
    assert r.json() == {"name": "Marson"}


def test_post_reverse_geocode_returns_422_on_error(api_client, monkeypatch):
    import api.routers.settings as settings_router
    from geocode import GeocodeError

    def fail(lat, lon):
        raise GeocodeError("Aucun nom de lieu connu a cette position.")

    monkeypatch.setattr(settings_router, "reverse_geocode", fail)
    r = api_client.post("/api/geocode/reverse", json={"lat": 0, "lon": 0})
    assert r.status_code == 422
