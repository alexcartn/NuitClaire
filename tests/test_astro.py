from datetime import date, datetime
from zoneinfo import ZoneInfo

from astro import compass_sector, twilight_times, target_altaz
from config import SITE

TZ = ZoneInfo(SITE["tz"])


def test_compass_sector_cardinal_points():
    assert compass_sector(0) == "N"
    assert compass_sector(20) == "N"
    assert compass_sector(46) == "NE"
    assert compass_sector(90) == "E"
    assert compass_sector(180) == "S"
    assert compass_sector(270) == "W"
    assert compass_sector(359) == "N"


def test_twilight_times_order_for_known_date():
    d = date(2026, 9, 15)
    t = twilight_times(d)
    for key in ("civil_dusk", "civil_dawn", "nautical_dusk", "nautical_dawn",
                "astro_dusk", "astro_dawn"):
        assert key in t
    # Evening progression: civil dusk earliest, astro dusk latest.
    assert t["civil_dusk"] < t["nautical_dusk"] < t["astro_dusk"]
    # Morning progression: astro dawn earliest, civil dawn latest.
    assert t["astro_dawn"] < t["nautical_dawn"] < t["civil_dawn"]
    assert t["astro_dusk"] < t["astro_dawn"]


def test_target_altaz_accepts_site_override():
    t = datetime(2026, 9, 15, 22, 0, tzinfo=TZ)
    alt_default, az_default = target_altaz(t, 0.712, 41.27)
    other_site = {**SITE, "lat": 40.0, "lon": 2.0, "elevation_m": 0}
    alt_other, az_other = target_altaz(t, 0.712, 41.27, site=other_site)
    assert (alt_default, az_default) != (alt_other, az_other)
