import pandas as pd

from scoring import (score_label_fr, best_window, target_windows, target_altitude_series,
                     recommended_exposure_minutes, wind_quality, target_feasibility_reasons,
                     hourly_score)


def test_score_label_fr_buckets():
    assert score_label_fr(0.85) == (85, "Bonnes conditions")
    assert score_label_fr(0.55) == (55, "Conditions moyennes")
    assert score_label_fr(0.10) == (10, "Mauvaises conditions")
    assert score_label_fr(0.70) == (70, "Bonnes conditions")
    assert score_label_fr(0.40) == (40, "Conditions moyennes")


def test_best_window_finds_longest_contiguous_run():
    idx = pd.date_range("2026-09-15 20:00", periods=6, freq="1h")
    scores = [0.3, 0.7, 0.8, 0.75, 0.4, 0.9]
    df = pd.DataFrame({"score": scores}, index=idx)
    assert best_window(df) == "21:00–00:00"


def test_best_window_returns_none_when_no_good_hours():
    idx = pd.date_range("2026-09-15 20:00", periods=3, freq="1h")
    df = pd.DataFrame({"score": [0.1, 0.2, 0.3]}, index=idx)
    assert best_window(df) is None


def _make_night_df():
    idx = pd.date_range("2026-09-15 20:00", periods=4, freq="1h")
    return pd.DataFrame({
        "score": [0.8, 0.8, 0.8, 0.8],
        "moon_alt": [-10, -10, -10, -10],
        "moon_illum": [20, 20, 20, 20],
    }, index=idx)


def test_wind_quality_ideal_below_10kmh():
    assert wind_quality(0) == 1.0
    assert wind_quality(10) == 1.0


def test_wind_quality_zero_at_and_above_40kmh():
    assert wind_quality(40) == 0.0
    assert wind_quality(60) == 0.0


def test_wind_quality_linear_between_thresholds():
    assert wind_quality(25) == 0.5


def test_target_feasibility_reasons_empty_when_feasible(monkeypatch):
    import scoring

    monkeypatch.setattr(scoring, "target_altaz", lambda *a, **k: (50.0, 180.0))
    monkeypatch.setattr(scoring, "moon_separation", lambda *a, **k: 90.0)

    df = _make_night_df()
    target = {"name": "Test", "ra": 0.0, "dec": 0.0}
    assert target_feasibility_reasons(df, target) == []


def test_target_feasibility_reasons_altitude_never_reached(monkeypatch):
    import scoring

    monkeypatch.setattr(scoring, "target_altaz", lambda *a, **k: (5.0, 180.0))  # sous SEESTAR min_alt_deg
    monkeypatch.setattr(scoring, "moon_separation", lambda *a, **k: 90.0)

    df = _make_night_df()
    target = {"name": "Test", "ra": 0.0, "dec": 0.0}
    reasons = target_feasibility_reasons(df, target)
    assert len(reasons) == 1
    assert "monte jamais" in reasons[0]


def test_target_feasibility_reasons_blocked_horizon_sector(monkeypatch):
    import scoring

    # Bonne altitude, mais uniquement au sud -- si seul le nord est degage,
    # l'altitude est parfois bonne mais jamais dans un secteur ouvert.
    monkeypatch.setattr(scoring, "target_altaz", lambda *a, **k: (50.0, 180.0))
    monkeypatch.setattr(scoring, "moon_separation", lambda *a, **k: 90.0)

    df = _make_night_df()
    target = {"name": "Test", "ra": 0.0, "dec": 0.0}
    horizon_north_only = {"N": True, "NE": False, "E": False, "SE": False,
                           "S": False, "SW": False, "W": False, "NW": False}
    reasons = target_feasibility_reasons(df, target, horizon=horizon_north_only)
    assert len(reasons) == 1
    assert "secteur" in reasons[0]


def test_target_feasibility_reasons_bad_weather_and_moon_both_reported(monkeypatch):
    import scoring

    monkeypatch.setattr(scoring, "target_altaz", lambda *a, **k: (50.0, 180.0))
    monkeypatch.setattr(scoring, "moon_separation", lambda *a, **k: 5.0)  # tres proche

    idx = pd.date_range("2026-09-15 20:00", periods=4, freq="1h")
    df = pd.DataFrame({
        "score": [0.2, 0.2, 0.2, 0.2],  # sous le seuil 0.6
        "moon_alt": [30, 30, 30, 30],  # Lune levee
        "moon_illum": [80, 80, 80, 80],  # brillante
    }, index=idx)
    target = {"name": "Test", "ra": 0.0, "dec": 0.0}
    reasons = target_feasibility_reasons(df, target)
    assert any("meteo" in r for r in reasons)
    assert any("Lune" in r for r in reasons)


