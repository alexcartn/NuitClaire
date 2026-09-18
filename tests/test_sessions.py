import json
from datetime import date, datetime

from sessions import add_free_note, add_item, add_item_note, close_session, default, \
    exposure_totals, load, remove_free_note, remove_item, remove_item_note, reopen_session, \
    save, set_item_exposure, set_past_note, timeline, toggle_item, DEFAULT

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
    assert data["current"]["freeNotes"] == []


def test_load_migrates_legacy_item_note_string(tmp_path):
    path = tmp_path / "sessions.json"
    path.write_text(json.dumps({
        "current": {
            "openedAt": NOW.isoformat(), "scoreAtOpen": 80,
            "items": {"M13": {"addedAt": NOW.isoformat(), "done": False, "note": "Beau seeing"}},
        },
    }), encoding="utf-8")

    data = load(path)

    notes = data["current"]["items"]["M13"]["notes"]
    assert len(notes) == 1
    assert notes[0]["text"] == "Beau seeing"
    assert "id" in notes[0] and "at" in notes[0]


def test_load_migrates_legacy_item_without_note(tmp_path):
    # Un item legacy sans note du tout (chaine vide) ne doit pas fabriquer
    # une entree de notes vide.
    path = tmp_path / "sessions.json"
    path.write_text(json.dumps({
        "current": {"items": {"M27": {"addedAt": NOW.isoformat(), "done": True, "note": ""}}},
    }), encoding="utf-8")

    data = load(path)

    assert data["current"]["items"]["M27"]["notes"] == []
    assert data["current"]["items"]["M27"]["done"] is True


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


def test_add_item_note_appends_without_overwriting():
    data = add_item(default(), "M13", NOW, score_now=80)
    add_item_note(data, "M13", "Beau seeing", NOW)
    add_item_note(data, "M13", "Vent qui se leve", datetime(2026, 9, 16, 23, 30))

    notes = data["current"]["items"]["M13"]["notes"]
    assert [n["text"] for n in notes] == ["Beau seeing", "Vent qui se leve"]
    assert notes[0]["id"] != notes[1]["id"]


def test_add_item_note_unknown_designation_raises():
    data = default()
    try:
        add_item_note(data, "NOPE", "x", NOW)
        assert False, "aurait du lever ValueError"
    except ValueError:
        pass


def test_remove_item_note_deletes_matching_id_only():
    data = add_item(default(), "M13", NOW, score_now=80)
    add_item_note(data, "M13", "Beau seeing", NOW)
    add_item_note(data, "M13", "Vent qui se leve", NOW)
    note_id = data["current"]["items"]["M13"]["notes"][0]["id"]

    remove_item_note(data, "M13", note_id)

    remaining = data["current"]["items"]["M13"]["notes"]
    assert len(remaining) == 1
    assert remaining[0]["text"] == "Vent qui se leve"


def test_add_free_note_opens_session_when_first_entry():
    data = default()
    add_free_note(data, "Ciel degage inattendu", NOW, score_now=65)
    assert data["current"]["openedAt"] == NOW.isoformat()
    assert data["current"]["scoreAtOpen"] == 65
    assert [n["text"] for n in data["current"]["freeNotes"]] == ["Ciel degage inattendu"]


def test_add_free_note_does_not_reopen_when_session_already_active():
    data = add_item(default(), "M13", NOW, score_now=80)
    later = datetime(2026, 9, 16, 23, 0)
    add_free_note(data, "Nuages en approche", later, score_now=10)
    assert data["current"]["openedAt"] == NOW.isoformat()  # inchange
    assert data["current"]["scoreAtOpen"] == 80  # inchange


def test_remove_free_note_closes_session_when_it_was_the_only_entry():
    data = default()
    add_free_note(data, "Test", NOW, score_now=50)
    note_id = data["current"]["freeNotes"][0]["id"]

    remove_free_note(data, note_id)

    assert data["current"]["freeNotes"] == []
    assert data["current"]["openedAt"] is None
    assert data["current"]["scoreAtOpen"] is None


def test_remove_free_note_keeps_session_open_when_items_remain():
    data = add_item(default(), "M13", NOW, score_now=80)
    add_free_note(data, "Test", NOW, score_now=80)
    note_id = data["current"]["freeNotes"][0]["id"]

    remove_free_note(data, note_id)

    assert data["current"]["openedAt"] == NOW.isoformat()


