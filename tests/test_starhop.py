from datetime import datetime
from zoneinfo import ZoneInfo

from catalog import find_target
from starhop import choose_anchor, load_stars, plan_hops, separation, star_hop

MARSON = {"name": "Marson", "lat": 48.91, "lon": 4.53, "elevation_m": 100, "tz": "Europe/Paris"}
WHEN = datetime(2026, 9, 25, 23, 0, tzinfo=ZoneInfo("Europe/Paris"))


def test_catalogue_has_the_naked_eye_sky():
    stars = load_stars()
    assert len(stars) > 5000
    assert any(s["name"] == "Mirach" for s in stars)


def test_andromeda_starts_from_mirach_through_mu_andromedae():
    """Le chemin classique des guides : Mirach, mu And, M31."""
    m31 = find_target("M31")
    plan = plan_hops(m31["ra"] * 15, m31["dec"], 6.5)
    assert plan["anchor"]["name"] == "Mirach"
    assert [p["star"]["desig"] for p in plan["points"][1:-1] if p["star"]] == ["μ And"]


def test_each_hop_fits_in_the_binocular_field():
    m81 = find_target("M81")
    plan = plan_hops(m81["ra"] * 15, m81["dec"], 6.5)
    pts = plan["points"]
    for a, b in zip(pts, pts[1:]):
        assert separation(a["ra"], a["dec"], b["ra"], b["dec"]) <= 6.5


def test_anchor_prefers_bright_stars():
    anchor = choose_anchor(279.2, 38.8)  # Vega
    assert anchor["mag"] <= 3.0


def test_chart_is_centred_and_readable():
    hop = star_hop(find_target("M13"), 6.5, WHEN, MARSON)
    assert hop["steps"][0].startswith("Trouvez")
    assert hop["hops"][-1]["target"] is True
    assert all(abs(s["x"]) <= hop["radiusDeg"] * 1.5 and abs(s["y"]) <= hop["radiusDeg"] * 1.5 for s in hop["stars"])
    assert hop["lines"]


def test_target_in_the_same_field_as_its_anchor():
    hop = star_hop(find_target("M45"), 6.5, WHEN, MARSON)
    assert "même champ" in hop["steps"][-1]


def test_api_star_hop(api_client):
    r = api_client.get("/api/targets/M31/starhop")
    assert r.status_code == 200
    assert r.json()["anchor"].startswith("Mirach")
    assert api_client.get("/api/targets/XYZ999/starhop").status_code == 404
