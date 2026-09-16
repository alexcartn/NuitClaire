def test_get_night_returns_score_twilight_and_hourly_fields(api_client):
    r = api_client.get("/api/night")
    assert r.status_code == 200
    data = r.json()
    assert 0 <= data["score"] <= 1
    assert 0 <= data["scorePct"] <= 100
    assert data["scoreLabel"] in ("Bonnes conditions", "Conditions moyennes", "Mauvaises conditions")
    assert data["hourly"]
    assert all("time" in p and "score" in p for p in data["hourly"])
    # Meteo synthetique du fixture (temp=12, rosee=8 -> ecart 4deg, nuages bas
    # 10%, rafales 15 km/h, pluie 0%) : risque de buee faible, sans veto.
    assert data["dewSpread"] == 4.0
    assert data["dewRisk"] == "Faible"
    assert data["windGustsKmh"] is not None


def test_get_night_twilight_times_are_ordered(api_client):
    r = api_client.get("/api/night")
    data = r.json()
    assert data["civilDusk"] < data["nauticalDusk"] < data["astroDusk"]
    assert data["astroDusk"] < data["astroDawn"]
