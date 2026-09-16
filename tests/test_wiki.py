import requests

from wiki import target_summary, _clean_extract, wiki_title_candidates


class FakeResponse:
    def __init__(self, payload, status=200):
        self._payload = payload
        self.status_code = status

    def json(self):
        return self._payload


def _query_payload(title="Messier 31", extract="Une galaxie spirale proche.", pageprops=None):
    page = {"title": title, "extract": extract}
    if pageprops is not None:
        page["pageprops"] = pageprops
    return {"query": {"pages": [page]}}


def test_target_summary_tries_french_first(monkeypatch):
    calls = []

    def fake_get(url, params=None, headers=None, timeout=None):
        calls.append(url)
        assert "fr.wikipedia.org" in url
        return FakeResponse(_query_payload())

    monkeypatch.setattr(requests, "get", fake_get)
    result = target_summary(["Messier 31", "M31"])
    assert result["extract"] == "Une galaxie spirale proche."
    assert result["lang"] == "fr"
    assert result["url"] == "https://fr.wikipedia.org/wiki/Messier_31"
    assert len(calls) == 1  # trouve du premier coup, pas d'essai supplementaire


def test_target_summary_falls_back_to_english_when_no_french_page(monkeypatch):
    def fake_get(url, params=None, headers=None, timeout=None):
        if "fr.wikipedia.org" in url:
            return FakeResponse(_query_payload(title="Messier 31", extract=""))
        return FakeResponse(_query_payload(title="Andromeda Galaxy", extract="A spiral galaxy."))

    monkeypatch.setattr(requests, "get", fake_get)
    result = target_summary(["Messier 31", "M31"])
    assert result["lang"] == "en"
    assert result["title"] == "Andromeda Galaxy"


def test_target_summary_skips_disambiguation_pages(monkeypatch):
    def fake_get(url, params=None, headers=None, timeout=None):
        return FakeResponse(_query_payload(title="M1", extract="Peut faire reference a...",
                                            pageprops={"disambiguation": ""}))

    monkeypatch.setattr(requests, "get", fake_get)
    assert target_summary(["M1"]) is None


def test_target_summary_skips_missing_pages(monkeypatch):
    def fake_get(url, params=None, headers=None, timeout=None):
        return FakeResponse({"query": {"pages": [{"title": "Messier 42", "missing": True}]}})

    monkeypatch.setattr(requests, "get", fake_get)
    assert target_summary(["Messier 42"]) is None


def test_target_summary_falls_through_candidates_within_same_language(monkeypatch):
    """M42 : 'Messier 42' absent, 'M42' est une page d'homonymie -- doit
    retomber sur le candidat suivant ('NGC 1976') avant de changer de langue."""
    def fake_get(url, params=None, headers=None, timeout=None):
        title = params["titles"]
        if title == "Messier 42":
            return FakeResponse({"query": {"pages": [{"title": "Messier 42", "missing": True}]}})
        if title == "M42":
            return FakeResponse(_query_payload(title="M42", extract="Homonymie...",
                                                pageprops={"disambiguation": ""}))
        if title == "NGC 1976":
            return FakeResponse(_query_payload(title="Nebuleuse d'Orion", extract="La grande nebuleuse."))
        raise AssertionError(f"unexpected title {title}")

    monkeypatch.setattr(requests, "get", fake_get)
    result = target_summary(["Messier 42", "M42", "NGC 1976"])
    assert result["title"] == "Nebuleuse d'Orion"


def test_target_summary_returns_none_when_nothing_found():
    assert target_summary([]) is None


def test_target_summary_returns_none_on_network_error(monkeypatch):
    def fake_get(*a, **k):
        raise requests.ConnectionError("boom")

    monkeypatch.setattr(requests, "get", fake_get)
    assert target_summary(["M31"]) is None


def test_clean_extract_truncates_at_last_full_sentence_before_math_markup():
    text = ("Premiere phrase complete. Deuxieme phrase complete. Valeur 2,1e9 "
            "{\\displaystyle L_{\\odot }} (reste de formule non nettoye)")
    assert _clean_extract(text) == "Premiere phrase complete. Deuxieme phrase complete."


def test_clean_extract_strips_section_headings():
    text = "Chapeau introductif.\n\n== Presentation ==\n\nDeuxieme paragraphe."
    cleaned = _clean_extract(text)
    assert "==" not in cleaned
    assert "Chapeau introductif." in cleaned
    assert "Deuxieme paragraphe." in cleaned


def test_wiki_title_candidates_orders_messier_first():
    row = {"Cible": None, "Messier": "M31", "Nom commun": "Andromeda Galaxy", "NGC": "NGC0224"}
    assert wiki_title_candidates(row) == ["Messier 31", "M31", "Andromeda Galaxy", "NGC 224"]


def test_wiki_title_candidates_non_messier_target():
    row = {"Cible": "NGC7380", "Messier": None, "Nom commun": "", "NGC": None}
    assert wiki_title_candidates(row) == ["NGC7380"]


def test_wiki_title_candidates_skips_missing_fields():
    assert wiki_title_candidates({"Cible": None, "Messier": None, "Nom commun": "", "NGC": None}) == []
