# Seestar Planner — Noctar-style Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the Seestar Planner around a single glanceable astro score, direction/horizon-aware target picking, a broad auto-generated target catalog plus a dedicated Messier-110 completion tracker, and a clean, minimalist, fully French, 24h-time UI — per `docs/plans/2026-09-15-noctar-features-design.md`.

**Architecture:** Thread an optional `site` dict through the existing weather/astro modules so location can be overridden at runtime (address input, geocoded via Nominatim). Extend `scoring.py` with a French score label, a "best window" finder, and horizon-sector filtering. Replace the hardcoded 18-target `catalog.py` with a loader reading two generated CSVs (a broad Seestar-feasible catalog and the full 110-object Messier list), produced once by `scripts/build_catalog.py` from the OpenNGC dataset. Add a small local JSON store (`progress.py`) for horizon config and captured-Messier state. Rework `app.py` into two tabs ("Ce soir" / "Catalogue Messier") with custom CSS cards, all French copy, 24h times.

**Tech Stack:** Python 3.12, Streamlit, pandas, requests, PyEphem, pytest (new, dev-only).

---

## Environment notes (read before starting)

- **Python is not on the Bash tool's PATH in this environment.** `python`/`python3`/`pytest` will fail if run via the Bash tool. **Always run Python/pytest via the PowerShell tool instead** (`python -m pytest ...`, `python -m pip install ...`). Plain `git` commands work fine in either tool; prefer Bash for git/file operations and PowerShell for anything Python.
- Working directory for all tasks: `C:\Users\alexandre_carton\Documents\claudecode\astro photo\seestar-planner`. This is already a git repo (initialized during brainstorming) with one commit (the design doc).
- Do **not** touch the duplicate `app.py`/`scoring.py`/`weather.py` files or `seestar-planner.zip` one level up in `astro photo/` — they're not part of this project/repo.
- Internet access is available (used for Nominatim geocoding and the one-time OpenNGC download in Task 7).

---

### Task 0: Test infrastructure

**Files:**
- Create: `requirements-dev.txt`
- Create: `tests/__init__.py` (empty)
- Create: `tests/conftest.py`

**Step 1: Create the dev requirements file**

```
pytest
```

**Step 2: Create `tests/conftest.py`**

```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
```

**Step 3: Create empty `tests/__init__.py`**

(empty file — makes `tests` a package so fixture files can be imported if needed later)

**Step 4: Install dependencies**

Run (PowerShell): `python -m pip install -r requirements.txt -r requirements-dev.txt`
Expected: no errors, pytest installed.

**Step 5: Verify pytest runs with zero tests**

