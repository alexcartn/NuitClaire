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
- resources/jsonData/hops_N.json : les chemins d'etoiles, precalcules
  (starhop.plan_hops) : le chemin d'une etoile repere a une cible ne depend
  pas de l'heure, seule son orientation tourne avec le ciel, et la montre
  s'en charge. Par paquets de HOP_CHUNK cibles : la montre ne charge que
  celui de la cible choisie ;
- resources/jsonData/sky.json : etoiles jusqu'a la magnitude 4,5 et traces
  des constellations, pour la carte du ciel ;
- resources/jsonData/jsonData.xml et source/HopChunks.mc : la liste de ces
  ressources, que Monkey C ne sait pas parcourir seul ;
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
from starhop import DIRECTIONS, load_lines, load_stars, plan_hops, separation, star_hop, _interpolate  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_stars import MOBILE_NAMES  # noqa: E402
from optics import MOON_TOLERANT_TYPES, _POINT_LIKE_TYPES, SURFACE_BRIGHTNESS_LIMIT, surface_brightness, visual_limit_mag  # noqa: E402

# Les plus grandes jumelles reglables sur la montre : le filtre fin, selon le
# diametre choisi, se fait sur la montre.
MAX_APERTURE_MM = 80

# Chemins d'etoiles : champ de reference (10x50), cibles par paquet, et
# etoiles de fond de la mini-carte (les plus brillantes autour du chemin).
HOP_FOV = 6.5
HOP_CHUNK = 16
HOP_BACKGROUND_MAX = 60
HOP_BACKGROUND_MAG = 6.0

# Carte du ciel de la montre : etoiles visibles sans peine a l'oeil nu.
SKY_MAX_MAG = 4.5

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
# Chemins d'etoiles de reference : assez longs pour avoir des directions.
REFERENCE_HOPS = ["M31", "M13", "M57", "M27", "M81", "M33", "Cr399", "M15", "M92", "M39"]


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


def star_name(star: dict) -> str:
    """Nom court d'une etoile sur la montre : le nom francais des reperes
    (« Véga »), sinon son nom ou sa designation (« Mirach », « μ And »)."""
    return MOBILE_NAMES.get(star["name"], "") or star["name"] or star["desig"] or ""


def build_hops(rows: list) -> list:
    """Pour chaque cible, dans l'ordre du catalogue : [points, etoiles].
    points : [ra, dec, nom, magnitude] de l'etoile de depart aux jalons,
    la cible en dernier (nom vide) ; etoiles : [ra, dec, magnitude] autour
    du chemin, pour la mini-carte."""
    stars = [s for s in load_stars() if s["mag"] <= HOP_BACKGROUND_MAG]
    out = []
    for r in rows:
        ra, dec = r[1], r[2]
        plan = plan_hops(ra, dec, HOP_FOV)
        points = []
        for p in plan["points"]:
            star = p.get("star")
            if p.get("target"):
                points.append([round(ra, 3), round(dec, 3), "", r[3]])
            elif star:
                points.append([round(p["ra"], 3), round(p["dec"], 3), star_name(star), round(star["mag"], 1)])
            else:
                points.append([round(p["ra"], 3), round(p["dec"], 3), "", 99])
        a = plan["anchor"]
        mra, mdec = _interpolate(a["ra"], a["dec"], ra, dec, 0.5)
        radius = plan["distance_deg"] / 2 + HOP_FOV
        near = sorted((s for s in stars if separation(mra, mdec, s["ra"], s["dec"]) <= radius), key=lambda s: s["mag"])
        background = [[round(s["ra"], 2), round(s["dec"], 2), round(s["mag"], 1)] for s in near[:HOP_BACKGROUND_MAX]]
        out.append([points, background])
    return out


