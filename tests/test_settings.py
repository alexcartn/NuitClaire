import json

from settings import default, load, save, DEFAULT


def test_load_returns_default_when_file_missing(tmp_path):
    data = load(tmp_path / "settings.json")
    assert data == DEFAULT


def test_save_then_load_roundtrip(tmp_path):
    path = tmp_path / "settings.json"
    data = dict(DEFAULT)
    data["window_mode"] = "habituelle"
    data["site"] = {"name": "Reims", "lat": 49.26, "lon": 4.03, "elevation_m": 80, "tz": "Europe/Paris"}
    save(data, path)
    assert load(path) == data


def test_load_merges_missing_keys_with_defaults(tmp_path):
    path = tmp_path / "settings.json"
    path.write_text(json.dumps({"window_mode": "habituelle"}), encoding="utf-8")
    data = load(path)
    assert data["window_mode"] == "habituelle"
    assert data["site"] is None
    assert data["alerts"] == DEFAULT["alerts"]


def test_load_merges_partial_alerts_without_losing_sibling_keys(tmp_path):
    path = tmp_path / "settings.json"
    path.write_text(json.dumps({"alerts": {"dew": True}}), encoding="utf-8")
    data = load(path)
    assert data["alerts"]["dew"] is True
    assert data["alerts"]["score"] == DEFAULT["alerts"]["score"]


def test_load_falls_back_to_default_on_invalid_json(tmp_path):
    path = tmp_path / "settings.json"
    path.write_text("{not valid json", encoding="utf-8")
    assert load(path) == DEFAULT


def test_load_falls_back_to_default_on_non_dict_json(tmp_path):
    path = tmp_path / "settings.json"
    path.write_text(json.dumps(["complete"]), encoding="utf-8")
    assert load(path) == DEFAULT


def test_mutating_public_default_does_not_corrupt_future_defaults(tmp_path):
    DEFAULT["alerts"]["score"] = False
    try:
        assert default()["alerts"]["score"] is True
        assert load(tmp_path / "settings.json")["alerts"]["score"] is True
    finally:
        DEFAULT["alerts"]["score"] = True


def test_save_does_not_leave_tmp_file_behind(tmp_path):
    path = tmp_path / "settings.json"
    save(default(), path)
    assert path.exists()
    assert not path.with_suffix(".json.tmp").exists()
