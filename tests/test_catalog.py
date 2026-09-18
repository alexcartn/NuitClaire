from pathlib import Path

from catalog import _load_csv, find_target, search_prefix

FIXTURE = Path(__file__).parent / "fixtures" / "sample_catalog.csv"


def test_load_csv_parses_known_fields():
    rows = _load_csv(FIXTURE)
    assert len(rows) == 3
    m31 = next(r for r in rows if r["name"] == "M31")
    assert m31["ra"] == 0.7123
    assert m31["dec"] == 41.685
    assert m31["w"] == 190.0
    assert m31["h"] == 60.0
    assert m31["filter"] == "sans"
    assert m31["messier"] == "31"
    assert m31["common_name"] == "Andromeda Galaxy"
    assert m31["ngc_name"] == "NGC0224"


def test_load_csv_handles_missing_size_as_none():
    rows = _load_csv(FIXTURE)
    double_star = next(r for r in rows if r["name"] == "Winnecke 4")
    assert double_star["w"] is None
    assert double_star["h"] is None


def test_load_csv_handles_missing_ngc_name_as_none():
    # Winnecke 4 (M40) n'a pas de designation NGC/IC standard.
    rows = _load_csv(FIXTURE)
    double_star = next(r for r in rows if r["name"] == "Winnecke 4")
    assert double_star["ngc_name"] is None


def test_find_target_matches_messier_designation_case_and_space_insensitive():
    for query in ("M31", "m31", "M 31", "  m31  "):
        result = find_target(query)
        assert result is not None
        assert result["name"] == "M31"


def test_find_target_matches_ngc_designation_in_broad_catalog():
    result = find_target("NGC 7380")  # Wizard Nebula -- pas de common_name, cf. docs/plans
    assert result is not None
    assert result["ngc_name"] == "NGC7380"


def test_find_target_matches_ic_designation_without_leading_zero():
    # Le catalogue stocke "IC0434" (Flame Nebula), mais on ecrit "IC434".
    result = find_target("IC434")
    assert result is not None
    assert result["ngc_name"] == "IC0434"


def test_find_target_returns_none_when_not_found():
    assert find_target("this is not a real designation") is None


def test_find_target_returns_none_for_empty_query():
    assert find_target("") is None
    assert find_target("   ") is None


def test_search_prefix_matches_multiple_designations():
    names = {tgt["name"] for tgt in search_prefix("M3", limit=20)}
    assert "M3" in names
    assert "M31" in names  # meme prefixe normalise ("M3")
    assert "M13" not in names  # prefixe different


def test_search_prefix_is_case_and_space_insensitive():
    exact = {tgt["name"] for tgt in search_prefix("m31")}
    assert "M31" in exact
    assert {tgt["name"] for tgt in search_prefix("  M31  ")} == exact


def test_search_prefix_matches_ngc_designation():
    names = {tgt.get("ngc_name") for tgt in search_prefix("NGC738")}
    assert "NGC7380" in names


def test_search_prefix_respects_limit():
    results = search_prefix("M", limit=3)
    # "M" seul est sous le seuil (2 caracteres) -- verifie plutot avec un
    # prefixe assez large pour depasser la limite (beaucoup d'objets NGC).
    results = search_prefix("NG", limit=3)
    assert len(results) <= 3


def test_search_prefix_returns_empty_below_min_length():
    assert search_prefix("M") == []
    assert search_prefix("") == []


def test_search_prefix_returns_empty_when_no_match():
    assert search_prefix("ZZ999notreal") == []


def test_search_prefix_never_returns_duplicate_names():
    results = search_prefix("M31")
    names = [tgt["name"] for tgt in results]
    assert len(names) == len(set(names))
