def test_list_targets_returns_camel_case_rows(api_client):
    r = api_client.get("/api/targets")
    assert r.status_code == 200
    rows = r.json()
    assert rows  # le catalogue horizon par defaut (N/NE) a des cibles faisables
    row = rows[0]
    for key in ("designation", "type", "typeCode", "imageUrl", "ra", "dec", "reasons"):
        assert key in row


def test_list_targets_filters_by_type(api_client):
    all_rows = api_client.get("/api/targets").json()
    types_present = {r["type"] for r in all_rows}
    one_type = next(iter(types_present))
    filtered = api_client.get("/api/targets", params={"types": [one_type]}).json()
    assert filtered
    assert all(r["type"] == one_type for r in filtered)


def test_list_messier_only_feasible_filters_out_infeasible(api_client):
    all_rows = api_client.get("/api/messier").json()
    feasible_rows = api_client.get("/api/messier", params={"onlyFeasible": "true"}).json()
    assert len(feasible_rows) <= len(all_rows)
    assert all(r["feasibleTonight"] is True for r in feasible_rows)
    assert any(r["feasibleTonight"] is False for r in all_rows)


def test_search_finds_known_designation(api_client):
    r = api_client.get("/api/search", params={"q": "M31"})
    assert r.status_code == 200
    results = r.json()
    assert len(results) == 1
    assert results[0]["designation"] == "M31"
    assert results[0]["isMessier"] is True


def test_search_unknown_designation_returns_empty_list(api_client):
    r = api_client.get("/api/search", params={"q": "NOTAREALTARGET999"})
    assert r.status_code == 200
    assert r.json() == []


def test_target_detail_includes_altitude_series_and_exposure(api_client, monkeypatch):
    import api.deps as deps
    monkeypatch.setattr(deps, "target_summary", lambda candidates: None)

    r = api_client.get("/api/targets/M31")
    assert r.status_code == 200
    data = r.json()
    assert data["designation"] == "M31"
    assert len(data["altitudeSeries"]) == 12  # grille 19h-6h, voir rows.day_frame
    assert data["exposureLowMin"] > 0 and data["exposureHighMin"] >= data["exposureLowMin"]
    assert data["peakSector"] in ("N", "NE", "E", "SE", "S", "SW", "W", "NW")
    assert data["wiki"] is None
    assert data["exposureLog"] == []
    assert data["exposureTotalMin"] == 0


def test_target_detail_includes_exposure_log_entries(api_client):
    api_client.post("/api/progress/exposure/M31", json={"minutes": 20})
    api_client.post("/api/progress/exposure/M31", json={"minutes": 25})

    r = api_client.get("/api/targets/M31")
    data = r.json()

    assert len(data["exposureLog"]) == 2
    assert data["exposureTotalMin"] == 45


def test_target_detail_unknown_designation_returns_404(api_client):
    r = api_client.get("/api/targets/NOTAREALTARGET999")
    assert r.status_code == 404


def test_search_suggest_returns_multiple_lightweight_matches(api_client):
    # limit eleve : le catalogue est trie par ascension droite, pas par
    # designation, donc "M3" (loin dans le fichier) n'est garanti present
    # qu'avec assez de marge (11 correspondances possibles : M3, M30..M39).
    r = api_client.get("/api/search/suggest", params={"q": "M3", "limit": 20})
    assert r.status_code == 200
    data = r.json()
    designations = {s["designation"] for s in data}
    assert "M3" in designations
    assert "M31" in designations
    # Legeres : pas de fenetre de visibilite, contrairement a /api/search.
    assert "hours" not in data[0]
    assert set(data[0].keys()) == {"designation", "isMessier", "messierId", "commonName", "type"}


def test_search_suggest_respects_limit(api_client):
    r = api_client.get("/api/search/suggest", params={"q": "NG", "limit": 3})
    assert len(r.json()) <= 3


def test_search_suggest_empty_for_no_match(api_client):
    r = api_client.get("/api/search/suggest", params={"q": "ZZ999notreal"})
    assert r.json() == []


def test_search_suggest_requires_min_length_query(api_client):
    r = api_client.get("/api/search/suggest", params={"q": ""})
    assert r.status_code == 422
