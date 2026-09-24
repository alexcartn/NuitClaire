import json
from datetime import datetime

from progress import add_exposure, default, exposure_totals, load, remove_exposure, save, \
    toggle_messier, DEFAULT

NOW = datetime(2026, 9, 16, 22, 0)


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


# --- Journal d'expo libre par cible ---

def test_add_exposure_appends_entry():
    data = default()
    add_exposure(data, "M31", 30, NOW)
    entries = data["exposure_log"]["M31"]
    assert len(entries) == 1
    assert entries[0]["minutes"] == 30
    assert entries[0]["at"] == NOW.isoformat()
    assert "id" in entries[0]


def test_add_exposure_multiple_entries_accumulate_without_overwriting():
    data = default()
    add_exposure(data, "M31", 30, NOW)
    add_exposure(data, "M31", 45, datetime(2026, 9, 20, 21, 0))
    assert [e["minutes"] for e in data["exposure_log"]["M31"]] == [30, 45]


def test_remove_exposure_deletes_matching_id_only():
    data = default()
    add_exposure(data, "M31", 30, NOW)
    add_exposure(data, "M31", 45, NOW)
    entry_id = data["exposure_log"]["M31"][0]["id"]

    remove_exposure(data, "M31", entry_id)

    remaining = data["exposure_log"]["M31"]
    assert len(remaining) == 1
    assert remaining[0]["minutes"] == 45


def test_remove_exposure_unknown_target_is_noop():
    data = default()
    remove_exposure(data, "NOPE", "some-id")  # ne doit pas lever
    assert data == default()


def test_exposure_totals_sums_per_target_and_skips_zero():
    data = default()
    add_exposure(data, "M31", 30, NOW)
    add_exposure(data, "M31", 20, NOW)
    add_exposure(data, "M13", 15, NOW)
    entry_id = data["exposure_log"]["M13"][0]["id"]
    remove_exposure(data, "M13", entry_id)  # M13 retombe a zero -> exclu

    assert exposure_totals(data) == {"M31": 50}


def test_load_defaults_exposure_log_to_empty_dict(tmp_path):
    path = tmp_path / "progress.json"
    path.write_text(json.dumps({"messier_captured": ["1"]}), encoding="utf-8")
    assert load(path)["exposure_log"] == {}


def test_save_then_load_roundtrips_exposure_log(tmp_path):
    path = tmp_path / "progress.json"
    data = add_exposure(default(), "M31", 30, NOW)
    save(data, path)
    assert load(path)["exposure_log"] == {"M31": [
        {"id": data["exposure_log"]["M31"][0]["id"], "minutes": 30, "at": NOW.isoformat()},
    ]}


def test_load_falls_back_to_empty_exposure_log_when_malformed(tmp_path):
    path = tmp_path / "progress.json"
    path.write_text(json.dumps({"exposure_log": ["not", "a", "dict"]}), encoding="utf-8")
    assert load(path)["exposure_log"] == {}


def test_horizon_profile_combines_open_sectors_and_heights():
    from progress import default, horizon_profile

    prog = default()
    prog["horizon"]["S"] = True
    prog["horizon_alt"]["S"] = 20
    profile = horizon_profile(prog)
    assert profile["S"] == 20.0
    assert profile["N"] == 0.0      # ouvert par defaut, sans hauteur
    assert profile["E"] is None     # ferme par defaut
