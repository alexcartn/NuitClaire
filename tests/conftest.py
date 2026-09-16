import sys
from datetime import date, timedelta
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))


def make_fake_weather_df(days: int = 3) -> pd.DataFrame:
    """DataFrame horaire couvrant `days` jours a partir d'hier minuit --
    couvre largement toute fenetre que `astro.night_hours` peut renvoyer pour
    "aujourd'hui", pour servir de remplacement hors-reseau a `weather.fetch_all`
    dans les tests de l'API (qui n'appellent jamais un vrai service meteo)."""
    start = pd.Timestamp(date.today() - timedelta(days=1))
    idx = pd.date_range(start, periods=days * 24, freq="1h", name="time")
    n = len(idx)
    return pd.DataFrame({
        "temperature_2m": [12.0] * n, "dew_point_2m": [8.0] * n,
        "relative_humidity_2m": [70] * n,
        "cloud_cover": [20] * n, "cloud_cover_low": [10] * n,
        "cloud_cover_mid": [5] * n, "cloud_cover_high": [5] * n,
        "wind_speed_10m": [10.0] * n, "wind_gusts_10m": [15.0] * n,
        "precipitation_probability": [0] * n, "visibility": [20000] * n,
        "seeing": [3] * n, "transparency": [3] * n, "cloud_7t": [2] * n,
    }, index=idx)


@pytest.fixture
def api_client(monkeypatch):
    """TestClient pour l'API FastAPI, avec :
    - `weather.fetch_all` remplace par des donnees synthetiques (pas d'appel
      reseau dans les tests) ;
    - `progress.load`/`settings.load` remplaces par leurs valeurs par defaut
      (les tests ne doivent jamais lire/ecrire les vrais data/progress.json
      et data/settings.json de l'utilisateur) -- patch sur le module lui-meme
      (pas sur l'alias `progress_store`/`settings_store`), pour que ca vaille
      pour tous les modules qui l'importent ;
    - les caches TTL de `api.deps` vides a chaque test, pour qu'un test ne
      lise jamais le resultat cache d'un test precedent avec un site/horizon
      different."""
    from fastapi.testclient import TestClient

    import api.deps as deps
    import progress
    import settings
    from api.main import app

    monkeypatch.setattr(deps, "fetch_all", lambda days, site: make_fake_weather_df())
    monkeypatch.setattr(progress, "load", lambda *a, **k: progress.default())
    monkeypatch.setattr(settings, "load", lambda *a, **k: settings.default())
    deps._night_cache.clear()
    deps._rows_cache.clear()
    deps._wiki_cache.clear()
    return TestClient(app)
