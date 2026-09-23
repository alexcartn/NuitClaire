def test_get_sessions_returns_empty_defaults(api_client):
    r = api_client.get("/api/sessions")
    assert r.status_code == 200
    assert r.json() == {
        "current": {"openedAt": None, "scoreAtOpen": None, "siteAtOpen": None,
                    "items": [], "freeNotes": [], "timeline": [],
                    "feeling": {"rating": None, "skyQuality": None, "highlight": "", "nextTime": ""}},
        "past": [],
    }


def test_add_item_opens_session_with_current_score(api_client):
    r = api_client.post("/api/sessions/current/items", json={"designation": "M13"})
    assert r.status_code == 200
    data = r.json()
    assert data["current"]["openedAt"] is not None
    assert data["current"]["scoreAtOpen"] is not None
    assert [i["designation"] for i in data["current"]["items"]] == ["M13"]
    assert data["current"]["items"][0]["done"] is False
    assert data["current"]["items"][0]["notes"] == []


def test_add_second_item_does_not_reopen_session(api_client):
    first = api_client.post("/api/sessions/current/items", json={"designation": "M13"}).json()
    second = api_client.post("/api/sessions/current/items", json={"designation": "M27"}).json()
    assert second["current"]["openedAt"] == first["current"]["openedAt"]
    assert second["current"]["scoreAtOpen"] == first["current"]["scoreAtOpen"]
    assert sorted(i["designation"] for i in second["current"]["items"]) == ["M13", "M27"]


def test_update_item_toggles_done(api_client):
    api_client.post("/api/sessions/current/items", json={"designation": "M13"})
    r = api_client.put("/api/sessions/current/items/M13", json={"done": True})
    assert r.status_code == 200
    item = r.json()["current"]["items"][0]
    assert item["done"] is True


def test_update_unknown_item_returns_404(api_client):
    r = api_client.put("/api/sessions/current/items/M13", json={"done": True})
    assert r.status_code == 404


def test_delete_item_removes_it(api_client):
    api_client.post("/api/sessions/current/items", json={"designation": "M13"})
    r = api_client.delete("/api/sessions/current/items/M13")
    assert r.status_code == 200
    assert r.json()["current"]["items"] == []


def test_add_item_note(api_client):
    api_client.post("/api/sessions/current/items", json={"designation": "M13"})
    r = api_client.post("/api/sessions/current/items/M13/notes", json={"text": "Beau ciel"})
    assert r.status_code == 200
    notes = r.json()["current"]["items"][0]["notes"]
    assert len(notes) == 1
    assert notes[0]["text"] == "Beau ciel"
    assert "id" in notes[0] and "at" in notes[0]


def test_add_item_note_unknown_target_returns_404(api_client):
    r = api_client.post("/api/sessions/current/items/M13/notes", json={"text": "x"})
    assert r.status_code == 404


def test_add_multiple_item_notes_accumulate(api_client):
    api_client.post("/api/sessions/current/items", json={"designation": "M13"})
    api_client.post("/api/sessions/current/items/M13/notes", json={"text": "Beau ciel"})
    r = api_client.post("/api/sessions/current/items/M13/notes", json={"text": "Vent qui se leve"})
    notes = r.json()["current"]["items"][0]["notes"]
    assert [n["text"] for n in notes] == ["Beau ciel", "Vent qui se leve"]


def test_delete_item_note(api_client):
    api_client.post("/api/sessions/current/items", json={"designation": "M13"})
    added = api_client.post("/api/sessions/current/items/M13/notes", json={"text": "Beau ciel"}).json()
    note_id = added["current"]["items"][0]["notes"][0]["id"]

    r = api_client.delete(f"/api/sessions/current/items/M13/notes/{note_id}")
    assert r.status_code == 200
    assert r.json()["current"]["items"][0]["notes"] == []


def test_add_free_note_opens_session(api_client):
    r = api_client.post("/api/sessions/current/notes", json={"text": "Ciel finalement degage"})
    assert r.status_code == 200
    data = r.json()
    assert data["current"]["openedAt"] is not None
    assert data["current"]["freeNotes"][0]["text"] == "Ciel finalement degage"


def test_delete_free_note_closes_session_when_it_was_the_only_entry(api_client):
    added = api_client.post("/api/sessions/current/notes", json={"text": "Test"}).json()
    note_id = added["current"]["freeNotes"][0]["id"]

    r = api_client.delete(f"/api/sessions/current/notes/{note_id}")
    assert r.status_code == 200
    data = r.json()
    assert data["current"]["freeNotes"] == []
    assert data["current"]["openedAt"] is None


