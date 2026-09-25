def test_instrument_switch_changes_the_target_list(api_client):
    seestar = api_client.get("/api/targets").json()
    r = api_client.put("/api/settings", json={"instrument": "jumelles"})
    assert r.status_code == 200 and r.json()["instrument"] == "jumelles"
    assert r.json()["binoculars"]["label"] == "10x50"
    bino = api_client.get("/api/targets").json()
    assert bino and len(bino) < len(seestar)
    assert all(row["mag"] is not None and row["mag"] <= 8.5 for row in bino)
    assert {row["cadrage"] for row in bino} <= {"tient dans le champ", "déborde du champ", "taille inconnue"}


def test_state_exposes_instrument_and_seen_messier(api_client):
    api_client.put("/api/settings", json={"instrument": "jumelles", "binoculars": {"fov_deg": 5}})
    assert api_client.put("/api/messier/31/seen", json={"seen": True}).json() == ["31"]
    state = api_client.get("/api/state").json()
    assert state["instrument"] == "jumelles"
    assert state["binoculars"]["fovDeg"] == 5
    assert state["messierSeen"] == ["31"]
    assert state["messierCaptured"] == []  # vu n'est pas photographie
    assert api_client.put("/api/messier/31/seen", json={"seen": False}).json() == []


def test_invalid_instrument_and_field_are_refused(api_client):
    assert api_client.put("/api/settings", json={"instrument": "telescope"}).status_code == 422
    assert api_client.put("/api/settings", json={"binoculars": {"fov_deg": 40}}).status_code == 422
