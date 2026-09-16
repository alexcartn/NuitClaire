import json
from datetime import date, datetime

from sessions import add_item, close_session, default, load, remove_item, save, set_note, \
    toggle_item, DEFAULT

NOW = datetime(2026, 9, 16, 22, 4)
TODAY = date(2026, 9, 16)


def test_load_returns_default_when_file_missing(tmp_path):
    assert load(tmp_path / "sessions.json") == DEFAULT


def test_save_then_load_roundtrip(tmp_path):
    path = tmp_path / "sessions.json"
    data = add_item(default(), "M13", NOW, score_now=80)
    save(data, path)
    assert load(path) == data


def test_load_falls_back_to_default_on_invalid_json(tmp_path):
    path = tmp_path / "sessions.json"
    path.write_text("{not valid json", encoding="utf-8")
    assert load(path) == DEFAULT


def test_load_falls_back_to_default_on_non_dict_json(tmp_path):
    path = tmp_path / "sessions.json"
    path.write_text(json.dumps([1, 2, 3]), encoding="utf-8")
    assert load(path) == DEFAULT


def test_load_recovers_missing_items_dict(tmp_path):
    path = tmp_path / "sessions.json"
    path.write_text(json.dumps({"current": {"openedAt": None}}), encoding="utf-8")
    data = load(path)
    assert data["current"]["items"] == {}


def test_add_item_opens_session_on_first_item_only():
    data = default()
    add_item(data, "M13", NOW, score_now=80)
    assert data["current"]["openedAt"] == NOW.isoformat()
    assert data["current"]["scoreAtOpen"] == 80

    later = datetime(2026, 9, 16, 22, 50)
    add_item(data, "M27", later, score_now=42)  # deuxieme cible : ne rouvre pas
    assert data["current"]["openedAt"] == NOW.isoformat()
    assert data["current"]["scoreAtOpen"] == 80
    assert set(data["current"]["items"]) == {"M13", "M27"}


def test_add_item_is_idempotent():
    data = default()
    add_item(data, "M13", NOW, score_now=80)
    add_item(data, "M13", datetime(2026, 9, 16, 23, 0), score_now=80)
    assert len(data["current"]["items"]) == 1
    assert data["current"]["items"]["M13"]["addedAt"] == NOW.isoformat()  # pas ecrase


def test_toggle_item_flips_done():
    data = add_item(default(), "M13", NOW, score_now=80)
    toggle_item(data, "M13")
    assert data["current"]["items"]["M13"]["done"] is True
    toggle_item(data, "M13")
    assert data["current"]["items"]["M13"]["done"] is False


def test_toggle_item_unknown_designation_is_noop():
    data = default()
    toggle_item(data, "NOPE")  # ne doit pas lever
    assert data == default()


def test_set_note_updates_existing_item():
    data = add_item(default(), "M13", NOW, score_now=80)
    set_note(data, "M13", "Beau seeing")
    assert data["current"]["items"]["M13"]["note"] == "Beau seeing"


def test_remove_item_closes_session_when_last_item():
    data = add_item(default(), "M13", NOW, score_now=80)
    remove_item(data, "M13")
    assert data["current"]["items"] == {}
    assert data["current"]["openedAt"] is None
    assert data["current"]["scoreAtOpen"] is None


def test_remove_item_keeps_session_open_when_items_remain():
    data = add_item(default(), "M13", NOW, score_now=80)
    add_item(data, "M27", NOW, score_now=80)
    remove_item(data, "M13")
    assert data["current"]["openedAt"] == NOW.isoformat()
    assert list(data["current"]["items"]) == ["M27"]


def test_close_session_snapshots_into_past_and_resets_current():
    data = add_item(default(), "M13", NOW, score_now=80)
    add_item(data, "M27", NOW, score_now=80)
    set_note(data, "M13", "Beau seeing")

    close_session(data, TODAY, datetime(2026, 9, 17, 5, 30))

    assert data["current"] == {"openedAt": None, "scoreAtOpen": None, "items": {}}
    assert len(data["past"]) == 1
    entry = data["past"][0]
    assert entry["date"] == "2026-09-16"
    assert entry["score"] == 80
    assert entry["targets"] == ["M13", "M27"]
    assert entry["note"] == "Beau seeing"


def test_close_session_noop_when_current_is_empty():
    data = default()
    close_session(data, TODAY, datetime(2026, 9, 17, 5, 30))
    assert data["past"] == []


def test_close_session_inserts_most_recent_first():
    data = add_item(default(), "M13", NOW, score_now=80)
    close_session(data, date(2026, 9, 13), datetime(2026, 9, 13, 23, 0))
    add_item(data, "M27", NOW, score_now=60)
    close_session(data, TODAY, datetime(2026, 9, 17, 5, 30))
    assert [p["date"] for p in data["past"]] == ["2026-09-16", "2026-09-13"]
