from datetime import datetime

from binocular_now import binocular_picks
from config import SITE
from optics import binocular_optics

OPEN_SKY = {s: 0.0 for s in ("N", "NE", "E", "SE", "S", "SW", "W", "NW")}


def test_picks_are_few_easy_varied_and_up():
    picks = binocular_picks(SITE, OPEN_SKY, binocular_optics(), datetime(2026, 10, 10, 22, 0))
    assert 1 <= len(picks) <= 5
    assert all(p["altDeg"] >= 15 and p["mag"] <= 8.5 for p in picks)
    kinds = [p["type"] for p in picks]
    assert all(kinds.count(k) <= 2 for k in kinds)
    assert "M31" in {p["designation"] for p in picks}  # Lune couchee, Andromede haute


def test_picks_respect_a_blocked_horizon():
    only_south = {**{s: None for s in OPEN_SKY}, "S": 0.0}
    picks = binocular_picks(SITE, only_south, binocular_optics(), datetime(2026, 10, 10, 22, 0))
    assert all(p["sector"] == "S" for p in picks)


def test_bigger_binoculars_reach_fainter_targets():
    small = binocular_optics({"binoculars": {"aperture_mm": 30}})
    big = binocular_optics({"binoculars": {"aperture_mm": 80}})
    when = datetime(2026, 10, 10, 22, 0)
    faint = lambda picks: max(p["mag"] for p in picks)
    assert faint(binocular_picks(SITE, OPEN_SKY, small, when, limit=40)) \
        <= faint(binocular_picks(SITE, OPEN_SKY, big, when, limit=40))


def test_binoculars_now_endpoint(api_client):
    r = api_client.get("/api/binoculars/now")
    assert r.status_code == 200
    body = r.json()
    assert body["at"] in ("maintenant", "à la nuit tombée")
    assert body["binoculars"]["label"] == "10x50"
    api_client.put("/api/settings", json={"binoculars": {"aperture_mm": 70, "magnification": 15}})
    assert api_client.get("/api/binoculars/now").json()["binoculars"]["label"] == "15x70"


def test_lists_stay_seestar_and_detail_can_switch_to_binoculars(api_client):
    state = api_client.get("/api/state").json()
    assert "instrument" not in state and "messierSeen" not in state
    seestar = api_client.get("/api/targets/M31").json()
    bino = api_client.get("/api/targets/M31", params={"instrument": "jumelles"}).json()
    assert seestar["cadrage"] != bino["cadrage"] == "tient dans le champ"
    assert api_client.get("/api/targets/M31", params={"instrument": "lunette"}).status_code == 422


def test_invalid_binoculars_are_refused(api_client):
    assert api_client.put("/api/settings", json={"binoculars": {"fov_deg": 40}}).status_code == 422
    assert api_client.put("/api/settings", json={"binoculars": {"aperture_mm": 500}}).status_code == 422


def test_naked_eye_keeps_only_what_the_eye_shows():
    from optics import eye_optics

    when = datetime(2026, 1, 15, 21, 0)
    eye = binocular_picks(SITE, OPEN_SKY, eye_optics(), when, limit=40)
    names = {p["designation"] for p in eye}
    # Les classiques de l'hiver : Pleiades, Hyades, Orion.
    assert {"M45", "M42"} <= names
    assert all(p["mag"] <= 5.0 for p in eye)
    # Pas de double serree ni d'asterisme d'etoiles faibles.
    assert not names & {"Albireo", "Kemble1"}
    # Moins, et plus brillant, qu'aux jumelles.
    bino = binocular_picks(SITE, OPEN_SKY, binocular_optics(), when, limit=40)
    assert len(eye) < len(bino)


def test_binoculars_now_naked_eye_endpoint(api_client):
    body = api_client.get("/api/binoculars/now", params={"instrument": "oeil"}).json()
    assert body["binoculars"]["label"] == "œil nu"
    assert body["binoculars"]["limitMag"] == 5.0
    assert all(p["mag"] <= 5.0 for p in body["picks"])
    assert api_client.get("/api/binoculars/now", params={"instrument": "lunette"}).status_code == 422
