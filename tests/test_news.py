from datetime import datetime, timezone

import news

RSS = """<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0"><channel>
<item><title><![CDATA[Saturne &agrave; l'opposition]]></title><link>https://ex.fr/a</link>
<description><![CDATA[<p>Les anneaux &eacute;tincellent.</p>]]></description>
<enclosure url="https://ex.fr/a.jpg" type="image/jpeg" /><pubDate>Mon, 28 Sep 2026 09:39:00 +0200</pubDate></item>
<item><title>Vieux sujet</title><link>https://ex.fr/b</link><pubDate>Thu, 18 Jun 2009 08:37:39 +0000</pubDate></item>
<item><title></title><link>https://apod.nasa.gov/apod/ap260927.html</link>
<description>&#60;img src="https://apod.nasa.gov/s.jpg" alt="Andromeda" /&#62;</description></item>
</channel></rss>"""


def test_parse_rss_cleans_titles_and_finds_images():
    items = news.parse_rss("X", RSS)
    assert items[0]["title"] == "Saturne à l'opposition"
    assert items[0]["summary"] == "Les anneaux étincellent."
    assert items[0]["image"] == "https://ex.fr/a.jpg"
    # APOD : titre vide, repris de l'alt ; date tiree du lien.
    assert items[2]["title"] == "Andromeda" and items[2]["date"].startswith("2026-09-27")


def test_merge_drops_old_items_and_caps_sources():
    items = news.parse_rss("X", RSS)
    merged = news.merge({"X": items}, datetime(2026, 9, 28, 12, tzinfo=timezone.utc))
    assert [i["title"] for i in merged] == ["Saturne à l'opposition", "Andromeda"]


def test_objects_found_in_text_order_and_resolved_in_catalog():
    objs = news.objects_in("Neptune passe avant Saturne ; supernova dans NGC 7331, pres de M 31 et de XYZ 12, comete C/2025 A1")
    assert [o["label"] for o in objs] == ["Neptune", "Saturne", "NGC 7331"]
    assert objs[2]["designation"] == "NGC7331"
    assert news.objects_in("la comete 12P/Pons-Brooks")[0]["designation"] == "12P"


def test_kind_and_caps():
    assert news.kind_of("X", "Une supernova dans NGC 7331", "", True) == "observer"
    assert news.kind_of("X", "Starship decolle", "la mission emporte des satellites", False) == "espace"
    assert news.kind_of("APOD", "M31", "", True) == "image"
    assert news.fix_caps("COMMUNION SOLENNELLE") == "Communion solennelle"
    assert news.fix_caps("Pluton à l'opposition") == "Pluton à l'opposition"


def test_magazine_columns_are_dropped():
    xml = """<rss><channel>
    <item><title>Edito</title><link>https://ex.fr/e</link><category>Éditorial</category>
    <pubDate>Mon, 28 Sep 2026 09:39:00 +0200</pubDate></item>
    <item><title>Nova</title><link>https://ex.fr/n</link><category>Actualité</category>
    <pubDate>Mon, 28 Sep 2026 09:39:00 +0200</pubDate></item></channel></rss>"""
    assert [i["title"] for i in news.parse_rss("X", xml)] == ["Nova"]


def test_apod_page_image(monkeypatch):
    class R:
        text = '<a href="image/2609/big.jpg"><IMG SRC="image/2609/screen_1000.jpg" alt="x"></a>'
        def raise_for_status(self):
            pass
    monkeypatch.setattr(news.requests, "get", lambda *a, **k: R())
    news._apod_images.clear()
    assert news.apod_image("https://apod.nasa.gov/apod/ap260924.html") == "https://apod.nasa.gov/apod/image/2609/screen_1000.jpg"


def test_english_sources():
    objs = news.objects_in("Catch Saturn's satellites; M39 in Cygnus, then Venus")
    assert [o["designation"] for o in objs] == ["Saturne", "M39", "Vénus"]
    assert news.kind_of("X", "The Sky Today: Neptune at opposition", "", True) == "observer"
    assert news.kind_of("X", "Astronomers Have Spotted the Youngest Planet Yet", "the telescope saw", False) == "espace"
    assert news._summary("Looking for a sky event this week? Check out our full Sky This Week column. M39 shines.") == "M39 shines."
    assert news._summary("Saturn glows. Continue reading \"The Sky Today\" The post X appeared first on Y.") == "Saturn glows."
