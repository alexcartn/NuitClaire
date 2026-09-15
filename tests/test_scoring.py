import pandas as pd

from scoring import score_label_fr, best_window, target_windows


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
