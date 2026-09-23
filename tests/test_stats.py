from datetime import datetime, timedelta

import progress
from sessions import add_item, close_session, default, set_item_exposure
from stats import avg_score_successful, captures_by_month, compute, exposure_by_target, \
    outings_by_month, outings_by_site, successful_outings

NOW = datetime(2026, 9, 16, 22, 0)


def _closed_session(designation: str, score: int, done: bool, closed_at: datetime, exposure: int | None = None):
    # Ouverte deux heures avant sa cloture : c'est l'ouverture qui date la
    # sortie (voir sessions.close_session), comme pour une vraie nuit.
    data = add_item(default(), designation, closed_at - timedelta(hours=2), score_now=score)
    if exposure is not None:
        set_item_exposure(data, designation, exposure)
    if done:
        from sessions import toggle_item
        toggle_item(data, designation)
    close_session(data, closed_at.date(), closed_at)
    return data["past"][0]


def test_outings_by_month_counts_and_sorts_chronologically():
    past = [
        _closed_session("M13", 80, False, datetime(2026, 9, 16, 23, 0)),
        _closed_session("M27", 60, False, datetime(2026, 9, 20, 23, 0)),
        _closed_session("M31", 70, False, datetime(2026, 8, 5, 23, 0)),
    ]
    assert outings_by_month(past) == [{"month": "2026-08", "count": 1}, {"month": "2026-09", "count": 2}]


def test_captures_by_month_only_counts_done_items():
    past = [
        _closed_session("M13", 80, True, datetime(2026, 9, 16, 23, 0)),
        _closed_session("M27", 60, False, datetime(2026, 9, 20, 23, 0)),
    ]
    assert captures_by_month(past) == [{"month": "2026-09", "count": 1}]


def test_successful_outings_requires_at_least_one_done_item():
    past = [
        _closed_session("M13", 80, True, datetime(2026, 9, 16, 23, 0)),
        _closed_session("M27", 60, False, datetime(2026, 9, 20, 23, 0)),
    ]
    assert len(successful_outings(past)) == 1


def test_avg_score_successful_ignores_unsuccessful_and_missing_scores():
    past = [
        _closed_session("M13", 80, True, datetime(2026, 9, 16, 23, 0)),
        _closed_session("M27", 40, True, datetime(2026, 9, 20, 23, 0)),
        _closed_session("M31", 90, False, datetime(2026, 9, 21, 23, 0)),  # pas reussie, ignoree
    ]
    avg, n = avg_score_successful(past)
    assert avg == 60.0
    assert n == 2


def test_avg_score_successful_none_when_no_successful_outings():
    past = [_closed_session("M13", 80, False, datetime(2026, 9, 16, 23, 0))]
    avg, n = avg_score_successful(past)
    assert avg is None
    assert n == 0


def test_exposure_by_target_sorted_by_descending_total():
    data = add_item(default(), "M13", NOW, score_now=80)
    set_item_exposure(data, "M13", 20)
    add_item(data, "M27", NOW, score_now=80)
    set_item_exposure(data, "M27", 45)

    result = exposure_by_target(data, progress.default())

    assert result == [{"designation": "M27", "totalMin": 45}, {"designation": "M13", "totalMin": 20}]


def test_exposure_by_target_combines_session_and_free_log():
    sessions_data = add_item(default(), "M13", NOW, score_now=80)
    set_item_exposure(sessions_data, "M13", 20)
    progress_data = progress.add_exposure(progress.default(), "M13", 15, NOW)
    progress.add_exposure(progress_data, "M27", 10, NOW)

    result = exposure_by_target(sessions_data, progress_data)

    assert result == [{"designation": "M13", "totalMin": 35}, {"designation": "M27", "totalMin": 10}]


def test_compute_aggregates_everything():
    data = add_item(default(), "M13", NOW, score_now=80)
    set_item_exposure(data, "M13", 30)
    from sessions import toggle_item
    toggle_item(data, "M13")
    close_session(data, NOW.date(), datetime(2026, 9, 17, 5, 0))
    progress_data = progress.add_exposure(progress.default(), "M13", 15, NOW)

    result = compute(data, progress_data)

    assert result["totalOutings"] == 1
    assert result["successfulOutings"] == 1
    assert result["avgScoreSuccessful"] == 80.0
    assert result["totalExposureMin"] == 45
    assert result["exposureByTarget"] == [{"designation": "M13", "totalMin": 45}]
    assert result["capturesByMonth"] == [{"month": "2026-09", "count": 1}]
    assert result["outingsByMonth"] == [{"month": "2026-09", "count": 1}]


def test_compute_on_empty_journal():
    result = compute(default(), progress.default())
    assert result == {
        "totalOutings": 0, "outingsByMonth": [], "capturesByMonth": [],
        "successfulOutings": 0, "avgScoreSuccessful": None,
        "avgRating": None, "ratedOutings": 0, "outingsBySite": [],
        "exposureByTarget": [], "totalExposureMin": 0,
    }


def _site(name: str) -> dict:
    return {"name": name, "lat": 48.9, "lon": 4.5, "elevationM": 120.0, "tz": "Europe/Paris"}


def test_outings_by_site_counts_the_most_frequent_first():
    past = [
        {"date": "2026-09-20", "site": _site("Marson")},
        {"date": "2026-08-12", "site": _site("Col du Lautaret")},
        {"date": "2026-07-01", "site": _site("Marson")},
    ]
    assert outings_by_site(past) == [
        {"name": "Marson", "count": 2, "lastDate": "2026-09-20"},
        {"name": "Col du Lautaret", "count": 1, "lastDate": "2026-08-12"},
    ]


def test_outings_without_a_place_are_not_filed_under_an_invented_one():
    # Sorties anterieures a la conservation du lieu.
    past = [{"date": "2026-09-20", "site": None}, {"date": "2026-08-12"}]
    assert outings_by_site(past) == []
