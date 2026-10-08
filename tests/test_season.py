from datetime import date

from catalog import find_target, load_messier
from optics import binocular_optics, with_optics
from season import circular_runs, messier_season, target_year_windows, workable_days

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


def test_trees_to_the_south_shorten_the_season_of_low_objects():
    open_all = {s: 0.0 for s in ("N", "NE", "E", "SE", "S", "SW", "W", "NW")}
    free = sum(_season(open_all)["M8"]["monthHours"])
    trees = sum(_season({**open_all, "S": 15.0, "SE": 15.0, "SW": 15.0})["M8"]["monthHours"])
    assert trees < free


TODAY = date(2026, 10, 8)
ALL_OPEN = {s: 0.0 for s in ("N", "NE", "E", "SE", "S", "SW", "W", "NW")}


def _year(designation, horizon=None, **kw):
    return target_year_windows(find_target(designation), MARSON, horizon, today=TODAY, **kw)


def test_circular_runs_tells_the_window_already_under_way():
    # Visible aux jours 0-2 et 8-9 d'un cercle de 10 : la plage 8-2 passe par aujourd'hui.
    flags = [True, True, True, False, False, False, False, False, True, True]
    assert circular_runs(flags) == [(-2, 5)]
    assert circular_runs([False, True, True, False, False, True]) == [(1, 2), (5, 1)]
    assert circular_runs([False] * 5) == [] and circular_runs([True] * 5) == [(0, 5)]


def test_workable_days_ignores_one_hour_nights_at_the_edges_but_not_in_the_middle():
    # Des nuits a une heure en bord de saison ne sont pas une fenetre...
    assert not any(workable_days([0] * 8 + [1, 1, 0, 1, 0] + [0] * 8))
    # ... une interruption a une heure par nuit n'en est pas une...
    assert all(workable_days([3, 3, 2, 2, 1, 1, 1, 1, 1, 1, 1, 2, 3, 3]))
    # ... un vrai trou (nuits a zero) si.
    assert workable_days([3, 3, 3, 0, 0, 0, 0, 0, 0, 3, 3, 3])[3:9] == [False] * 6


def test_a_target_that_never_rises_says_so():
    # Nebuleuse de la Carene : declinaison -60, elle ne se leve jamais a 49 deg N.
    year = _year("NGC3372")
    assert year["status"] == "unreachable" and year["windows"] == []
    assert year["culminationDeg"] < 0 and year["minAltDeg"] == 20


def test_a_winter_target_has_a_window_that_is_already_open_in_october():
    year = _year("M42")
    assert year["status"] == "seasonal"
    (window,) = year["windows"]
    assert window["current"]
    assert window["start"] < TODAY.isoformat() <= window["end"]
    assert window["end"][5:7] in ("03", "04")      # mars-avril, pas au-dela
    assert window["start"][5:7] in ("08", "09")
    assert window["peakDate"][5:7] in ("12", "01") and window["peakHours"] >= 6
    assert year["peakDate"] == window["peakDate"]


def test_a_summer_target_gives_its_next_dates():
    year = _year("M16")
    assert year["status"] == "seasonal"
    (window,) = year["windows"]
    assert not window["current"] and window["start"] > TODAY.isoformat()
    assert window["start"][5:7] in ("03", "04") and window["end"][5:7] in ("09", "10")


def test_a_northern_target_is_there_all_year():
    year = _year("NGC7000")
    assert year["status"] == "allYear" and year["windows"] == []
    assert year["peakHours"] > 0


def test_a_closed_horizon_hides_a_target_that_does_rise_high_enough():
    only_north = {s: s in ("N", "NE", "NW") for s in ALL_OPEN}
    year = _year("M8", only_north)
    assert year["culminationDeg"] >= year["minAltDeg"]
    assert year["status"] == "hidden" and year["windows"] == []
    assert _year("M8", ALL_OPEN)["status"] == "seasonal"


def test_the_binoculars_ask_for_their_own_minimum_height():
    optics = binocular_optics({})
    year = target_year_windows(with_optics(find_target("NGC253"), optics), MARSON, None, today=TODAY)
    assert year["minAltDeg"] == optics["min_alt_deg"]
    # Sculpteur (dec -25) culmine a 16 deg : hors de portee du Seestar, pas des jumelles.
    assert _year("NGC253")["status"] == "unreachable"
    assert year["status"] == "seasonal"


def test_api_detail_carries_the_year_windows(api_client):
    never = api_client.get("/api/targets/NGC3372").json()["yearWindow"]
    assert never["status"] == "unreachable" and never["windows"] == []
    # Horizon par defaut (nord et nord-est seulement) : M42 monte au sud.
    assert api_client.get("/api/targets/M42").json()["yearWindow"]["status"] == "hidden"
    for sector in ("E", "SE", "S", "SW", "W"):
        api_client.put("/api/horizon", json={"sector": sector, "open": True})
    m42 = api_client.get("/api/targets/M42").json()["yearWindow"]
    assert m42["status"] == "seasonal" and m42["windows"][0]["start"] < m42["windows"][0]["end"]
    # Les planetes se deplacent : pas de saison fixe a annoncer.
    assert api_client.get("/api/targets/Saturne").json()["yearWindow"] is None
