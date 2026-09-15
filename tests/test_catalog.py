from pathlib import Path

from catalog import _load_csv

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