Run (PowerShell): `python -m pytest -v`
Expected: `no tests ran` (exit code may be non-zero for "no tests collected" — that's fine at this stage).

**Step 6: Commit**

```bash
git add requirements-dev.txt tests/__init__.py tests/conftest.py
git commit -m "test: add pytest infrastructure"
```

---

### Task 1: Geocoding (`geocode.py`)

**Files:**
- Create: `geocode.py`
- Test: `tests/test_geocode.py`

**Step 1: Write the failing tests**

```python
# tests/test_geocode.py
import pytest
import requests

from geocode import geocode, GeocodeError


class FakeResponse:
    def __init__(self, payload, status=200):
        self._payload = payload
        self.status_code = status

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"status {self.status_code}")

    def json(self):
        return self._payload


def test_geocode_success(monkeypatch):
    def fake_get(url, params=None, headers=None, timeout=None):
        assert "Marson" in params["q"]
        assert headers["User-Agent"]
        return FakeResponse([{"lat": "48.9124325", "lon": "4.5289924",
                               "display_name": "Rue de Saint-Jean, Marson, France"}])

    monkeypatch.setattr(requests, "get", fake_get)
    result = geocode("7 rue Saint Jean, 51240 Marson, France")
    assert result == {"lat": 48.9124325, "lon": 4.5289924,
                       "display_name": "Rue de Saint-Jean, Marson, France"}


def test_geocode_not_found(monkeypatch):
    monkeypatch.setattr(requests, "get", lambda *a, **k: FakeResponse([]))
    with pytest.raises(GeocodeError, match="introuvable"):
        geocode("adresse qui n'existe pas nulle part")


def test_geocode_network_error(monkeypatch):
    def fake_get(*a, **k):
        raise requests.ConnectionError("boom")

    monkeypatch.setattr(requests, "get", fake_get)
    with pytest.raises(GeocodeError, match="contacter"):
        geocode("7 rue Saint Jean, 51240 Marson, France")
```

**Step 2: Run tests to verify they fail**

Run (PowerShell): `python -m pytest tests/test_geocode.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'geocode'`

**Step 3: Implement `geocode.py`**

```python
"""Geocodage d'adresse en lat/lon via Nominatim (OpenStreetMap)."""
import requests

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "seestar-planner/1.0 (usage personnel)"


class GeocodeError(Exception):
    pass


def geocode(address: str) -> dict:
    """Retourne {'lat': float, 'lon': float, 'display_name': str} ou leve GeocodeError."""
    params = {"q": address, "format": "json", "limit": 1}
    headers = {"User-Agent": USER_AGENT}
    try:
        r = requests.get(NOMINATIM_URL, params=params, headers=headers, timeout=10)
        r.raise_for_status()
        results = r.json()
    except requests.RequestException as e:
        raise GeocodeError(f"Impossible de contacter le service de geocodage : {e}") from e
    if not results:
        raise GeocodeError(f"Adresse introuvable : {address}")
    top = results[0]
    return {"lat": float(top["lat"]), "lon": float(top["lon"]),
            "display_name": top["display_name"]}
```

**Step 4: Run tests to verify they pass**

Run (PowerShell): `python -m pytest tests/test_geocode.py -v`
Expected: 3 passed

**Step 5: Commit**

```bash
git add geocode.py tests/test_geocode.py
git commit -m "feat: add Nominatim geocoding for address-based location input"
```

---

### Task 2: Local progress store (`progress.py`)

**Files:**
- Create: `progress.py`
- Test: `tests/test_progress.py`

**Step 1: Write the failing tests**

```python
# tests/test_progress.py
import json

from progress import load, save, toggle_messier, DEFAULT


def test_load_returns_default_when_file_missing(tmp_path):
    data = load(tmp_path / "progress.json")
    assert data == DEFAULT


def test_save_then_load_roundtrip(tmp_path):
    path = tmp_path / "progress.json"
    data = dict(DEFAULT)
    data["messier_captured"] = ["31", "42"]
    save(data, path)
    assert load(path) == data


def test_load_merges_missing_keys_with_defaults(tmp_path):
    path = tmp_path / "progress.json"
    path.write_text(json.dumps({"messier_captured": ["1"]}), encoding="utf-8")
    data = load(path)
    assert data["messier_captured"] == ["1"]
    assert data["horizon"] == DEFAULT["horizon"]


def test_toggle_messier_adds_and_removes():
    data = {"horizon": {}, "messier_captured": ["31"]}
    toggle_messier(data, "42")
    assert data["messier_captured"] == ["31", "42"]
    toggle_messier(data, "31")
    assert data["messier_captured"] == ["42"]
```

**Step 2: Run tests to verify they fail**

Run (PowerShell): `python -m pytest tests/test_progress.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'progress'`

**Step 3: Implement `progress.py`**

```python
"""Persistance locale : secteurs d'horizon degages et Messiers captures."""
import json
from pathlib import Path

PROGRESS_PATH = Path(__file__).parent / "data" / "progress.json"

DEFAULT = {
    "horizon": {"N": True, "NE": True, "E": False, "SE": False,
                "S": False, "SW": False, "W": False, "NW": False},
    "messier_captured": [],
}


def load(path: Path = PROGRESS_PATH) -> dict:
    if not path.exists():
        return json.loads(json.dumps(DEFAULT))  # deep copy
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    merged = json.loads(json.dumps(DEFAULT))
    merged.update(data)
    return merged


def save(data: dict, path: Path = PROGRESS_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def toggle_messier(data: dict, messier_id: str) -> dict:
    captured = set(data["messier_captured"])
    if messier_id in captured:
        captured.discard(messier_id)
    else:
        captured.add(messier_id)
    data["messier_captured"] = sorted(captured)
    return data
```

**Step 4: Run tests to verify they pass**

Run (PowerShell): `python -m pytest tests/test_progress.py -v`
Expected: 4 passed

**Step 5: Add `data/` to the repo (with a `.gitkeep`, keep `progress.json` itself out of git — it's per-user local state)**

Create `data/.gitkeep` (empty file).
Create `.gitignore` with:
```
__pycache__/
data/progress.json
```

**Step 6: Commit**

```bash
git add progress.py tests/test_progress.py data/.gitkeep .gitignore
git commit -m "feat: add local JSON persistence for horizon config and Messier progress"
```

---

### Task 3: Astro additions — runtime site override, compass sectors, twilight times

**Files:**
- Modify: `astro.py` (all functions currently reading `SITE` from module scope)
- Test: `tests/test_astro.py`

**Step 1: Write the failing tests**

```python
# tests/test_astro.py
from datetime import date, datetime
from zoneinfo import ZoneInfo

from astro import compass_sector, twilight_times, target_altaz
from config import SITE

TZ = ZoneInfo(SITE["tz"])


def test_compass_sector_cardinal_points():
    assert compass_sector(0) == "N"
    assert compass_sector(44) == "N"
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
```

**Step 2: Run tests to verify they fail**

Run (PowerShell): `python -m pytest tests/test_astro.py -v`
Expected: FAIL — `compass_sector` and `twilight_times` don't exist, `target_altaz` doesn't accept `site=`.

**Step 3: Implement changes in `astro.py`**

Replace the whole file with:

```python
"""Calculs astro avec PyEphem : Soleil, Lune, altitude des cibles."""
import math
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import ephem
import pandas as pd
from config import SITE, SEESTAR

TZ = ZoneInfo(SITE["tz"])

COMPASS_SECTORS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]


def compass_sector(azimuth_deg: float) -> str:
    """Secteur cardinal (45 degres) pour un azimut donne."""
    idx = int(((azimuth_deg % 360) + 22.5) // 45) % 8
    return COMPASS_SECTORS[idx]


def _observer(t_local: datetime, site: dict = SITE) -> ephem.Observer:
    obs = ephem.Observer()
    obs.lat, obs.lon = str(site["lat"]), str(site["lon"])
    obs.elevation = site["elevation_m"]
    obs.pressure = 0  # pas de refraction, on veut l'altitude geometrique
    obs.date = t_local.astimezone(timezone.utc)
    return obs


def sun_moon(t_local: datetime, site: dict = SITE) -> dict:
    obs = _observer(t_local, site)
    sun, moon = ephem.Sun(obs), ephem.Moon(obs)
    return {
        "sun_alt": math.degrees(sun.alt),
        "moon_alt": math.degrees(moon.alt),
        "moon_az": math.degrees(moon.az),
        "moon_illum": moon.phase,  # 0..100 %
        "_moon": moon,
    }


def target_altaz(t_local: datetime, ra_h: float, dec_deg: float,
                  site: dict = SITE) -> tuple[float, float]:
    obs = _observer(t_local, site)
    body = ephem.FixedBody()
    body._ra, body._dec = ephem.hours(ra_h * 15 * math.pi / 180), ephem.degrees(str(dec_deg))
    body.compute(obs)
    return math.degrees(body.alt), math.degrees(body.az)


def moon_separation(t_local: datetime, ra_h: float, dec_deg: float,
                     site: dict = SITE) -> float:
    obs = _observer(t_local, site)
    body = ephem.FixedBody()
    body._ra, body._dec = ephem.hours(ra_h * 15 * math.pi / 180), ephem.degrees(str(dec_deg))
    body.compute(obs)
    moon = ephem.Moon(obs)
    return math.degrees(ephem.separation(body, moon))


def night_hours(date_local, sun_limit: float = -12.0, site: dict = SITE) -> list[datetime]:
    """Heures (locales) entre crepuscule et aube nautiques pour la nuit du `date_local`."""
    start = datetime(date_local.year, date_local.month, date_local.day, 12, tzinfo=TZ)
    hours = []
    for i in range(24):
        t = start + timedelta(hours=i)
        if sun_moon(t, site)["sun_alt"] < sun_limit:
            hours.append(t)
    return hours


def sky_frame(hours: list[datetime], site: dict = SITE) -> pd.DataFrame:
    rows = []
    for t in hours:
        sm = sun_moon(t, site)
        rows.append({"time": t.replace(tzinfo=None), "sun_alt": sm["sun_alt"],
                     "moon_alt": sm["moon_alt"], "moon_illum": sm["moon_illum"]})
    return pd.DataFrame(rows).set_index("time")


def fits_in_fov(size_arcmin_w: float, size_arcmin_h: float) -> str:
    w, h = SEESTAR["fov_w_deg"] * 60, SEESTAR["fov_h_deg"] * 60
    if size_arcmin_w <= w and size_arcmin_h <= h:
        return "cadre unique"
    if size_arcmin_w <= 2 * w and size_arcmin_h <= 2 * h:
        return "mosaique 2x"
    return "mosaique large"


def _to_local(ephem_date: ephem.Date) -> datetime:
    return ephem_date.datetime().replace(tzinfo=timezone.utc).astimezone(TZ)


def twilight_times(date_local, site: dict = SITE) -> dict:
    """Crepuscule/aube civil (-6 deg), nautique (-12 deg), astronomique (-18 deg)
    pour la nuit du `date_local`, en heure locale (naive, dans le fuseau du site)."""
    base = datetime(date_local.year, date_local.month, date_local.day, 12, tzinfo=TZ)
    obs = _observer(base, site)
    sun = ephem.Sun()
    result = {}
    for label, horizon in (("civil", "-6"), ("nautical", "-12"), ("astro", "-18")):
        obs.horizon = horizon
        dusk = obs.next_setting(sun, use_center=True)
        dawn = obs.next_rising(sun, use_center=True)
        result[f"{label}_dusk"] = _to_local(dusk).replace(tzinfo=None)
        result[f"{label}_dawn"] = _to_local(dawn).replace(tzinfo=None)
    return result
```

**Step 4: Run tests to verify they pass**

Run (PowerShell): `python -m pytest tests/test_astro.py -v`
Expected: 3 passed

**Step 5: Run the full test suite to check nothing else broke**

Run (PowerShell): `python -m pytest -v`
Expected: all passing so far.

**Step 6: Commit**

```bash
git add astro.py tests/test_astro.py
git commit -m "feat: add compass sectors, twilight times, and runtime site override to astro.py"
```

---

### Task 4: Weather — runtime site override

**Files:**
- Modify: `weather.py`

**Step 1: Update `weather.py`**

```python
"""Recuperation meteo : Open-Meteo (modele AROME Meteo-France) + 7Timer ASTRO."""
import requests
import pandas as pd
from config import SITE

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
SEVENTIMER_URL = "https://www.7timer.info/bin/astro.php"


def fetch_open_meteo(days: int = 5, site: dict = SITE) -> pd.DataFrame:
    """Prevision horaire. Modele AROME (1.3 km) via meteofrance_seamless."""
    params = {
        "latitude": site["lat"],
        "longitude": site["lon"],
        "hourly": ",".join([
            "temperature_2m", "dew_point_2m", "relative_humidity_2m",
            "cloud_cover", "cloud_cover_low", "cloud_cover_mid", "cloud_cover_high",
            "wind_speed_10m", "wind_gusts_10m", "precipitation_probability",
            "visibility",
        ]),
        "models": "meteofrance_seamless",
        "timezone": site["tz"],
        "forecast_days": days,
        "wind_speed_unit": "kmh",
    }
    r = requests.get(OPEN_METEO_URL, params=params, timeout=15)
    r.raise_for_status()
    h = r.json()["hourly"]
    df = pd.DataFrame(h)
    df["time"] = pd.to_datetime(df["time"])
    return df.set_index("time")


def fetch_7timer(site: dict = SITE) -> pd.DataFrame:
    """Prevision ASTRO 7Timer (GFS, pas de 3h, ~72h) : seeing et transparence."""
    params = {"lon": site["lon"], "lat": site["lat"], "ac": 0,
              "unit": "metric", "output": "json", "tzshift": 0}
    r = requests.get(SEVENTIMER_URL, params=params, timeout=15)
    r.raise_for_status()
    data = r.json()
    init = pd.to_datetime(data["init"], format="%Y%m%d%H", utc=True)
    rows = []
    for p in data["dataseries"]:
        t = init + pd.Timedelta(hours=p["timepoint"])
        rows.append({
            "time": t.tz_convert(site["tz"]).tz_localize(None),
            "seeing": p["seeing"],            # 1 (excellent) .. 8 (mauvais)
            "transparency": p["transparency"],  # 1 (excellente) .. 8 (mauvaise)
            "cloud_7t": p["cloudcover"],      # 1 (0-6%) .. 9 (94-100%)
        })
    df = pd.DataFrame(rows).set_index("time")
    return df.resample("1h").interpolate()


def fetch_all(days: int = 5, site: dict = SITE) -> pd.DataFrame:
    """Fusionne les deux sources sur un index horaire."""
    om = fetch_open_meteo(days, site)
    try:
        st = fetch_7timer(site)
        df = om.join(st, how="left")
    except Exception as e:  # 7Timer tombe parfois, on continue sans
        print(f"7Timer indisponible : {e}")
        df = om.assign(seeing=None, transparency=None, cloud_7t=None)
    return df
```

This is a mechanical parameter-threading change with no new branching logic, so no new unit test is added here (network-calling functions are already untested — out of scope to add HTTP mocks for this pass). Verified manually in Task 11.

**Step 2: Sanity-check the module still imports cleanly**

Run (PowerShell): `python -c "import weather"`
Expected: no output, exit code 0.

**Step 3: Commit**

```bash
git add weather.py
git commit -m "feat: allow runtime site override in weather fetch functions"
```

---

### Task 5: Config updates

**Files:**
- Modify: `config.py`

**Step 1: Update `config.py`**

```python
"""Configuration du site d'observation et du Seestar S50."""

SITE = {
    "name": "Marson",
    "lat": 48.9124,
    "lon": 4.5290,
    "elevation_m": 100,
    "tz": "Europe/Paris",
}

# Seestar S50 : champ d'environ 1.29 deg x 0.73 deg (capteur IMX462, f=250mm)
SEESTAR = {
    "fov_w_deg": 1.29,
    "fov_h_deg": 0.73,
    "min_alt_deg": 30,      # en dessous, turbulence + extinction trop fortes
    "max_alt_deg": 85,      # zenith : le suivi alt-az decroche
}

# Ponderation du score (somme = 1)
WEIGHTS = {
    "clouds": 0.40,
    "moon": 0.20,
    "wind": 0.15,
    "dew": 0.15,
    "seeing_transp": 0.10,
}

NB_NIGHTS = 5

# Fenetre d'observation habituelle (heure locale, 24h), utilisee comme filtre par defaut.
VIEW_WINDOW = {"start_hour": 20, "end_hour": 22.5}

# Secteurs cardinaux degages par defaut (a ajuster dans la barre laterale de l'appli).
DEFAULT_HORIZON = {"N": True, "NE": True, "E": False, "SE": False,
                    "S": False, "SW": False, "W": False, "NW": False}
```

Note: lat/lon above come from geocoding "7 rue Saint Jean, 51240 Marson, France" via Nominatim
during design research (48.9124325, 4.5289924, rounded to 4 decimals ≈ 11m precision, plenty
for altitude/azimuth purposes). `elevation_m` is a rough estimate (Marson, Marne, ~100-110m) —
fine-tune later if you know the exact value; it has negligible effect on the score.

**Step 2: Sanity-check the module still imports cleanly**

Run (PowerShell): `python -c "import config; print(config.SITE, config.VIEW_WINDOW)"`
Expected: prints the dicts, no error.

**Step 3: Commit**

```bash
git add config.py
git commit -m "config: switch default site to Marson, add view window and horizon defaults"
```

---

### Task 6: Scoring — French label, best window, horizon-aware target windows

**Files:**
- Modify: `scoring.py`
- Test: `tests/test_scoring.py`

**Step 1: Write the failing tests**

```python
# tests/test_scoring.py
import pandas as pd

from scoring import score_label_fr, best_window, target_windows


def test_score_label_fr_buckets():
    assert score_label_fr(0.85) == (85, "Bonnes conditions")
    assert score_label_fr(0.55) == (55, "Conditions moyennes")
    assert score_label_fr(0.10) == (10, "Mauvaises conditions")
    assert score_label_fr(0.70) == (70, "Bonnes conditions")
    assert score_label_fr(0.40) == (40, "Conditions moyennes")


def test_best_window_finds_longest_contiguous_run():
    idx = pd.date_range("2026-09-15 20:00", periods=6, freq="1h")
    scores = [0.3, 0.7, 0.8, 0.75, 0.4, 0.9]
    df = pd.DataFrame({"score": scores}, index=idx)
    assert best_window(df) == "21:00\u201300:00"


def test_best_window_returns_none_when_no_good_hours():
    idx = pd.date_range("2026-09-15 20:00", periods=3, freq="1h")
    df = pd.DataFrame({"score": [0.1, 0.2, 0.3]}, index=idx)
    assert best_window(df) is None


def _make_night_df():
    idx = pd.date_range("2026-09-15 20:00", periods=4, freq="1h")
    return pd.DataFrame({
        "score": [0.8, 0.8, 0.8, 0.8],
        "moon_alt": [-10, -10, -10, -10],
        "moon_illum": [20, 20, 20, 20],
    }, index=idx)


def test_target_windows_blocks_hours_outside_open_horizon_sectors(monkeypatch):
    import scoring

    # Force every hour to report the target due south at 50 deg altitude.
    monkeypatch.setattr(scoring, "target_altaz", lambda *a, **k: (50.0, 180.0))
    monkeypatch.setattr(scoring, "moon_separation", lambda *a, **k: 90.0)

    df = _make_night_df()
    target = {"name": "Test", "type": "galaxie", "ra": 0.0, "dec": 0.0, "w": 10, "h": 10,
              "filter": "sans"}

    horizon_open_south = {"N": False, "NE": False, "E": False, "SE": False,
                           "S": True, "SW": False, "W": False, "NW": False}
    result_open = target_windows(df, target, horizon=horizon_open_south)
    assert result_open["hours"] == 4

    horizon_blocked_south = dict(horizon_open_south)
    horizon_blocked_south["S"] = False
    result_blocked = target_windows(df, target, horizon=horizon_blocked_south)
    assert result_blocked["hours"] == 0
```

**Step 2: Run tests to verify they fail**

Run (PowerShell): `python -m pytest tests/test_scoring.py -v`
Expected: FAIL — `score_label_fr`, `best_window` don't exist, `target_windows` doesn't accept
`horizon=` and the target dict shape doesn't match the current tuple-based signature.

**Step 3: Implement changes in `scoring.py`**

Replace the whole file with:

```python
"""Score horaire go/no-go, fenetres de visibilite et resume par cible."""
from itertools import groupby

import pandas as pd
from config import WEIGHTS, SEESTAR
from astro import target_altaz, moon_separation, compass_sector, TZ, COMPASS_SECTORS


def _clamp(x, lo=0.0, hi=1.0):
    return max(lo, min(hi, x))


def hourly_score(row: pd.Series) -> float:
    """Chaque sous-score va de 0 (redhibitoire) a 1 (ideal)."""
    low, mid, high = row.get("cloud_cover_low", 0), row.get("cloud_cover_mid", 0), row.get("cloud_cover_high", 0)
    clouds = 1 - _clamp((0.6 * low + 0.3 * mid + 0.1 * high) / 100)

    moon = 1.0
    if row.get("moon_alt", -90) > 0:
        moon = 1 - _clamp((row["moon_illum"] / 100) * _clamp(row["moon_alt"] / 60))

    gust = row.get("wind_gusts_10m", 0) or 0
    wind = 1 - _clamp((gust - 10) / 30)

    spread = (row.get("temperature_2m", 10) or 10) - (row.get("dew_point_2m", 0) or 0)
    dew = _clamp((spread - 1) / 5)

    s, t = row.get("seeing"), row.get("transparency")
    if pd.notna(s) and pd.notna(t):
        st = 1 - _clamp(((s - 1) / 7 + (t - 1) / 7) / 2)
    else:
        st = 0.6

    if (row.get("precipitation_probability", 0) or 0) > 50:
        return 0.0

    return round(
        WEIGHTS["clouds"] * clouds + WEIGHTS["moon"] * moon + WEIGHTS["wind"] * wind
        + WEIGHTS["dew"] * dew + WEIGHTS["seeing_transp"] * st, 3)


def score_frame(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["score"] = df.apply(hourly_score, axis=1)
    return df


def score_label_fr(score: float) -> tuple[int, str]:
    """Score 0-1 -> (pourcentage entier, etiquette francaise)."""
    pct = round(score * 100)
    if score >= 0.70:
        return pct, "Bonnes conditions"
    if score >= 0.40:
        return pct, "Conditions moyennes"
    return pct, "Mauvaises conditions"


def best_window(df: pd.DataFrame) -> str | None:
    """Plus longue plage horaire contigue avec score >= 0.6, formatee 'HH:MM\u2013HH:MM'."""
    flags = [(t, s >= 0.6) for t, s in df["score"].items()]
    runs = []
    for ok, group in groupby(flags, key=lambda x: x[1]):
        group = list(group)
        if ok:
            runs.append((group[0][0], group[-1][0]))
    if not runs:
        return None
    start, last = max(runs, key=lambda r: r[1] - r[0])
    end = last + pd.Timedelta(hours=1)
    return f"{start.strftime('%H:%M')}\u2013{end.strftime('%H:%M')}"


def night_summary(df: pd.DataFrame) -> dict:
    """Resume d'une nuit : score moyen, meilleures heures, heures 'go'."""
    if df.empty:
        return {"score": 0, "go_hours": 0, "best": None, "moon_illum": 0, "best_window": None}
    go = df[df["score"] >= 0.6]
    return {
        "score": round(df["score"].mean(), 2),
        "go_hours": len(go),
        "best": go["score"].idxmax() if not go.empty else None,
        "moon_illum": round(df["moon_illum"].max(), 0),
        "best_window": best_window(df),
    }


def target_windows(df: pd.DataFrame, target: dict, horizon: dict | None = None) -> dict:
    """Pour une cible, heures ou alt/azimut dans les plages autorisees et score OK."""
    horizon = horizon if horizon is not None else {s: True for s in COMPASS_SECTORS}
    alts, azs, seps = [], [], []
    for t in df.index:
        tl = t.to_pydatetime().replace(tzinfo=TZ)
        alt, az = target_altaz(tl, target["ra"], target["dec"])
        alts.append(alt)
        azs.append(az)
        seps.append(moon_separation(tl, target["ra"], target["dec"]))
    d = df.assign(alt=alts, az=azs, moon_sep=seps)
    d["sector"] = d["az"].apply(compass_sector)
    open_sectors = {s for s, is_open in horizon.items() if is_open}
    ok = d[(d["alt"] >= SEESTAR["min_alt_deg"]) & (d["alt"] <= SEESTAR["max_alt_deg"])
           & (d["score"] >= 0.6) & (d["sector"].isin(open_sectors))]
    if not ok.empty:
        ok = ok[~((ok["moon_alt"] > 0) & (ok["moon_sep"] < 30) & (ok["moon_illum"] > 40))]
    return {
        "name": target["name"], "type": target.get("type_fr", target.get("type", "")),
        "filter": target.get("filter", "sans"),
        "messier": target.get("messier"),
        "hours": len(ok),
        "start": ok.index.min() if not ok.empty else None,
        "end": ok.index.max() if not ok.empty else None,
        "max_alt": round(d["alt"].max(), 0),
        "min_moon_sep": round(d["moon_sep"].min(), 0),
        "size": (target.get("w"), target.get("h")),
    }
```

Note: `target_altaz`/`moon_separation` are called without a `site=` override here — the
dataframe `df` passed in was already computed for the chosen site, and re-deriving alt/az needs
to use the *same* site. Task 9 (`app.py`) will pass the active site through by having `app.py`
call a small partial/closure, OR (simpler) `scoring.py` can accept `site` too. **Use the simpler
option:** add `site: dict = SITE` to `target_windows` and thread it into the two calls. Update
the import line to `from config import WEIGHTS, SEESTAR, SITE` and the two call sites to pass
`site=site`. Re-run the test suite after this small addition (it doesn't change any test
expectations since tests don't pass `site`, so default applies).

**Step 4: Run tests to verify they pass**

Run (PowerShell): `python -m pytest tests/test_scoring.py -v`
Expected: 5 passed

**Step 5: Run the full test suite**

Run (PowerShell): `python -m pytest -v`
Expected: all passing.

**Step 6: Commit**

```bash
git add scoring.py tests/test_scoring.py
git commit -m "feat: add French score labels, best-window finder, horizon-aware target filtering"
```

---

### Task 7: Catalog data generation (`scripts/build_catalog.py`)

**Files:**
- Create: `scripts/build_catalog.py`
- Creates (generated, committed): `data/ngc_seestar.csv`, `data/messier.csv`

**Step 1: Write the script**

```python
"""Genere data/ngc_seestar.csv (cibles largement imageables au Seestar S50) et
data/messier.csv (les 110 objets Messier) a partir du catalogue OpenNGC.

Usage ponctuel (pas execute au runtime de l'appli) :
    python scripts/build_catalog.py
"""
import csv
import io
import urllib.request
from pathlib import Path

NGC_URL = "https://raw.githubusercontent.com/mattiaverga/OpenNGC/master/database_files/NGC.csv"
DATA_DIR = Path(__file__).parent.parent / "data"
MAG_CUTOFF = 12.0

GOOD_TYPES = {"G", "GPair", "GTrpl", "GGroup", "GCl", "OCl", "Cl+N", "PN",
              "Neb", "HII", "EmN", "RfN", "SNR", "*Ass"}

TYPE_FR = {
    "G": "galaxie", "GPair": "galaxie", "GTrpl": "galaxie", "GGroup": "galaxie",
    "GCl": "amas globulaire", "OCl": "amas ouvert", "Cl+N": "amas + nebuleuse",
    "PN": "nebuleuse planetaire", "Neb": "nebuleuse", "EmN": "nebuleuse",
    "HII": "region HII", "RfN": "nebuleuse par reflexion",
    "SNR": "remanent de supernova", "*Ass": "association d'etoiles",
    "**": "etoile double",
}
LP_FILTER_TYPES = {"PN", "Neb", "EmN", "HII", "SNR", "Cl+N"}

FIELDNAMES = ["name", "common_name", "type", "type_fr", "ra_h", "dec_deg",
              "size_w_arcmin", "size_h_arcmin", "mag", "filter", "messier"]

# Objets Messier absents (ou non tagges "M") dans OpenNGC : ajoutes a la main.
# M102 = NGC 5866 (identification usuelle ; note OpenNGC "This may be M102").
MANUAL_MESSIER = [
    # M,    Name,        Type, RA,            Dec,          MajAx, MinAx, Mag,   Common
    ("040", "Winnecke 4", "**", "12:22:12.5", "+58:05:00", "", "", "9.0", ""),
    ("045", "Pleiades", "OCl", "03:47:24.0", "+24:07:00", "110", "110", "1.6", "Pleiades"),
    ("102", "NGC 5866", "G", "15:06:29.50", "+55:45:47.6", "6.31", "2.72", "9.89", ""),
]


def _ra_to_hours(ra: str) -> float:
    h, m, s = ra.split(":")
    return round(int(h) + int(m) / 60 + float(s) / 3600, 4)


def _dec_to_degrees(dec: str) -> float:
    sign = -1 if dec.strip().startswith("-") else 1
    d, m, s = dec.lstrip("+-").split(":")
    return round(sign * (int(d) + int(m) / 60 + float(s) / 3600), 4)


def _mag(row: dict) -> float | None:
    for key in ("V-Mag", "B-Mag"):
        if row.get(key):
            return float(row[key])
    return None


def _to_row(row: dict) -> dict:
    display_name = f"M{int(row['M'])}" if row.get("M") else row["Name"]
    common = row["Common names"].split(",")[0].strip() if row.get("Common names") else ""
    filt = "LP" if row["Type"] in LP_FILTER_TYPES else "sans"
    mag = _mag(row)
    return {
        "name": display_name,
        "common_name": common,
        "type": row["Type"],
        "type_fr": TYPE_FR.get(row["Type"], "autre"),
        "ra_h": _ra_to_hours(row["RA"]),
        "dec_deg": _dec_to_degrees(row["Dec"]),
        "size_w_arcmin": row.get("MajAx") or "",
        "size_h_arcmin": row.get("MinAx") or row.get("MajAx") or "",
        "mag": mag if mag is not None else "",
        "filter": filt,
        "messier": str(int(row["M"])) if row.get("M") else "",
    }


def main():
    with urllib.request.urlopen(NGC_URL) as resp:
        text = resp.read().decode("utf-8")
    rows = list(csv.DictReader(io.StringIO(text), delimiter=";"))

    messier_rows = [row for row in rows if row.get("M")]
    for m, name, typ, ra, dec, majax, minax, mag, common in MANUAL_MESSIER:
        messier_rows.append({
            "Name": name, "Type": typ, "RA": ra, "Dec": dec,
            "MajAx": majax, "MinAx": minax, "B-Mag": "", "V-Mag": mag,
            "M": m, "Common names": common,
        })

    target_rows = [row for row in rows if row["Type"] in GOOD_TYPES
                   and _mag(row) is not None and _mag(row) <= MAG_CUTOFF]

    DATA_DIR.mkdir(exist_ok=True)
    for filename, source in (("ngc_seestar.csv", target_rows), ("messier.csv", messier_rows)):
        out_rows = sorted((_to_row(row) for row in source), key=lambda r: r["ra_h"])
        with open(DATA_DIR / filename, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
            writer.writeheader()
            writer.writerows(out_rows)
        print(f"wrote {len(out_rows)} rows to {filename}")


if __name__ == "__main__":
    main()
```

**Step 2: Run it**

Run (PowerShell): `python scripts/build_catalog.py`
Expected output:
```
wrote <N> rows to ngc_seestar.csv
wrote 110 rows to messier.csv
```
(`<N>` should be roughly 1700-1800 with `MAG_CUTOFF = 12.0` against the live OpenNGC data —
sanity-check it's in that ballpark, not e.g. 0 or 13000.)

**Step 3: Spot-check the output**

Run (PowerShell):
```powershell
Select-String -Path data\messier.csv -Pattern "^M31,|^M45,|^M102,"
```
Expected: three matching lines, confirming M31, M45 (manual), and M102 (manual) are present.

**Step 4: Commit**

```bash
git add scripts/build_catalog.py data/ngc_seestar.csv data/messier.csv
git commit -m "feat: generate Seestar-feasible target catalog and full Messier-110 list from OpenNGC"
```

---

### Task 8: Catalog loader (`catalog.py`)

**Files:**
- Modify: `catalog.py` (replace the hardcoded `TARGETS` list entirely)
- Test: `tests/test_catalog.py`
- Test fixture: `tests/fixtures/sample_catalog.csv`

**Step 1: Create the test fixture**

```csv
name,common_name,type,type_fr,ra_h,dec_deg,size_w_arcmin,size_h_arcmin,mag,filter,messier
M31,Andromeda Galaxy,G,galaxie,0.7123,41.685,190,60,3.44,sans,31
M42,Orion Nebula,Neb,nebuleuse,5.5883,-5.391,65,60,4.0,LP,42
Winnecke 4,,**,etoile double,12.37,58.0833,,,9.0,sans,40
```

**Step 2: Write the failing tests**

```python
# tests/test_catalog.py
from pathlib import Path

from catalog import _load_csv

FIXTURE = Path(__file__).parent / "fixtures" / "sample_catalog.csv"


def test_load_csv_parses_known_fields():
    rows = _load_csv(FIXTURE)
    assert len(rows) == 3
    m31 = next(r for r in rows if r["name"] == "M31")
    assert m31["ra"] == 0.7123
    assert m31["dec"] == 41.685
    assert m31["w"] == 190.0
    assert m31["h"] == 60.0
    assert m31["filter"] == "sans"
    assert m31["messier"] == "31"
    assert m31["common_name"] == "Andromeda Galaxy"


def test_load_csv_handles_missing_size_as_none():
    rows = _load_csv(FIXTURE)
    double_star = next(r for r in rows if r["name"] == "Winnecke 4")
    assert double_star["w"] is None
    assert double_star["h"] is None
```

**Step 3: Run tests to verify they fail**

Run (PowerShell): `python -m pytest tests/test_catalog.py -v`
Expected: FAIL — `catalog.py` still exports the old `TARGETS` tuple list, no `_load_csv`.

**Step 4: Implement `catalog.py`**

```python
"""Chargement du catalogue de cibles (genere par scripts/build_catalog.py)."""
import csv
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"


def _load_csv(path: Path) -> list[dict]:
    rows = []
    with open(path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            rows.append({
                "name": row["name"],
                "common_name": row["common_name"],
                "type": row["type"],
                "type_fr": row["type_fr"],
                "ra": float(row["ra_h"]),
                "dec": float(row["dec_deg"]),
                "w": float(row["size_w_arcmin"]) if row["size_w_arcmin"] else None,
                "h": float(row["size_h_arcmin"]) if row["size_h_arcmin"] else None,
                "mag": float(row["mag"]) if row["mag"] else None,
                "filter": row["filter"],
                "messier": row["messier"] or None,
            })
    return rows


def load_targets() -> list[dict]:
    """Catalogue large (cibles jugees imageables au Seestar S50)."""
    return _load_csv(DATA_DIR / "ngc_seestar.csv")


def load_messier() -> list[dict]:
    """Les 110 objets du catalogue Messier."""
    return _load_csv(DATA_DIR / "messier.csv")
```

**Step 5: Run tests to verify they pass**

Run (PowerShell): `python -m pytest tests/test_catalog.py -v`
Expected: 2 passed

**Step 6: Run the full suite + a manual load of the real generated data**

Run (PowerShell):
```powershell
python -m pytest -v
python -c "from catalog import load_targets, load_messier; print(len(load_targets()), len(load_messier()))"
```
Expected: all tests pass; the second command prints two numbers, the second one being `110`.

**Step 7: Commit**

```bash
git add catalog.py tests/test_catalog.py tests/fixtures/sample_catalog.csv
git commit -m "feat: replace hardcoded target list with CSV-backed catalog loader"
```

---

### Task 9: `app.py` rewrite — French UI, 24h, tabs, cards, horizon/address sidebar

**Files:**
- Modify: `app.py` (full rewrite)

This task has no automated tests (Streamlit UI) — it's verified manually in Task 11. Because
it's UI-only and the riskiest task to get exactly right on the first pass, treat this as a
starting point to iterate on live in the browser rather than a final draft.

**Step 1: Replace `app.py`**

```python
"""Tableau de bord Streamlit : score astro, cibles par direction/horizon, suivi Messier."""
from datetime import date, timedelta

import pandas as pd
import streamlit as st

from config import SITE, NB_NIGHTS, VIEW_WINDOW, SEESTAR
from weather import fetch_all
from astro import night_hours, sky_frame, fits_in_fov, twilight_times, COMPASS_SECTORS
from scoring import score_frame, night_summary, target_windows, score_label_fr
from catalog import load_targets, load_messier
from geocode import geocode, GeocodeError
import progress as progress_store

st.set_page_config(page_title="Planificateur Seestar", page_icon="\U0001F52D", layout="wide")

st.markdown("""
<style>
.card {
    background: rgba(127, 127, 127, 0.07);
    border: 1px solid rgba(127, 127, 127, 0.2);
    border-radius: 12px;
    padding: 1rem 1.25rem;
    margin-bottom: 0.75rem;
}
.card h4 { margin: 0 0 0.25rem 0; font-size: 0.85rem; opacity: 0.7; text-transform: uppercase; }
.card .value { font-size: 1.8rem; font-weight: 600; }
.card .sub { font-size: 0.85rem; opacity: 0.7; }
</style>
""", unsafe_allow_html=True)


# --- Etat de session : site actif + progression locale ---------------------
if "site" not in st.session_state:
    st.session_state.site = dict(SITE)
if "progress" not in st.session_state:
    st.session_state.progress = progress_store.load()

site = st.session_state.site
prog = st.session_state.progress

st.title(f"\U0001F52D Planificateur Seestar : {site['name']}")

# --- Barre laterale ----------------------------------------------------------
with st.sidebar:
    st.header("Position")
    address = st.text_input("Adresse", value="7 rue Saint Jean, 51240 Marson, France")
    if st.button("Mettre a jour la position"):
        try:
            result = geocode(address)
            st.session_state.site = {**site, "lat": result["lat"], "lon": result["lon"],
                                      "name": result["display_name"].split(",")[0]}
            st.rerun()
        except GeocodeError as e:
            st.error(str(e))

    st.header("Horizon degage")
    st.caption("Cochez les directions ou le ciel est degage depuis votre poste.")
    cols = st.columns(4)
    for i, sector in enumerate(COMPASS_SECTORS):
        with cols[i % 4]:
            checked = st.checkbox(sector, value=prog["horizon"].get(sector, False), key=f"h_{sector}")
            if checked != prog["horizon"].get(sector, False):
                prog["horizon"][sector] = checked
                progress_store.save(prog)

    st.header("Fenetre d'observation")
    mode = st.radio("Plage horaire", ["Habituelle (20:00\u201322:30)", "Nuit complete"], index=0)


@st.cache_data(ttl=1800)
def load(site_key: tuple):
    site_dict = dict(zip(("name", "lat", "lon", "elevation_m", "tz"), site_key))
    wx = fetch_all(days=NB_NIGHTS + 1, site=site_dict)
    nights = {}
    twilights = {}
    for i in range(NB_NIGHTS):
        d = date.today() + timedelta(days=i)
        hrs = night_hours(d, site=site_dict)
        if not hrs:
            continue
        sky = sky_frame(hrs, site=site_dict)
        df = sky.join(wx, how="left")
        nights[d] = score_frame(df)
        twilights[d] = twilight_times(d, site=site_dict)
    return nights, twilights


with st.spinner("Chargement meteo + ephemerides..."):
    site_key = (site["name"], site["lat"], site["lon"], site["elevation_m"], site["tz"])
    nights, twilights = load(site_key)

if not nights:
    st.error("Aucune donnee de nuit disponible pour les prochains jours.")
    st.stop()

tab_ce_soir, tab_messier = st.tabs(["Ce soir", "Catalogue Messier"])

with tab_ce_soir:
    st.subheader("Nuits a venir")
    cols = st.columns(len(nights))
    for col, (d, df) in zip(cols, nights.items()):
        s = night_summary(df)
        pct, label = score_label_fr(s["score"])
        emoji = "\U0001F7E2" if s["score"] >= 0.7 else "\U0001F7E1" if s["score"] >= 0.5 else "\U0001F534"
        col.metric(f"{emoji} {d.strftime('%a %d/%m')}", f"{pct}/100", label)
        col.caption(f"Lune {s['moon_illum']:.0f} %")

    sel = st.selectbox("Detail de la nuit", list(nights.keys()),
                        format_func=lambda d: d.strftime("%A %d %B"))
    df = nights[sel]
    tw = twilights[sel]
    s = night_summary(df)
    pct, label = score_label_fr(s["score"])

    if mode.startswith("Habituelle"):
        start_h, end_h = VIEW_WINDOW["start_hour"], VIEW_WINDOW["end_hour"]
        mask = df.index.map(lambda t: start_h <= t.hour + t.minute / 60 <= end_h)
        view_df = df[mask]
        if view_df.empty:
            view_df = df
    else:
        view_df = df

    c1, c2, c3, c4 = st.columns(4)
    with c1:
        st.markdown(f'<div class="card"><h4>Astro score</h4><div class="value">{pct}/100</div>'
                    f'<div class="sub">{label}</div></div>', unsafe_allow_html=True)
    with c2:
        cloud_now = round(df["cloud_cover"].mean()) if "cloud_cover" in df else 0
        st.markdown(f'<div class="card"><h4>Nuages</h4><div class="value">{cloud_now}%</div>'
                    f'<div class="sub">Moyenne de la nuit</div></div>', unsafe_allow_html=True)
    with c3:
        spread = (df["temperature_2m"] - df["dew_point_2m"]).min()
        risk = "Faible" if spread >= 3 else "Moyen" if spread >= 1.5 else "Eleve"
        advice = "Pas necessaire" if spread >= 3 else "Recommande" if spread >= 1.5 else "Indispensable"
        st.markdown(f'<div class="card"><h4>Risque de buee (ecart {spread:.1f} deg)</h4>'
                    f'<div class="value">{risk}</div>'
                    f'<div class="sub">Anti-buee : {advice}</div></div>', unsafe_allow_html=True)
    with c4:
        window_text = s["best_window"] or "Aucune"
        st.markdown(f'<div class="card"><h4>Meilleure fenetre</h4>'
                    f'<div class="value">{window_text}</div>'
                    f'<div class="sub">Fenetre astro {tw["astro_dusk"].strftime("%H:%M")}'
                    f'\u2013{tw["astro_dawn"].strftime("%H:%M")}</div></div>', unsafe_allow_html=True)

    st.caption(
        f"Crepuscule civil {tw['civil_dusk'].strftime('%H:%M')} \u00b7 "
        f"nautique {tw['nautical_dusk'].strftime('%H:%M')} \u00b7 "
        f"astronomique {tw['astro_dusk'].strftime('%H:%M')}  —  "
        f"Aube astronomique {tw['astro_dawn'].strftime('%H:%M')} \u00b7 "
        f"nautique {tw['nautical_dawn'].strftime('%H:%M')} \u00b7 "
        f"civile {tw['civil_dawn'].strftime('%H:%M')}"
    )

    st.subheader("Tendance nuages")
    st.line_chart(view_df[["cloud_cover_low", "cloud_cover_mid", "cloud_cover_high"]], height=220)

    st.subheader("Point de rosee")
    st.line_chart(view_df[["temperature_2m", "dew_point_2m"]], height=220)

    with st.expander("Donnees horaires"):
        st.dataframe(view_df[["score", "cloud_cover_low", "cloud_cover_mid", "cloud_cover_high",
                               "wind_gusts_10m", "temperature_2m", "dew_point_2m",
                               "moon_alt", "moon_illum", "seeing", "transparency"]].round(1))

    st.subheader(f"Cibles faisables : nuit du {sel.strftime('%d/%m')}")
    rows = []
    for tgt in load_targets():
        w = target_windows(view_df, tgt, horizon=prog["horizon"])
        if w["hours"] == 0:
            continue
        rows.append({
            "Cible": w["name"], "Nom commun": tgt.get("common_name", ""), "Type": w["type"],
            "Filtre": w["filter"], "Debut": w["start"].strftime("%H:%M"),
            "Fin": w["end"].strftime("%H:%M"), "Heures": w["hours"],
            "Alt max deg": w["max_alt"], "Lune deg": w["min_moon_sep"],
            "Cadrage": fits_in_fov(*w["size"]) if all(w["size"]) else "taille inconnue",
        })
    if rows:
        st.dataframe(pd.DataFrame(rows).sort_values("Heures", ascending=False),
                     use_container_width=True, hide_index=True)
    else:
        st.info("Aucune cible exploitable cette nuit (meteo, Lune ou horizon degage).")

with tab_messier:
    st.subheader("Catalogue Messier")
    captured = set(prog["messier_captured"])
    st.progress(len(captured) / 110, text=f"{len(captured)}/110 captures")

    sel_m = st.selectbox("Nuit consideree", list(nights.keys()),
                          format_func=lambda d: d.strftime("%A %d %B"), key="messier_night")
    df_m = nights[sel_m]

    rows = []
    for tgt in load_messier():
        w = target_windows(df_m, tgt, horizon=prog["horizon"])
        rows.append({
            "id": tgt["messier"],
            "Messier": tgt["name"],
            "Nom commun": tgt.get("common_name", ""),
            "Type": w["type"],
            "Faisable ce soir": "Oui" if w["hours"] > 0 else "Non",
            "Heures": w["hours"],
            "Capture": tgt["messier"] in captured,
        })
    rows.sort(key=lambda r: int(r["id"]))

    for row in rows:
        c1, c2, c3, c4 = st.columns([1, 3, 2, 2])
        c1.write(row["Messier"])
        c2.write(row["Nom commun"] or "\u2014")
        c3.write(f"{row['Type']} \u00b7 {row['Faisable ce soir']} ({row['Heures']}h)")
        new_val = c4.checkbox("Capture", value=row["Capture"], key=f"cap_{row['id']}")
        if new_val != row["Capture"]:
            progress_store.toggle_messier(prog, row["id"])
            progress_store.save(prog)
            st.rerun()
```

**Step 2: Run the app manually**

(Covered fully in Task 11 — this step is just a quick smoke check.)

Run (PowerShell, background): `python -m streamlit run app.py --server.headless true`
Expected: starts without a Python traceback in the terminal; note the local URL it prints
(typically `http://localhost:8501`).

**Step 3: Commit**

```bash
git add app.py
git commit -m "feat: rewrite UI with French copy, 24h times, tabs, cards, and horizon-aware target table"
```

---

### Task 10: README update

**Files:**
- Modify: `README.md`

**Step 1: Update to reflect the new setup/features**

```markdown
# Seestar Planner

Planificateur de sessions Seestar S50 : score astro go/no-go, cibles filtrees par direction
degagee et par nuit, suivi de completion du catalogue Messier (110 objets).

## Installation

    pip install -r requirements.txt -r requirements-dev.txt
    python scripts/build_catalog.py   # genere data/ngc_seestar.csv et data/messier.csv
    streamlit run app.py

## Tests

    pytest -v

## Sources
- Open-Meteo, modele AROME Meteo-France (1.3 km) : nuages par couche, vent, rosee, pluie
- 7Timer ASTRO (GFS, 3 h) : seeing et transparence
- PyEphem : Soleil, Lune, altitude/azimut des cibles, crepuscules
- OpenNGC (github.com/mattiaverga/OpenNGC) : catalogue de cibles et liste Messier
- Nominatim (OpenStreetMap) : geocodage d'adresse

## Fichiers
- config.py            : coordonnees par defaut, champ du Seestar, ponderations, horizon par defaut
- weather.py            : appels API meteo
- astro.py              : ephemerides, secteurs cardinaux, crepuscules
- geocode.py            : adresse -> lat/lon
- progress.py           : persistance locale (horizon configure, Messiers captures)
- catalog.py             : chargement des catalogues (CSV generes)
- scripts/build_catalog.py : generation ponctuelle des CSV depuis OpenNGC
- scoring.py            : score horaire, fenetres de visibilite, score francais
- app.py                : dashboard Streamlit (onglets "Ce soir" / "Catalogue Messier")
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README for new setup steps and module layout"
```

---

### Task 11: Manual verification in the browser

Not automated — do this live before considering the feature done.

**Step 1: Install/refresh dependencies and generate data if not already done**

Run (PowerShell):
```powershell
python -m pip install -r requirements.txt -r requirements-dev.txt
python scripts/build_catalog.py
python -m pytest -v
```
Expected: all tests pass, catalog files exist.

**Step 2: Launch the app**

Run (PowerShell, background/long-running): `streamlit run app.py`

**Step 3: Walk through the golden path**

- Confirm the title shows "Marson" (or the geocoded address name) and all copy is French.
- Confirm times throughout are 24h (`HH:MM`), no AM/PM anywhere.
- Change the address field to something else (e.g. a nearby town) and click "Mettre a jour la
  position" — confirm it re-geocodes and the header/site name updates without crashing.
- Toggle horizon sector checkboxes — confirm the "Cibles faisables" table on the "Ce soir" tab
  changes (fewer/more rows) when you close/open sectors, and that the choice persists across a
  manual page refresh (reads back from `data/progress.json`).
- Switch between "Habituelle (20:00-22:30)" and "Nuit complete" — confirm the cloud/dew charts
  and the astro-score card visibly change range.
- Open the "Catalogue Messier" tab, check a few boxes, refresh the page, confirm they're still
  checked and the progress bar reflects the count.
- Confirm the dew card's advice text (Pas necessaire / Recommande / Indispensable) looks
  sensible against the displayed temperature/dew-point spread.

**Step 4: Check for exceptions in the terminal**

Watch the terminal running `streamlit run app.py` for tracebacks while performing Step 3.
Expected: none.

**Step 5: Stop the server**

Stop the background Streamlit process once verification is complete.

---

## Summary of new/changed files

- New: `geocode.py`, `progress.py`, `scripts/build_catalog.py`, `data/ngc_seestar.csv`,
  `data/messier.csv`, `data/.gitkeep`, `.gitignore`, `requirements-dev.txt`,
  `tests/` (conftest + 4 test modules + 1 fixture)
- Modified: `config.py`, `astro.py`, `weather.py`, `scoring.py`, `catalog.py`, `app.py`,
  `README.md`
