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
