from catalog import load_messier
from season import messier_season

MARSON = {"name": "Marson", "lat": 48.91, "lon": 4.53, "elevation_m": 100, "tz": "Europe/Paris"}


def _season(horizon=None):
    return {s["designation"]: s for s in messier_season(load_messier(), MARSON, horizon, year=2026)}


def test_orion_nebula_is_a_winter_object():
    m42 = _season()["M42"]["monthHours"]
    assert m42[0] > 0 and m42[11] > 0      # janvier, decembre
    assert m42[5] == 0 and m42[6] == 0     # juin, juillet


def test_low_summer_messier_is_reachable_thanks_to_the_lower_floor():
    m8 = _season()["M8"]
    assert m8["minAltDeg"] == 12 and m8["reachable"]
    assert m8["bestMonth"] in (6, 7, 8)


def test_messier_too_far_south_is_never_reachable():
    m7 = _season()["M7"]
    assert not m7["reachable"]
    assert m7["bestMonth"] is None and sum(m7["monthHours"]) == 0


def test_closed_horizon_hides_southern_objects():
    only_north = {s: s in ("N", "NE", "NW") for s in ("N", "NE", "E", "SE", "S", "SW", "W", "NW")}
    assert sum(_season(only_north)["M8"]["monthHours"]) == 0


def test_api_season_lists_the_110(api_client):
    rows = api_client.get("/api/messier/season").json()
    assert len(rows) == 110
    assert all(len(r["monthHours"]) == 12 for r in rows)