def test_remove_item_closes_session_when_last_item():
    data = add_item(default(), "M13", NOW, score_now=80)
    remove_item(data, "M13")
    assert data["current"]["items"] == {}
    assert data["current"]["openedAt"] is None
    assert data["current"]["scoreAtOpen"] is None


def test_remove_item_keeps_session_open_when_free_note_remains():
    data = add_item(default(), "M13", NOW, score_now=80)
    add_free_note(data, "Test", NOW, score_now=80)
    remove_item(data, "M13")
    assert data["current"]["openedAt"] == NOW.isoformat()  # la note libre garde la session ouverte


def test_remove_item_keeps_session_open_when_items_remain():
    data = add_item(default(), "M13", NOW, score_now=80)
    add_item(data, "M27", NOW, score_now=80)
    remove_item(data, "M13")
    assert data["current"]["openedAt"] == NOW.isoformat()
    assert list(data["current"]["items"]) == ["M27"]


def test_close_session_snapshots_into_past_and_resets_current():
    data = add_item(default(), "M13", NOW, score_now=80)
    add_item(data, "M27", NOW, score_now=80)
    add_item_note(data, "M13", "Beau seeing", NOW)

    close_session(data, TODAY, datetime(2026, 9, 17, 5, 30))

    assert data["current"] == default()["current"]
    assert len(data["past"]) == 1
    entry = data["past"][0]
    assert entry["date"] == "2026-09-16"
    assert entry["score"] == 80
    assert entry["targets"] == ["M13", "M27"]
    assert entry["note"] == "Beau seeing"
    assert entry["items"]["M13"]["notes"][0]["text"] == "Beau seeing"


def test_close_session_includes_free_notes_in_summary():
    data = default()
    add_free_note(data, "Ciel finalement degage", NOW, score_now=40)
    close_session(data, TODAY, datetime(2026, 9, 17, 5, 30))

    entry = data["past"][0]
    assert entry["targets"] == []
    assert entry["note"] == "Ciel finalement degage"
    assert entry["freeNotes"][0]["text"] == "Ciel finalement degage"


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


def test_set_past_note_updates_matching_entry():
    data = add_item(default(), "M13", NOW, score_now=80)
    close_session(data, TODAY, datetime(2026, 9, 17, 5, 30))
    closed_at = data["past"][0]["closedAt"]

    set_past_note(data, closed_at, "Corrige apres coup")

    assert data["past"][0]["note"] == "Corrige apres coup"


def test_set_past_note_unknown_closed_at_raises():
    data = default()
    try:
        set_past_note(data, "2026-01-01T00:00:00", "x")
        assert False, "aurait du lever ValueError"
    except ValueError:
        pass


def test_reopen_session_restores_items_notes_and_free_notes():
    data = add_item(default(), "M13", NOW, score_now=80)
    add_item_note(data, "M13", "Beau seeing", NOW)
    toggle_item(data, "M13")
    add_free_note(data, "Buee vers minuit", NOW, score_now=80)
    close_session(data, TODAY, datetime(2026, 9, 17, 5, 30))
    closed_at = data["past"][0]["closedAt"]

    reopen_session(data, closed_at)

    assert data["past"] == []
    assert data["current"]["openedAt"] == NOW.isoformat()
    assert data["current"]["scoreAtOpen"] == 80
    assert data["current"]["items"]["M13"]["notes"][0]["text"] == "Beau seeing"
    assert data["current"]["items"]["M13"]["done"] is True
    assert data["current"]["freeNotes"][0]["text"] == "Buee vers minuit"


def test_reopen_session_refuses_when_current_already_open():
    data = add_item(default(), "M13", NOW, score_now=80)
    close_session(data, TODAY, datetime(2026, 9, 17, 5, 30))
    closed_at = data["past"][0]["closedAt"]
    add_item(data, "M27", NOW, score_now=60)  # rouvre une nouvelle session en cours

    try:
        reopen_session(data, closed_at)
        assert False, "aurait du lever ValueError"
    except ValueError:
        pass
    assert len(data["past"]) == 1  # inchange


def test_reopen_session_unknown_closed_at_raises():
    data = default()
    try:
        reopen_session(data, "2026-01-01T00:00:00")
        assert False, "aurait du lever ValueError"
    except ValueError:
        pass


def test_reopen_session_rebuilds_items_for_legacy_entry_without_items():
    data = default()
    data["past"].append({
        "date": "2026-09-10", "score": 55, "targets": ["M27"],
        "note": "vieille entree", "closedAt": "2026-09-10T23:00:00",
    })

    reopen_session(data, "2026-09-10T23:00:00")

    assert data["current"]["items"]["M27"] == {
        "addedAt": "2026-09-10T23:00:00", "done": False, "notes": [], "exposureMin": None,
    }
    assert data["current"]["scoreAtOpen"] == 55
    assert data["current"]["freeNotes"] == []


