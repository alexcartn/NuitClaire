from datetime import date

import bodies

SITE = {"name": "Marson", "lat": 48.91, "lon": 4.53, "elevation_m": 120, "tz": "Europe/Paris"}


def test_search_by_french_or_english_prefix_without_accents():
    assert [b["designation"] for b in bodies.search("lu")] == ["Lune"]
    assert [b["designation"] for b in bodies.search("ven")] == ["Vénus"]
    assert [b["designation"] for b in bodies.search("Saturn")] == ["Saturne"]
    assert bodies.search("m") == []


def test_rise_transit_set_in_order():
    for name in ("Lune", "Jupiter", "Saturne"):
        d = bodies.detail(name, SITE, date(2026, 9, 28))
        assert d["rise"] < d["transit"] < d["set"], name


def test_moon_and_planet_specifics():
    moon = bodies.detail("Lune", SITE, date(2026, 9, 28))
    assert moon["distanceKm"] and 350_000 < moon["distanceKm"] < 410_000 and "nextFull" in moon
    assert len(bodies.detail("Jupiter", SITE, date(2026, 9, 28))["moons"]) == 4
    assert bodies.detail("Saturne", SITE, date(2026, 9, 28))["ringTiltDeg"] > 0
    # Mercure, trop pres du Soleil ce soir-la : pas de creneau.
    assert bodies.detail("Mercure", SITE, date(2026, 9, 28))["visibleFrom"] is None


def test_every_body_has_a_photo():
    for name in bodies.WIKI_TITLES:
        assert bodies.image_url(name).startswith("https://commons.wikimedia.org/wiki/Special:FilePath/")
