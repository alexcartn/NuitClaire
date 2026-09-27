"""Genere les donnees de NuitClaire Garmin (repo nuit-clair-garmin) depuis
celles de NuitClaire : NuitClaire reste la seule source, la montre n'a pas
de catalogue a elle.

    python scripts/build_garmin.py ../nuit-clair-garmin

Ecrit, dans le repo de la montre :
- resources/jsonData/targets.json : les cibles qu'une paire de jumelles peut
  montrer (voir optics.py), en tableaux compacts : la memoire d'une montre
  se compte en centaines de Ko, et un dictionnaire par cible couterait
  plusieurs fois plus ;
- resources/jsonData/types.json : types d'objets, nom francais et ce qu'on
  voit dans l'oculaire (voir binocular_now.py) ;
- source/test/ReferenceTests.mc : valeurs calculees ici (ephem), que les
  tests de la montre comparent aux siennes.

Le tri des cibles faciles est porte sur la montre (source/Picks.mc) ; il
doit suivre `binocular_now.binocular_picks`. Changer l'un, c'est changer
l'autre."""
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import ephem

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from binocular_now import _LOOK, _NEBULAE, binocular_catalog, binocular_picks  # noqa: E402
from catalog import french_name  # noqa: E402
from optics import MOON_TOLERANT_TYPES, _POINT_LIKE_TYPES, SURFACE_BRIGHTNESS_LIMIT, surface_brightness, visual_limit_mag  # noqa: E402

# Les plus grandes jumelles reglables sur la montre : le filtre fin, selon le
# diametre choisi, se fait sur la montre.
MAX_APERTURE_MM = 80

# Drapeaux, un bit chacun (voir source/Catalog.mc).
POINT_LIKE = 1
MOON_TOLERANT = 2
NEBULA = 4
MESSIER = 8

# Lieux et heures des valeurs de reference : trois latitudes, trois moments.
REFERENCE_SITES = [
    ("Marson", 48.99, 4.53, "Europe/Paris"),
    ("Nice", 43.70, 7.27, "Europe/Paris"),
    ("Oslo", 59.91, 10.75, "Europe/Oslo"),
]
REFERENCE_TIMES = ["2026-09-26T21:30:00Z", "2026-01-15T19:00:00Z", "2026-06-21T22:45:00Z"]
REFERENCE_TARGETS = ["M31", "M45", "M13", "M42", "Cr399", "Mel20"]


def keep_for_binoculars(tgt: dict) -> bool:
    """`optics.visible_in_binoculars` pour les plus grandes jumelles reglables."""
    mag = tgt.get("mag")
    if mag is None or mag > visual_limit_mag(MAX_APERTURE_MM):
        return False
    if tgt.get("type") in _POINT_LIKE_TYPES:
        return True
    size = max(tgt.get("w") or 0, tgt.get("h") or 0)
    if size < 1.0:
        return False
    sb = surface_brightness(tgt)
    return sb is None or sb <= SURFACE_BRIGHTNESS_LIMIT


def build_catalog() -> tuple[list, list]:
    types: list[list[str]] = []
    type_index: dict[str, int] = {}
    rows, seen = [], set()
    for tgt in binocular_catalog():
        if tgt["name"] in seen or not keep_for_binoculars(tgt):
            continue
        seen.add(tgt["name"])
        kind = tgt.get("type", "")
        if kind not in type_index:
            type_index[kind] = len(types)
            types.append([kind, tgt.get("type_fr", ""), _LOOK.get(kind, tgt.get("type_fr", ""))])
        flags = ((POINT_LIKE if kind in _POINT_LIKE_TYPES else 0)
                 | (MOON_TOLERANT if kind in MOON_TOLERANT_TYPES else 0)
                 | (NEBULA if kind in _NEBULAE else 0)
                 | (MESSIER if tgt.get("messier") else 0))
        sb = surface_brightness(tgt)
        size = max(tgt.get("w") or 0, tgt.get("h") or 0)
        rows.append([
            tgt["name"],
            round(tgt["ra"] * 15, 3),
            round(tgt["dec"], 3),
            round(tgt["mag"], 1),
            round(sb, 1) if sb is not None else -1,
            round(size, 1),
            flags,
            type_index[kind],
            french_name(tgt) or tgt.get("common_name") or "",
        ])
    return rows, types


