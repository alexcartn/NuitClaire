from datetime import date, datetime
from zoneinfo import ZoneInfo

from astro import compass_sector, twilight_times, target_altaz, night_hours, format_ra, format_dec
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


def test_format_ra_rounds_minutes():
    assert format_ra(0.6728) == "00h40m"
    assert format_ra(10.0) == "10h00m"


def test_format_ra_carries_minute_rounding_into_hour():
    # 1.9999h -> 59.996 min de l'heure 1 -> arrondit a 60 -> doit reporter sur l'heure suivante.
    assert format_ra(1.9999) == "02h00m"


def test_format_dec_positive_and_negative():
    assert format_dec(41.6853) == "+41°41'"
    assert format_dec(-5.5) == "-05°30'"


def test_format_dec_carries_minute_rounding_into_degree():
    assert format_dec(1.9999) == "+02°00'"


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


def test_twilight_times_uses_site_timezone_not_frozen_module_tz():
    # A realistic site override on the opposite side of the globe from
    # config.SITE (Europe/Paris): real Tokyo lat/lon paired with its own
    # Asia/Tokyo timezone (UTC+9, vs. Europe/Paris' UTC+2 in September --
    # a 7-hour difference). If the conversion silently used the frozen
    # module-level TZ (Europe/Paris) instead of the site's own tz, the
    # civil dusk instant (which genuinely falls around 18:14 Tokyo local
    # time) would instead be mislabelled as if it were Paris local time,
    # landing near midday on the *following* calendar day instead of the
    # evening of the requested day.
    d = date(2026, 9, 15)
    tokyo_site = {"name": "Tokyo", "lat": 35.68, "lon": 139.69,
                  "elevation_m": 40, "tz": "Asia/Tokyo"}
    t = twilight_times(d, site=tokyo_site)
    assert t["civil_dusk"].date() == d
    assert 17 <= t["civil_dusk"].hour <= 20
    assert t["civil_dawn"].date() == date(2026, 9, 16)
    assert 3 <= t["civil_dawn"].hour <= 6


def test_night_hours_uses_site_timezone_not_frozen_module_tz():
    # Same reasoning as test_twilight_times_uses_site_timezone_not_frozen_module_tz
    # above: night_hours anchors its 24h scan window at local noon of
    # `date_local`. If it silently used the frozen module-level TZ
    # (Europe/Paris) instead of deriving the tz from `site`, every returned
    # hour would carry a tzinfo of Europe/Paris even when a Tokyo site was
    # explicitly requested -- both mislabelling the instants and shifting the
    # scan window by the 7-hour UTC offset difference between the two zones.
    d = date(2026, 9, 15)
    tokyo_site = {"name": "Tokyo", "lat": 35.68, "lon": 139.69,
                  "elevation_m": 40, "tz": "Asia/Tokyo"}
    hours = night_hours(d, site=tokyo_site)
    assert hours  # nautical night definitely occurs during this window in Tokyo
    for t in hours:
        assert str(t.tzinfo) == "Asia/Tokyo"


def test_target_altaz_accepts_site_override():
    t = datetime(2026, 9, 15, 22, 0, tzinfo=TZ)
    alt_default, az_default = target_altaz(t, 0.712, 41.27)
    other_site = {**SITE, "lat": 40.0, "lon": 2.0, "elevation_m": 0}
    alt_other, az_other = target_altaz(t, 0.712, 41.27, site=other_site)
    assert (alt_default, az_default) != (alt_other, az_other)
