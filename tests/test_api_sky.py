from datetime import datetime, timezone

from api.routers.sky import bodies_at

MARSON = {"name": "Marson", "lat": 48.91, "lon": 4.53, "elevation_m": 100, "tz": "Europe/Paris"}


def test_bodies_positions_are_sane():
    b = bodies_at(datetime(2026, 9, 25, 21, 0, tzinfo=timezone.utc), MARSON)
    assert 0 <= b["moon"]["raDeg"] < 360 and -30 <= b["moon"]["decDeg"] <= 30
    assert 0 <= b["moon"]["illum"] <= 100
    names = [p["name"] for p in b["planets"]]
    assert names == ["Mercure", "Vénus", "Mars", "Jupiter", "Saturne"]
    # Les planetes restent pres de l'ecliptique.
    assert all(-30 <= p["decDeg"] <= 30 for p in b["planets"])
    venus = next(p for p in b["planets"] if p["name"] == "Vénus")
    assert venus["mag"] < -3


def test_api_sky_bodies(api_client):
    r = api_client.get("/api/sky/bodies")
    assert r.status_code == 200
    assert "moon" in r.json() and len(r.json()["planets"]) == 5