def test_target_windows_blocks_hours_outside_open_horizon_sectors(monkeypatch):
    import scoring

    # Force every hour to report the target due south at 50 deg altitude.
    monkeypatch.setattr(scoring, "target_altaz", lambda *a, **k: (50.0, 180.0))
    monkeypatch.setattr(scoring, "moon_separation", lambda *a, **k: 90.0)

    df = _make_night_df()
    target = {"name": "Test", "type": "galaxie", "ra": 0.0, "dec": 0.0, "w": 10, "h": 10,
              "filter": "sans"}

    horizon_open_south = {"N": False, "NE": False, "E": False, "SE": False,
                           "S": True, "SW": False, "W": False, "NW": False}
    result_open = target_windows(df, target, horizon=horizon_open_south)
    assert result_open["hours"] == 4

    horizon_blocked_south = dict(horizon_open_south)
    horizon_blocked_south["S"] = False
    result_blocked = target_windows(df, target, horizon=horizon_blocked_south)
    assert result_blocked["hours"] == 0


def test_target_altitude_series_is_unfiltered_and_matches_df_index(monkeypatch):
    import scoring

    monkeypatch.setattr(scoring, "target_altaz", lambda *a, **k: (5.0, 90.0))
    monkeypatch.setattr(scoring, "moon_separation", lambda *a, **k: 90.0)

    df = _make_night_df()
    target = {"name": "Test", "ra": 0.0, "dec": 0.0}

    series = target_altitude_series(df, target)

    # Altitude 5deg est sous SEESTAR["min_alt_deg"] (20) : target_windows
    # l'exclurait, mais la serie de detail ne filtre rien.
    assert len(series) == len(df)
    assert list(series.index) == list(df.index)
    assert (series["alt"] == 5.0).all()
    assert (series["sector"] == "E").all()


def test_recommended_exposure_minutes_at_reference_magnitude_returns_base_range():
    assert recommended_exposure_minutes("G", 9.5) == (45, 90)
    assert recommended_exposure_minutes("OCl", 6.0) == (10, 20)


def test_recommended_exposure_minutes_scales_with_magnitude():
    low, high = recommended_exposure_minutes("G", 12.5)  # 3 mag plus faible que la reference
    assert (low, high) > (45, 90)


def test_recommended_exposure_minutes_without_magnitude_returns_base_range():
    assert recommended_exposure_minutes("PN", None) == (20, 40)


def test_recommended_exposure_minutes_unknown_type_uses_default():
    assert recommended_exposure_minutes("???", 8.0) == (30, 60)


def test_hourly_score_vetoes_when_low_clouds_opaque():
    # Meme avec le reste de la nuit parfait, une couche basse quasi-opaque
    # (>80%) doit mettre le score a 0 -- avant ce veto, la moyenne ponderee
    # de `clouds` diluait ce cas et le score pouvait remonter a ~0.7+.
    row = pd.Series({
        "cloud_cover_low": 90, "cloud_cover_mid": 0, "cloud_cover_high": 0,
        "moon_alt": -10, "moon_illum": 0,
        "wind_gusts_10m": 0,
        "temperature_2m": 10, "dew_point_2m": 0,
        "seeing": 1, "transparency": 1,
        "precipitation_probability": 0,
    })
    assert hourly_score(row) == 0.0


def test_hourly_score_not_vetoed_when_low_clouds_below_threshold():
    row = pd.Series({
        "cloud_cover_low": 80, "cloud_cover_mid": 0, "cloud_cover_high": 0,
        "moon_alt": -10, "moon_illum": 0,
        "wind_gusts_10m": 0,
        "temperature_2m": 10, "dew_point_2m": 0,
        "seeing": 1, "transparency": 1,
        "precipitation_probability": 0,
    })
    assert hourly_score(row) > 0.0


def test_target_windows_uses_site_timezone_not_frozen_module_tz(monkeypatch):
    # Same bug pattern as astro.twilight_times/night_hours (see
    # tests/test_astro.py): target_windows converts each row's naive
    # timestamp to an aware local datetime before calling target_altaz /
    # moon_separation. If it silently used the frozen module-level TZ
    # (Europe/Paris, imported from astro) instead of deriving the tz from
    # `site`, the timestamps handed to target_altaz would always carry
    # Europe/Paris regardless of which site was requested. We intercept
    # those calls to check the tzinfo actually used.
    import scoring

    captured_tzinfos = []

    def fake_target_altaz(t_local, ra_h, dec_deg, site=None):
        captured_tzinfos.append(t_local.tzinfo)
        return 50.0, 180.0

    monkeypatch.setattr(scoring, "target_altaz", fake_target_altaz)
    monkeypatch.setattr(scoring, "moon_separation", lambda *a, **k: 90.0)

    df = _make_night_df()
    target = {"name": "Test", "type": "galaxie", "ra": 0.0, "dec": 0.0, "w": 10, "h": 10,
              "filter": "sans"}
    tokyo_site = {"name": "Tokyo", "lat": 35.68, "lon": 139.69,
                  "elevation_m": 40, "tz": "Asia/Tokyo"}

    target_windows(df, target, site=tokyo_site)

    assert captured_tzinfos
    assert all(str(tz) == "Asia/Tokyo" for tz in captured_tzinfos)