def test_close_session_moves_items_to_past(api_client):
    api_client.post("/api/sessions/current/items", json={"designation": "M13"})
    api_client.post("/api/sessions/current/items/M13/notes", json={"text": "Belle nuit"})

    r = api_client.post("/api/sessions/current/close")
    assert r.status_code == 200
    data = r.json()
    assert data["current"]["items"] == []
    assert len(data["past"]) == 1
    assert data["past"][0]["targets"] == ["M13"]
    assert data["past"][0]["note"] == "Belle nuit"

    assert api_client.get("/api/sessions").json() == data


def test_close_session_noop_when_nothing_open(api_client):
    r = api_client.post("/api/sessions/current/close")
    assert r.status_code == 200
    assert r.json()["past"] == []


def test_update_past_session_note(api_client):
    api_client.post("/api/sessions/current/items", json={"designation": "M13"})
    closed = api_client.post("/api/sessions/current/close").json()
    closed_at = closed["past"][0]["closedAt"]

    r = api_client.put(f"/api/sessions/past/{closed_at}", json={"note": "Corrige apres coup"})
    assert r.status_code == 200
    assert r.json()["past"][0]["note"] == "Corrige apres coup"


def test_update_unknown_past_session_returns_404(api_client):
    r = api_client.put("/api/sessions/past/2026-01-01T00:00:00", json={"note": "x"})
    assert r.status_code == 404


def test_reopen_past_session_restores_current(api_client):
    api_client.post("/api/sessions/current/items", json={"designation": "M13"})
    api_client.post("/api/sessions/current/items/M13/notes", json={"text": "Belle nuit"})
    api_client.put("/api/sessions/current/items/M13", json={"done": True})
    closed = api_client.post("/api/sessions/current/close").json()
    closed_at = closed["past"][0]["closedAt"]

    r = api_client.post(f"/api/sessions/past/{closed_at}/reopen")
    assert r.status_code == 200
    data = r.json()
    assert data["past"] == []
    item = data["current"]["items"][0]
    assert item["designation"] == "M13"
    assert item["notes"][0]["text"] == "Belle nuit"
    assert item["done"] is True


def test_reopen_past_session_conflicts_when_current_open(api_client):
    api_client.post("/api/sessions/current/items", json={"designation": "M13"})
    closed = api_client.post("/api/sessions/current/close").json()
    closed_at = closed["past"][0]["closedAt"]
    api_client.post("/api/sessions/current/items", json={"designation": "M27"})

    r = api_client.post(f"/api/sessions/past/{closed_at}/reopen")
    assert r.status_code == 409


def test_reopen_unknown_past_session_returns_404(api_client):
    r = api_client.post("/api/sessions/past/2026-01-01T00:00:00/reopen")
    assert r.status_code == 404


def test_current_timeline_merges_item_and_free_notes_sorted(api_client):
    api_client.post("/api/sessions/current/items", json={"designation": "M13"})
    api_client.post("/api/sessions/current/notes", json={"text": "Ciel degage"})
    api_client.post("/api/sessions/current/items/M13/notes", json={"text": "Beau seeing"})

    r = api_client.get("/api/sessions")
    entries = r.json()["current"]["timeline"]
    assert [e["text"] for e in entries] == ["Ciel degage", "Beau seeing"]
    assert entries[0]["target"] is None
    assert entries[1]["target"] == "M13"


def test_past_session_includes_timeline(api_client):
    api_client.post("/api/sessions/current/items", json={"designation": "M13"})
    api_client.post("/api/sessions/current/items/M13/notes", json={"text": "Belle nuit"})
    closed = api_client.post("/api/sessions/current/close").json()

    entries = closed["past"][0]["timeline"]
    assert len(entries) == 1
    assert entries[0]["text"] == "Belle nuit"
    assert entries[0]["target"] == "M13"


def test_new_session_item_has_no_exposure(api_client):
    r = api_client.post("/api/sessions/current/items", json={"designation": "M13"})
    assert r.json()["current"]["items"][0]["exposureMin"] is None


def test_update_item_sets_exposure(api_client):
    api_client.post("/api/sessions/current/items", json={"designation": "M13"})
    r = api_client.put("/api/sessions/current/items/M13", json={"exposureMin": 45})
    assert r.status_code == 200
    assert r.json()["current"]["items"][0]["exposureMin"] == 45


