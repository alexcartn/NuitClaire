from datetime import date
from functools import lru_cache

import sky_events

SITE = {"name": "Marson", "lat": 48.91, "lon": 4.53, "elevation_m": 120, "tz": "Europe/Paris"}


@lru_cache(maxsize=1)
def _year_2026():
    return tuple(sky_events.upcoming(SITE, date(2026, 1, 1), 365))


def test_known_lunar_eclipses_of_2026():
    eclipses = {e["date"][:10]: e for e in _year_2026() if e["kind"] == "eclipse"}
    # 3 mars : totale, invisible de France (Lune couchee) ; 28 aout :
    # partielle, basse a l'aube.
    assert eclipses["2026-03-03"]["title"] == "Éclipse totale de Lune"
    assert eclipses["2026-03-03"]["visible"] is False
    assert eclipses["2026-08-28"]["title"] == "Éclipse partielle de Lune"
    assert eclipses["2026-08-28"]["visible"] is True


def test_oppositions_and_elision():
    titles = {e["title"]: e["date"][:10] for e in _year_2026() if e["kind"] == "planete"}
    assert titles["Opposition de Neptune"] == "2026-09-26"
    assert titles["Opposition de Saturne"] == "2026-10-04"
    assert "Opposition d'Uranus" in titles


def test_conjunctions_are_given_at_an_observable_moment():
    events = sky_events.upcoming(SITE, date(2026, 9, 28), 30)
    conj = [e for e in events if e["kind"] == "rapprochement"]
    assert conj and all(e["visible"] for e in conj)
    assert any(e["title"].startswith("La Lune à") and "Mars" in e["objects"] for e in conj)


def test_meteor_shower_mentions_the_moon():
    events = sky_events.upcoming(SITE, date(2026, 10, 1), 30)
    orionids = next(e for e in events if e["title"].startswith("Orionides"))
    assert "Lune" in orionids["detail"]