def _observer(lat: float, lon: float, when: datetime) -> ephem.Observer:
    obs = ephem.Observer()
    obs.lat, obs.lon = str(lat), str(lon)
    obs.date = when.replace(tzinfo=None)
    obs.pressure = 0  # sans refraction, comme la montre
    obs.epoch = ephem.J2000  # positions J2000, comme le catalogue
    return obs


def reference_cases(rows: list) -> dict:
    by_name = {r[0]: r for r in rows}
    positions, sidereal, moons, picks = [], [], [], []
    for (site, lat, lon, tz), iso in [(s, t) for s in REFERENCE_SITES for t in REFERENCE_TIMES]:
        when = datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(timezone.utc)
        epoch = int(when.timestamp())
        obs = _observer(lat, lon, when)
        sidereal.append((epoch, lon, math.degrees(obs.sidereal_time())))
        for name in REFERENCE_TARGETS:
            r = by_name[name]
            body = ephem.FixedBody()
            body._ra, body._dec = math.radians(r[1]), math.radians(r[2])
            body._epoch = ephem.J2000
            body.compute(obs)
            positions.append((name, epoch, lat, lon, math.degrees(body.alt), math.degrees(body.az)))
        moon = ephem.Moon(obs)
        moons.append((epoch, lat, lon, math.degrees(moon.alt), math.degrees(moon.az), float(moon.phase)))
        # Toutes directions libres, jumelles par defaut (10x50, 6,5 deg, 15 deg).
        horizon = {s: True for s in ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]}
        optics = {"fov_deg": 6.5, "aperture_mm": 50.0, "min_alt_deg": 15.0, "max_alt_deg": 90.0}
        local = when.astimezone(ZoneInfo(tz)).replace(tzinfo=None)
        got = binocular_picks({"lat": lat, "lon": lon, "tz": tz, "elevation_m": 0}, horizon, optics, local)
        picks.append((site, epoch, lat, lon, [p["designation"] for p in got]))
    return {"positions": positions, "sidereal": sidereal, "moons": moons, "picks": picks}


def _f(v: float) -> str:
    return f"{v:.4f}d"


def write_tests(cases: dict, path: Path) -> None:
    pos = ",\n        ".join(
        f'["{n}", {e}, {_f(la)}, {_f(lo)}, {_f(alt)}, {_f(az)}]' for n, e, la, lo, alt, az in cases["positions"])
    sid = ",\n        ".join(f"[{e}, {_f(lo)}, {_f(lst)}]" for e, lo, lst in cases["sidereal"])
    moons = ",\n        ".join(
        f"[{e}, {_f(la)}, {_f(lo)}, {_f(alt)}, {_f(az)}, {_f(ph)}]" for e, la, lo, alt, az, ph in cases["moons"])
    picks = ",\n        ".join(
        f'["{s}", {e}, {_f(la)}, {_f(lo)}, [{", ".join(chr(34) + d + chr(34) for d in ds)}]]'
        for s, e, la, lo, ds in cases["picks"])
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(f"""// Genere par NuitClaire : scripts/build_garmin.py. Ne pas modifier a la main.
//
// Valeurs calculees par NuitClaire (ephem, sans refraction, positions J2000),
// que les tests de la montre comparent aux siennes (voir AstroTests.mc).
import Toybox.Lang;

(:test)
module ReferenceData {{
    // [cible, instant (s, UTC), latitude, longitude, hauteur, azimut]
    const POSITIONS = [
        {pos}
    ];

    // [instant, longitude, temps sideral local (deg)]
    const SIDEREAL = [
        {sid}
    ];

    // [instant, latitude, longitude, hauteur, azimut, eclairement (%)]
    const MOONS = [
        {moons}
    ];

    // [lieu, instant, latitude, longitude, cibles faciles de NuitClaire]
    // Horizon libre partout, jumelles 10x50.
    const PICKS = [
        {picks}
    ];
}}
""", encoding="utf-8")


def main(out: Path) -> None:
    rows, types = build_catalog()
    data = out / "resources" / "jsonData"
    data.mkdir(parents=True, exist_ok=True)
    (data / "targets.json").write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (data / "types.json").write_text(json.dumps(types, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    write_tests(reference_cases(rows), out / "source" / "test" / "ReferenceTests.mc")
    print(f"{len(rows)} cibles, {len(types)} types -> {out}")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