def test_reopen_session_migrates_legacy_item_note_shape():
    data = default()
    data["past"].append({
        "date": "2026-09-10", "score": 55, "targets": ["M27"], "note": "vieille entree",
        "closedAt": "2026-09-10T23:00:00", "openedAt": "2026-09-10T21:00:00",
        "items": {"M27": {"addedAt": "2026-09-10T21:00:00", "done": False, "note": "vieille entree"}},
    })

    reopen_session(data, "2026-09-10T23:00:00")

    assert data["current"]["items"]["M27"]["notes"][0]["text"] == "vieille entree"


def test_timeline_merges_item_and_free_notes_sorted_by_time():
    data = add_item(default(), "M13", NOW, score_now=80)
    later = datetime(2026, 9, 16, 23, 30)
    earlier = datetime(2026, 9, 16, 21, 0)
    add_item_note(data, "M13", "Beau seeing", later)
    add_free_note(data, "Nuages en approche", earlier, score_now=80)

    entries = timeline(data["current"])

    assert [e["text"] for e in entries] == ["Nuages en approche", "Beau seeing"]
    assert entries[0]["target"] is None
    assert entries[1]["target"] == "M13"


def test_timeline_empty_when_no_notes():
    data = add_item(default(), "M13", NOW, score_now=80)
    assert timeline(data["current"]) == []


def test_timeline_tolerates_legacy_entry_without_items_or_free_notes():
    assert timeline({"date": "2026-09-10", "targets": ["M27"], "note": "vieille entree"}) == []


def test_timeline_works_on_past_entry_after_close():
    data = add_item(default(), "M13", NOW, score_now=80)
    add_item_note(data, "M13", "Beau seeing", NOW)
    add_free_note(data, "Ciel degage", NOW, score_now=80)
    close_session(data, TODAY, datetime(2026, 9, 17, 5, 30))

    entries = timeline(data["past"][0])

    assert {e["text"] for e in entries} == {"Beau seeing", "Ciel degage"}


def test_new_item_has_no_exposure_by_default():
    data = add_item(default(), "M13", NOW, score_now=80)
    assert data["current"]["items"]["M13"]["exposureMin"] is None


def test_set_item_exposure_sets_value():
    data = add_item(default(), "M13", NOW, score_now=80)
    set_item_exposure(data, "M13", 45)
    assert data["current"]["items"]["M13"]["exposureMin"] == 45


def test_set_item_exposure_overwrites_previous_value():
    data = add_item(default(), "M13", NOW, score_now=80)
    set_item_exposure(data, "M13", 20)
    set_item_exposure(data, "M13", 35)
    assert data["current"]["items"]["M13"]["exposureMin"] == 35


def test_set_item_exposure_unknown_designation_raises():
    data = default()
    try:
        set_item_exposure(data, "NOPE", 10)
        assert False, "aurait du lever ValueError"
    except ValueError:
        pass


def test_exposure_totals_empty_when_nothing_set():
    data = add_item(default(), "M13", NOW, score_now=80)
    assert exposure_totals(data) == {}


def test_exposure_totals_sums_current_and_past_sessions():
    data = add_item(default(), "M13", NOW, score_now=80)
    set_item_exposure(data, "M13", 30)
    close_session(data, TODAY, datetime(2026, 9, 17, 5, 30))

    add_item(data, "M13", NOW, score_now=60)
    set_item_exposure(data, "M13", 25)
    add_item(data, "M27", NOW, score_now=60)
    set_item_exposure(data, "M27", 10)

    assert exposure_totals(data) == {"M13": 55, "M27": 10}


def test_exposure_totals_ignores_items_without_exposure():
    data = add_item(default(), "M13", NOW, score_now=80)
    add_item(data, "M27", NOW, score_now=80)
    set_item_exposure(data, "M13", 15)
    assert exposure_totals(data) == {"M13": 15}


def test_migrate_legacy_item_gets_exposure_field():
    data = default()
    data["current"]["items"]["M27"] = {"addedAt": NOW.isoformat(), "done": True, "note": "vieille entree"}
    from sessions import _migrate_item
    migrated = _migrate_item(data["current"]["items"]["M27"])
    assert migrated["exposureMin"] is None
