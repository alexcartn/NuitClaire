from datetime import date

import comets
from alerts import comet_messages

SITE = {"name": "Marson", "lat": 48.91, "lon": 4.53, "elevation_m": 120, "tz": "Europe/Paris"}
# Orbite de 161P/Hartley-IRAS publiee par le MPC le 28/09/2026 (format
# XEphem), et une
# comete lointaine, bien trop faible.
LINES = [
    "161P/Hartley-IRAS,e,95.7919,1.4736,47.0634,7.723372,0.0459191,0.83619465,357.1908,09/27.0/2026,2000,g 13.5,4.0",
    "C/1942 EA (Vaisala),e,37.8736,172.3206,335.5588,19.62311,0.0113384,0.93488988,351.8593,09/27.0/2026,2000,g 13.5,4.0",
]


def test_designation_shared_by_both_sources():
    assert comets.designation("12P/Pons-Brooks") == "12P"
    assert comets.designation("C/2023 A3 (Tsuchinshan-ATLAS)") == "C/2023 A3"
    assert comets.designation("P/2010 H2 (Vales)") == "P/2010 H2"


def test_parse_mpc_skips_comments():
    assert comets.parse_mpc("# entete\n\nA,e,1\n") == ["A,e,1"]


def test_observed_magnitude_used_near_perihelion_only():
    observed = comets.parse_cobs({"objects": [
        {"name": "161P", "fullname": "161P/Hartley-IRAS", "current_mag": "9.0",
         "peak_mag": "8.8", "peak_mag_date": "2026-10-08", "perihelion_date": "2026-09-30 10:00"},
        {"name": "C/1942 EA", "fullname": "C/1942 EA (Vaisala)", "current_mag": "8.0",
         "peak_mag": "8.0", "peak_mag_date": "2019-01-01", "perihelion_date": "2019-01-01 00:00"},
    ]})
    found = comets.comets_tonight(LINES, observed, SITE, date(2026, 9, 28), mag_max=11)
    assert [c["designation"] for c in found] == ["161P"]
    c = found[0]
    assert c["mag"] == 9.0 and c["magSource"] == "observée" and c["peakDate"] == "2026-10-08"
    assert c["bestAlt"] >= comets.MIN_ALT_DEG and c["curve"]


def test_closed_horizon_hides_the_comet():
    closed = {s: None for s in ("N", "NE", "E", "SE", "S", "SW", "W", "NW")}
    assert comets.comets_tonight(LINES, None, SITE, date(2026, 9, 28), closed, mag_max=16) == []


def test_comet_alert_once_per_comet():
    c = {"designation": "161P", "name": "161P/Hartley-IRAS", "mag": 9.0, "magSource": "observée",
         "bestAlt": 40, "sector": "S", "bestTime": "2026-09-28T23:15:00+02:00"}
    assert comet_messages("2026-09-28", {"comet": False}, [c], {}) == []
    msgs = comet_messages("2026-09-28", {"comet": True}, [c], {})
    assert msgs[0]["alert"] == "comet:161P" and "9,0" in msgs[0]["body"]
    assert comet_messages("2026-09-29", {"comet": True}, [c], {"comet:161P": "2026-09-28"}) == []
