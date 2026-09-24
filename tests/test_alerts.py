import pandas as pd

from alerts import evaluate, night_facts

FACTS = {"score_pct": 78, "best_window": "22:00–03:00", "moon_illum": 34.6,
         "dew_spread": 1.2, "dew_time": "01:00"}


def test_good_night_sends_score_alert():
    msgs = evaluate("2026-09-24", {"score": True, "dew": False}, FACTS, {})
    assert [m["alert"] for m in msgs] == ["score"]
    assert "78/100" in msgs[0]["body"] and "22:00–03:00" in msgs[0]["body"]


def test_average_night_sends_nothing():
    assert evaluate("2026-09-24", {"score": True}, {**FACTS, "score_pct": 55}, {}) == []


def test_dew_alert_when_spread_below_threshold():
    msgs = evaluate("2026-09-24", {"score": False, "dew": True}, FACTS, {})
    assert msgs[0]["alert"] == "dew"
    assert "1,2 °C vers 01:00" in msgs[0]["body"]
    assert evaluate("2026-09-24", {"dew": True}, {**FACTS, "dew_spread": 2.0}, {}) == []


def test_alert_already_sent_for_this_night_is_not_repeated():
    sent = {"score": "2026-09-24", "dew": "2026-09-23"}
    msgs = evaluate("2026-09-24", {"score": True, "dew": True}, FACTS, sent)
    assert [m["alert"] for m in msgs] == ["dew"]


def test_night_facts_finds_the_smallest_dew_spread():
    idx = pd.date_range("2026-09-24 21:00", periods=3, freq="1h")
    df = pd.DataFrame({"temperature_2m": [10, 8, 7], "dew_point_2m": [5, 6, 6.2]}, index=idx)
    facts = night_facts(df, 70, None, 20)
    assert facts["dew_spread"] == 0.8
    assert facts["dew_time"] == "23:00"
