import json

from progress import load, save, toggle_messier, DEFAULT


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
