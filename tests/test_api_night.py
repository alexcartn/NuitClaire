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
    # Series horaires pour les graphes "Details meteo" du mobile (nuages,
    # vent, temperature/rosee) -- memes colonnes que app.py::_cloud_chart/
    # _wind_chart/_render_time_series, constantes dans le fixture (cloud_cover
    # 20%, rafales 15 km/h, temp 12deg, rosee 8deg).
    first = data["hourly"][0]
    assert first["cloudCoverPct"] == 20.0
    assert first["windGustsKmh"] == 15.0
    assert first["temperatureC"] == 12.0
    assert first["dewPointC"] == 8.0
    # Temperature constante (12deg) dans le fixture : min/max/maintenant identiques.
    assert data["tempNowC"] == 12.0
    assert data["tempMinC"] == 12.0
    assert data["tempMaxC"] == 12.0


def test_get_night_twilight_times_are_ordered(api_client):
    r = api_client.get("/api/night")
    data = r.json()
    assert data["civilDusk"] < data["nauticalDusk"] < data["astroDusk"]
    assert data["astroDusk"] < data["astroDawn"]
