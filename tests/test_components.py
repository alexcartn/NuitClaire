from datetime import datetime

from components import twilight_bar_html, card_html


def _tw():
    # Axe attendu : civil_dusk - 1h (19:00, 15/09) -> civil_dawn + 1h (07:00, 16/09),
    # soit 12h = 720 min, choisi pour donner des pourcentages faciles a verifier.
    return {
        "civil_dusk": datetime(2026, 9, 15, 20, 0),
        "nautical_dusk": datetime(2026, 9, 15, 20, 30),
        "astro_dusk": datetime(2026, 9, 15, 21, 0),
        "astro_dawn": datetime(2026, 9, 16, 5, 0),
        "nautical_dawn": datetime(2026, 9, 16, 5, 30),
        "civil_dawn": datetime(2026, 9, 16, 6, 0),
    }


def test_twilight_bar_places_ticks_at_expected_percentages():
    html = twilight_bar_html(_tw())
    # (temps - axis_start) / 12h * 100, axis_start = 19:00 le 15/09
    assert "left:8.33%" in html    # civil_dusk : 20:00
    assert "left:12.50%" in html   # nautical_dusk : 20:30
    assert "left:16.67%" in html   # astro_dusk : 21:00
    assert "left:83.33%" in html   # astro_dawn : 05:00
    assert "left:87.50%" in html   # nautical_dawn : 05:30
    assert "left:91.67%" in html   # civil_dawn : 06:00


def test_twilight_bar_has_no_highlight_without_best_span():
    html = twilight_bar_html(_tw(), best_span=None)
    assert "twilight-highlight" not in html


def test_twilight_bar_highlights_best_window_span():
    best_span = (datetime(2026, 9, 15, 21, 0), datetime(2026, 9, 15, 23, 0))
    html = twilight_bar_html(_tw(), best_span=best_span)
    assert 'class="twilight-highlight"' in html
    assert "left:16.67%;width:16.67%" in html


def test_twilight_bar_shows_now_marker_when_inside_axis():
    now = datetime(2026, 9, 15, 22, 0)
    html = twilight_bar_html(_tw(), now=now)
    assert "twilight-now" in html
    assert "left:25.00%" in html


def test_twilight_bar_hides_now_marker_when_outside_axis():
    # 10:00 le 15/09 est avant axis_start (19:00 le 15/09) : hors champ.
    now = datetime(2026, 9, 15, 10, 0)
    html = twilight_bar_html(_tw(), now=now)
    assert "twilight-now" not in html


def test_card_html_escapes_untrusted_text():
    html = card_html(image="https://example.com/x.jpg", title="<script>alert(1)</script>",
                      subtitle=None, badges=[], meta=[])
    assert "<script>" not in html
    assert "&lt;script&gt;" in html


def test_card_html_omits_subtitle_block_when_none():
    html = card_html(image="https://example.com/x.jpg", title="M31", subtitle=None,
                      badges=[], meta=[])
    assert "target-card-subtitle" not in html
