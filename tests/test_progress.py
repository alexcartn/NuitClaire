import json

from progress import default, load, save, toggle_messier, DEFAULT


def test_load_returns_default_when_file_missing(tmp_path):
    data = load(tmp_path / "progress.json")
    assert data == DEFAULT


def test_save_then_load_roundtrip(tmp_path):
    path = tmp_path / "progress.json"
    data = dict(DEFAULT)
    data["messier_captured"] = ["31", "42"]
    save(data, path)
    assert load(path) == data


def test_load_merges_missing_keys_with_defaults(tmp_path):
    path = tmp_path / "progress.json"
    path.write_text(json.dumps({"messier_captured": ["1"]}), encoding="utf-8")
    data = load(path)
    assert data["messier_captured"] == ["1"]
    assert data["horizon"] == DEFAULT["horizon"]


def test_toggle_messier_adds_and_removes():
    data = {"horizon": {}, "messier_captured": ["31"]}
    toggle_messier(data, "42")
    assert data["messier_captured"] == ["31", "42"]
    toggle_messier(data, "31")
    assert data["messier_captured"] == ["42"]


# --- Regression tests: corrupted-file handling (Issue 1) ---

def test_load_falls_back_to_default_on_invalid_json(tmp_path):
    path = tmp_path / "progress.json"
    path.write_text("{not valid json", encoding="utf-8")
    assert load(path) == DEFAULT


def test_load_falls_back_to_default_on_non_dict_json(tmp_path):
    path = tmp_path / "progress.json"
    path.write_text(json.dumps(["31", "42"]), encoding="utf-8")
    assert load(path) == DEFAULT


# --- Regression test: partial "horizon" must not drop sibling sectors (Issue 2) ---

def test_load_merges_partial_horizon_without_losing_other_sectors(tmp_path):
    path = tmp_path / "progress.json"
    path.write_text(json.dumps({"horizon": {"N": False}}), encoding="utf-8")
    data = load(path)
    assert data["horizon"]["N"] is False
    for sector in ("NE", "E", "SE", "S", "SW", "W", "NW"):
        assert data["horizon"][sector] == DEFAULT["horizon"][sector]


# --- Regression test: mutating the public DEFAULT must not corrupt future
# defaults/loads (Issue 3) ---

def test_mutating_public_default_does_not_corrupt_future_defaults(tmp_path):
    DEFAULT["messier_captured"].append("999")
    try:
        assert default()["messier_captured"] == []
        assert load(tmp_path / "progress.json")["messier_captured"] == []
    finally:
        DEFAULT["messier_captured"].remove("999")