def build_sky() -> list:
    """[etoiles, traces] : etoiles [ra, dec, magnitude, nom des reperes],
    traces [ra1, dec1, ra2, dec2]."""
    stars = [[round(s["ra"], 2), round(s["dec"], 2), round(s["mag"], 1), MOBILE_NAMES.get(s["name"], "")]
             for s in load_stars() if s["mag"] <= SKY_MAX_MAG]
    lines = [[round(v, 1) for v in seg] for seg in load_lines()]
    return [stars, lines]


def write_resources(out: Path, rows: list, types: list) -> None:
    data = out / "resources" / "jsonData"
    data.mkdir(parents=True, exist_ok=True)
    for old in data.glob("hops_*.json"):
        old.unlink()
    dump = lambda name, obj: (data / name).write_text(  # noqa: E731
        json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    dump("targets.json", rows)
    dump("types.json", types)
    dump("sky.json", build_sky())
    hops = build_hops(rows)
    chunks = [hops[i:i + HOP_CHUNK] for i in range(0, len(hops), HOP_CHUNK)]
    for i, chunk in enumerate(chunks):
        dump(f"hops_{i}.json", chunk)
    entries = "\n".join(f'    <jsonData id="Hops{i}" filename="hops_{i}.json"/>' for i in range(len(chunks)))
    (data / "jsonData.xml").write_text(f"""<!-- Genere par NuitClaire (scripts/build_garmin.py) : ne pas modifier ces
     fichiers a la main. -->
<resources>
    <jsonData id="Targets" filename="targets.json"/>
    <jsonData id="Types" filename="types.json"/>
    <jsonData id="Sky" filename="sky.json"/>
{entries}
</resources>
""", encoding="utf-8")
    ids = ", ".join(f"Rez.JsonData.Hops{i}" for i in range(len(chunks)))
    (out / "source" / "HopChunks.mc").write_text(f"""// Genere par NuitClaire : scripts/build_garmin.py. Ne pas modifier a la main.
//
// Les chemins d'etoiles, par paquets de {HOP_CHUNK} cibles (ordre du catalogue) :
// la montre ne charge que le paquet de la cible choisie.
import Toybox.Lang;
import Toybox.WatchUi;

module HopChunks {{

    const SIZE = {HOP_CHUNK};

    //! [points, etoiles] de la cible d'indice `index` dans le catalogue.
    function forTarget(index as Number) as Array {{
        var ids = [{ids}];
        var chunk = WatchUi.loadResource(ids[index / SIZE]) as Array<Array>;
        return chunk[index % SIZE] as Array;
    }}
}}
""", encoding="utf-8")


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
    hops = []
    site, lat, lon, tz = REFERENCE_SITES[0]
    for iso in REFERENCE_TIMES:
        when = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        for name in REFERENCE_HOPS:
            r = by_name[name]
            got = star_hop({"ra": r[1] / 15, "dec": r[2], "name": name, "mag": r[3]}, HOP_FOV, when,
                           {"lat": lat, "lon": lon, "tz": tz, "elevation_m": 0})
            dirs = [next((d for d in DIRECTIONS if d in step), "") for step in got["steps"][1:]]
            if all(dirs):
                hops.append((name, int(when.timestamp()), lat, lon, dirs))
    return {"positions": positions, "sidereal": sidereal, "moons": moons, "picks": picks, "hops": hops}


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
    hops = ",\n        ".join(
        f'["{n}", {e}, {_f(la)}, {_f(lo)}, [{", ".join(chr(34) + d + chr(34) for d in ds)}]]'
        for n, e, la, lo, ds in cases["hops"])
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

    // [cible, instant, latitude, longitude, direction de chaque saut]
    // Champ de 6,5 deg.
    const HOPS = [
        {hops}
    ];
}}
""", encoding="utf-8")


def main(out: Path) -> None:
    rows, types = build_catalog()
    write_resources(out, rows, types)
    write_tests(reference_cases(rows), out / "source" / "test" / "ReferenceTests.mc")
    print(f"{len(rows)} cibles, {len(types)} types -> {out}")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