def test_update_item_sets_exposure_and_done_together(api_client):
    api_client.post("/api/sessions/current/items", json={"designation": "M13"})
    r = api_client.put("/api/sessions/current/items/M13", json={"done": True, "exposureMin": 20})
    item = r.json()["current"]["items"][0]
    assert item["done"] is True
    assert item["exposureMin"] == 20


def test_update_unknown_item_exposure_returns_404(api_client):
    r = api_client.put("/api/sessions/current/items/M13", json={"exposureMin": 10})
    assert r.status_code == 404


def test_note_keeps_the_time_it_was_written_not_the_time_it_arrived(api_client):
    """Une saisie faite hors ligne part quand le reseau revient, parfois des
    heures plus tard : c'est l'heure du geste qui doit etre conservee, sinon
    le fil de la nuit se retrouve dans le desordre."""
    api_client.post("/api/sessions/current/notes",
                    json={"text": "buee", "at": "2026-09-21T22:40:03.120000"})
    timeline = api_client.get("/api/sessions").json()["current"]["timeline"]
    assert [n["at"] for n in timeline] == ["2026-09-21T22:40:03.120000"]


def test_note_without_client_time_falls_back_to_server_time(api_client):
    # Chemin Streamlit, qui n'envoie pas d'heure : la saisie ne doit pas
    # echouer pour autant.
    api_client.post("/api/sessions/current/notes", json={"text": "au chaud"})
    assert api_client.get("/api/sessions").json()["current"]["timeline"][0]["at"]


def test_unreadable_client_time_does_not_lose_the_note(api_client):
    api_client.post("/api/sessions/current/notes", json={"text": "horloge cassee", "at": "n'importe quoi"})
    timeline = api_client.get("/api/sessions").json()["current"]["timeline"]
    assert [n["text"] for n in timeline] == ["horloge cassee"]


def test_note_context_is_stored_as_given(api_client):
    context = {"temperatureC": 8.2, "cloudCoverPct": 5.0, "seeing": 2.0,
               "transparency": 3.0, "score": 0.82, "moonIllum": 77.0}
    api_client.post("/api/sessions/current/notes", json={"text": "ca bave", "context": context})
    entry = api_client.get("/api/sessions").json()["current"]["timeline"][0]
    assert entry["context"] == context


def test_note_without_context_keeps_none(api_client):
    api_client.post("/api/sessions/current/notes", json={"text": "sans contexte"})
    assert api_client.get("/api/sessions").json()["current"]["timeline"][0]["context"] is None


def test_item_rating_is_set_and_cleared(api_client):
    api_client.post("/api/sessions/current/items", json={"designation": "M13"})
    api_client.put("/api/sessions/current/items/M13", json={"rating": 4})
    assert api_client.get("/api/sessions").json()["current"]["items"][0]["rating"] == 4
    api_client.put("/api/sessions/current/items/M13", json={"rating": None})
    assert api_client.get("/api/sessions").json()["current"]["items"][0]["rating"] is None


def test_item_rating_outside_range_is_refused(api_client):
    api_client.post("/api/sessions/current/items", json={"designation": "M13"})
    assert api_client.put("/api/sessions/current/items/M13", json={"rating": 9}).status_code == 422


def test_feeling_merges_field_by_field(api_client):
    api_client.post("/api/sessions/current/notes", json={"text": "debut"})
    api_client.put("/api/sessions/current/feeling", json={"rating": 5})
    api_client.put("/api/sessions/current/feeling", json={"highlight": "premiere lumiere"})
    feeling = api_client.get("/api/sessions").json()["current"]["feeling"]
    assert feeling == {"rating": 5, "skyQuality": None, "highlight": "premiere lumiere", "nextTime": ""}


def test_feeling_refused_without_a_session(api_client):
    assert api_client.put("/api/sessions/current/feeling", json={"rating": 5}).status_code == 404


def test_feeling_follows_the_outing_through_close_and_reopen(api_client):
    api_client.post("/api/sessions/current/items", json={"designation": "M13"})
    api_client.put("/api/sessions/current/feeling", json={"rating": 4, "skyQuality": 2,
                                                          "nextTime": "arriver plus tot"})
    closed = api_client.post("/api/sessions/current/close").json()["past"][0]
    assert closed["feeling"]["rating"] == 4
    assert closed["feeling"]["skyQuality"] == 2

    reopened = api_client.post(f"/api/sessions/past/{closed['closedAt']}/reopen").json()
    assert reopened["current"]["feeling"]["nextTime"] == "arriver plus tot"


