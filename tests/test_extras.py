from datetime import date, datetime, timezone

import requests

import alerts
import extras

MARSON = {"name": "Marson", "lat": 48.91, "lon": 4.53, "elevation_m": 100, "tz": "Europe/Paris"}
# TLE de reference de l'ISS (septembre 2008), sommes de controle valides.
TLE = ["ISS (ZARYA)",
       "1 25544U 98067A   08264.51782528 -.00002182  00000-0 -11606-4 0  2927",
       "2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.72125391563537"]


def test_first_quarter_lights_up_the_central_features():
    # Colongitude 10 : terminateur du matin par 10 deg ouest, juste apres le
    # premier quartier.
    feats = extras.features_near_terminator(10.0, 55)
    assert {"Ptolémée", "Archimède", "Monts Apennins"} <= set(feats)
    assert "Mer des Crises" not in feats  # loin a l'est, en plein soleil


def test_full_moon_has_no_terminator_relief():
    assert extras.features_near_terminator(90.0, 99) == []


def test_moon_tonight_reports_phase_and_times():
    m = extras.moon_tonight(MARSON, date(2026, 9, 19))
    assert 40 <= m["illum"] <= 70 and m["waxing"] is True
    assert m["rise"] and m["set"]
    assert m["terminatorFeatures"]


def test_planets_tonight_are_sane():
    planets = extras.planets_tonight(MARSON, date(2026, 9, 25))
    names = [p["name"] for p in planets]
    assert "Saturne" in names and "Jupiter" in names
    saturn = next(p for p in planets if p["name"] == "Saturne")
    assert saturn["bestAlt"] >= 8 and "ringTiltDeg" in saturn
    jupiter = next(p for p in planets if p["name"] == "Jupiter")
    assert [m["name"] for m in jupiter["moons"]] == ["Io", "Europe", "Ganymède", "Callisto"]


def test_iss_passes_are_visible_evening_passes():
    passes = extras.iss_passes(TLE, MARSON, datetime(2008, 9, 20, 12, tzinfo=timezone.utc))
    assert passes
    for p in passes:
        assert p["start"] < p["peak"] < p["end"]
        assert p["peakAlt"] >= 10
    assert max(p["peakAlt"] for p in passes) >= 50


def test_tle_fetch_keeps_the_last_good_orbit(monkeypatch):
    extras._tle_cache.update(at=0.0, lines=None)

    class Resp:
        text = "\n".join(TLE)

        def raise_for_status(self):
            pass

    monkeypatch.setattr(requests, "get", lambda *a, **k: Resp())
    assert extras.fetch_iss_tle(now=1000.0) == TLE

    def down(*a, **k):
        raise requests.ConnectionError("hors ligne")

    monkeypatch.setattr(requests, "get", down)
    # Cache encore frais : pas de requete ; perime : on garde la derniere.
    assert extras.fetch_iss_tle(now=2000.0) == TLE
    assert extras.fetch_iss_tle(now=1000.0 + extras.TLE_TTL_S + 1) == TLE
    extras._tle_cache.update(at=0.0, lines=None)


def test_iss_alert_picks_tonight_best_pass_once():
    passes = [
        {"peak": "2026-09-25T20:10:00+02:00", "peakAlt": 30, "startDir": "W", "endDir": "E", "brightness": "brillante"},
        {"peak": "2026-09-25T21:45:00+02:00", "peakAlt": 70, "startDir": "SW", "endDir": "NE", "brightness": "très brillante"},
    ]
    msg = alerts.iss_message("2026-09-25", {"iss": True}, passes, {})
    assert "21:45" in msg["body"] and "70°" in msg["body"]
    assert alerts.iss_message("2026-09-25", {"iss": True}, passes, {"iss": "2026-09-25"}) is None
    assert alerts.iss_message("2026-09-25", {"iss": False}, passes, {}) is None


def test_api_extras(api_client, monkeypatch):
    assert api_client.get("/api/extras/moon").status_code == 200
    assert isinstance(api_client.get("/api/extras/planets").json(), list)
    monkeypatch.setattr(extras, "fetch_iss_tle", lambda: None)
    r = api_client.get("/api/extras/iss").json()
    assert r["available"] is False and r["passes"] == []
    monkeypatch.setattr(extras, "fetch_iss_tle", lambda: TLE)
    assert api_client.get("/api/extras/iss").json()["available"] is True