def test_emptying_a_session_clears_its_feeling(api_client):
    # Sinon une note de satisfaction saisie puis annulee se retrouverait
    # collee a la sortie suivante.
    r = api_client.post("/api/sessions/current/notes", json={"text": "essai"})
    note_id = r.json()["current"]["freeNotes"][0]["id"]
    api_client.put("/api/sessions/current/feeling", json={"rating": 5})
    api_client.delete(f"/api/sessions/current/notes/{note_id}")
    feeling = api_client.get("/api/sessions").json()["current"]["feeling"]
    assert feeling == {"rating": None, "skyQuality": None, "highlight": "", "nextTime": ""}


def test_past_outing_exposes_its_targets_in_detail(api_client):
    # `targets` ne donne que les noms : relire une nuit ou retrouver
    # l'historique d'une cible demande le detail.
    api_client.post("/api/sessions/current/items", json={"designation": "M13"})
    api_client.put("/api/sessions/current/items/M13", json={"exposureMin": 30, "rating": 4})
    api_client.post("/api/sessions/current/items/M13/notes", json={"text": "bien haute"})
    outing = api_client.post("/api/sessions/current/close").json()["past"][0]

    assert [i["designation"] for i in outing["items"]] == ["M13"]
    assert outing["items"][0]["exposureMin"] == 30
    assert outing["items"][0]["rating"] == 4
    assert [n["text"] for n in outing["items"][0]["notes"]] == ["bien haute"]


def test_adding_an_unknown_designation_is_refused(api_client):
    # Depuis que le journal detecte une designation en tete de note, une
    # faute de frappe creerait une cible fantome.
    r = api_client.post("/api/sessions/current/items", json={"designation": "M999"})
    assert r.status_code == 404
    assert api_client.get("/api/sessions").json()["current"]["items"] == []


def test_a_target_is_stored_in_its_catalogue_form(api_client):
    # Sinon « ic434 » et « IC0434 » designeraient deux cibles differentes,
    # avec un temps de pose cumule coupe en deux.
    api_client.post("/api/sessions/current/items", json={"designation": "ic434"})
    api_client.post("/api/sessions/current/items", json={"designation": "m 31"})
    items = api_client.get("/api/sessions").json()["current"]["items"]
    assert [i["designation"] for i in items] == ["IC0434", "M31"]


def test_session_records_where_it_was_opened(api_client):
    """Sans lieu fige, changer de position dans les reglages reecrirait le
    passe : toutes les sorties se retrouveraient au dernier endroit
    configure."""
    api_client.post("/api/sessions/current/notes", json={"text": "en route"})
    site = api_client.get("/api/sessions").json()["current"]["siteAtOpen"]
    assert site is not None
    assert site["name"] and isinstance(site["lat"], float) and isinstance(site["lon"], float)


def test_the_place_follows_the_outing_through_close_and_reopen(api_client):
    api_client.post("/api/sessions/current/items", json={"designation": "M13"})
    opened = api_client.get("/api/sessions").json()["current"]["siteAtOpen"]

    closed = api_client.post("/api/sessions/current/close").json()["past"][0]
    assert closed["site"] == opened

    reopened = api_client.post(f"/api/sessions/past/{closed['closedAt']}/reopen").json()
    assert reopened["current"]["siteAtOpen"] == opened


def test_emptying_a_session_forgets_its_place(api_client):
    r = api_client.post("/api/sessions/current/notes", json={"text": "essai"})
    note_id = r.json()["current"]["freeNotes"][0]["id"]
    api_client.delete(f"/api/sessions/current/notes/{note_id}")
    assert api_client.get("/api/sessions").json()["current"]["siteAtOpen"] is None


def test_a_later_move_does_not_rewrite_a_past_outing(api_client):
    api_client.post("/api/sessions/current/items", json={"designation": "M13"})
    closed = api_client.post("/api/sessions/current/close").json()["past"][0]

    api_client.put("/api/settings", json={"site": {"name": "Ailleurs", "lat": 45.0, "lon": 1.0,
                                                    "elevationM": 300.0, "tz": "Europe/Paris"}})

    still = api_client.get("/api/sessions").json()["past"][0]["site"]
    assert still == closed["site"]
    assert still["name"] != "Ailleurs"
