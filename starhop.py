"""Chemin d'etoiles : comment trouver une cible aux jumelles, sans GoTo.

On part d'une etoile brillante qu'on trouve a l'oeil nu, puis on avance par
sauts d'environ un champ des jumelles, en s'appuyant a chaque saut sur
l'etoile la plus visible pres du point de passage, jusqu'a la cible. La
carte rendue est orientee comme le ciel a l'heure donnee (zenith en haut),
c'est-a-dire comme on le voit dans des jumelles, qui ne retournent pas
l'image.

Etoiles et traces des constellations : data/stars.csv et
data/constellation_lines.json (voir scripts/build_stars.py, d3-celestial,
BSD-3-Clause)."""
import csv
import json
import math
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

import ephem

DATA_DIR = Path(__file__).parent / "data"

ANCHOR_MAX_MAG = 3.0      # etoile de depart : evidente a l'oeil nu
STEP_MAX_MAG = 5.5        # jalon : visible sans peine aux jumelles
HOP_FRACTION = 0.75       # un saut = 3/4 de champ, pour garder un repere commun
SNAP_FRACTION = 0.35      # rayon de recherche d'un jalon autour du point de passage
DIRECTIONS = ["vers le haut", "en haut à droite", "vers la droite", "en bas à droite",
              "vers le bas", "en bas à gauche", "vers la gauche", "en haut à gauche"]


@lru_cache(maxsize=1)
def load_stars() -> list[dict]:
    with open(DATA_DIR / "stars.csv", encoding="utf-8") as f:
        return [{"ra": float(r["ra_deg"]), "dec": float(r["dec_deg"]), "mag": float(r["mag"]),
                 "name": r["name"], "desig": r["desig"]} for r in csv.DictReader(f)]


@lru_cache(maxsize=1)
def load_lines() -> list[list[float]]:
    return json.loads((DATA_DIR / "constellation_lines.json").read_text())


def star_label(star: dict) -> str:
    """« Mirach (β And) », « μ And », ou la magnitude a defaut de nom."""
    if star["name"] and star["desig"]:
        return f"{star['name']} ({star['desig']})"
    return star["name"] or star["desig"] or f"étoile de magnitude {star['mag']:.1f}".replace(".", ",")


def _vec(ra: float, dec: float) -> tuple[float, float, float]:
    a, d = math.radians(ra), math.radians(dec)
    return (math.cos(d) * math.cos(a), math.cos(d) * math.sin(a), math.sin(d))


def _radec(v: tuple[float, float, float]) -> tuple[float, float]:
    x, y, z = v
    return (math.degrees(math.atan2(y, x)) % 360, math.degrees(math.asin(max(-1.0, min(1.0, z)))))


def separation(ra1: float, dec1: float, ra2: float, dec2: float) -> float:
    a, b = _vec(ra1, dec1), _vec(ra2, dec2)
    dot = max(-1.0, min(1.0, sum(p * q for p, q in zip(a, b))))
    return math.degrees(math.acos(dot))


def _interpolate(ra1: float, dec1: float, ra2: float, dec2: float, f: float) -> tuple[float, float]:
    """Point a la fraction `f` du grand cercle entre deux positions."""
    a, b = _vec(ra1, dec1), _vec(ra2, dec2)
    omega = math.radians(separation(ra1, dec1, ra2, dec2))
    if omega < 1e-9:
        return ra1, dec1
    s = math.sin(omega)
    k1, k2 = math.sin((1 - f) * omega) / s, math.sin(f * omega) / s
    return _radec(tuple(k1 * p + k2 * q for p, q in zip(a, b)))


def choose_anchor(ra: float, dec: float, stars: list[dict] | None = None) -> dict:
    """Etoile de depart : brillante et proche. Une etoile de magnitude 1 a
    20 deg vaut mieux qu'une de magnitude 3 a 15 : le cout penalise la
    distance d'autant plus que l'etoile est faible."""
    stars = stars or load_stars()
    candidates = [s for s in stars if s["mag"] <= ANCHOR_MAX_MAG]
    return min(candidates, key=lambda s: separation(ra, dec, s["ra"], s["dec"]) * (1 + 0.25 * max(s["mag"], 0)))


def plan_hops(target_ra: float, target_dec: float, fov_deg: float) -> dict:
    """Etoile de depart, puis jalons jusqu'a la cible (positions en degres)."""
    stars = load_stars()
    anchor = choose_anchor(target_ra, target_dec, stars)
    total = separation(anchor["ra"], anchor["dec"], target_ra, target_dec)
    n = max(1, math.ceil(total / (HOP_FRACTION * fov_deg)))
    points = [{"ra": anchor["ra"], "dec": anchor["dec"], "star": anchor}]
    used = {id(anchor)}
    for k in range(1, n):
        wra, wdec = _interpolate(anchor["ra"], anchor["dec"], target_ra, target_dec, k / n)
        near = [s for s in stars if s["mag"] <= STEP_MAX_MAG and id(s) not in used
                and separation(wra, wdec, s["ra"], s["dec"]) <= SNAP_FRACTION * fov_deg]
        if near:
            best = min(near, key=lambda s: s["mag"])
            used.add(id(best))
            points.append({"ra": best["ra"], "dec": best["dec"], "star": best})
        else:
            points.append({"ra": wra, "dec": wdec, "star": None})
    points.append({"ra": target_ra, "dec": target_dec, "star": None, "target": True})
    return {"anchor": anchor, "points": points, "distance_deg": total}


def _project(ra: float, dec: float, ra0: float, dec0: float) -> tuple[float, float] | None:
    """Projection gnomonique autour de (ra0, dec0), en degres : x vers l'est
    tel qu'on le voit (a gauche quand on regarde vers le sud, d'ou le signe),
    y vers le nord. None pour un point de l'autre cote du ciel."""
    a, d, a0, d0 = map(math.radians, (ra, dec, ra0, dec0))
    cos_c = math.sin(d0) * math.sin(d) + math.cos(d0) * math.cos(d) * math.cos(a - a0)
    if cos_c <= 0.05:
        return None
    xi = math.cos(d) * math.sin(a - a0) / cos_c
    eta = (math.cos(d0) * math.sin(d) - math.sin(d0) * math.cos(d) * math.cos(a - a0)) / cos_c
    return -math.degrees(xi), math.degrees(eta)


def _zenith_rotation(ra0: float, dec0: float, when: datetime, site: dict) -> float:
    """Angle (radians) dont tourner la carte pour mettre le zenith en haut a
    l'instant `when` : on projette un point legerement plus haut dans le ciel
    que le centre, et on mesure ou il tombe."""
    obs = ephem.Observer()
    obs.lat, obs.lon = str(site["lat"]), str(site["lon"])
    obs.pressure = 0
    obs.date = when.astimezone(timezone.utc)
    body = ephem.FixedBody()
    body._ra, body._dec = ephem.hours(math.radians(ra0)), ephem.degrees(math.radians(dec0))
    body.compute(obs)
    up_ra, up_dec = obs.radec_of(body.az, float(body.alt) + math.radians(1.0))
    p = _project(math.degrees(up_ra), math.degrees(up_dec), ra0, dec0)
    if p is None:
        return 0.0
    return math.atan2(p[0], p[1])  # angle du zenith par rapport au « haut » de la carte


def _rotate(x: float, y: float, angle: float) -> tuple[float, float]:
    c, s = math.cos(angle), math.sin(angle)
    return x * c - y * s, x * s + y * c


def _direction(dx: float, dy: float) -> str:
    angle = math.degrees(math.atan2(dx, dy)) % 360  # 0 = haut, sens horaire
    return DIRECTIONS[int((angle + 22.5) // 45) % 8]


def _fmt(v: float) -> str:
    return f"{v:.1f}".replace(".", ",")


def star_hop(target: dict, fov_deg: float, when: datetime, site: dict) -> dict:
    """Chemin et carte pour `target` (catalogue : ra en heures, dec en
    degres), aux jumelles de champ `fov_deg`, oriente comme le ciel a
    l'instant `when` (datetime avec fuseau)."""
    t_ra, t_dec = target["ra"] * 15, target["dec"]
    plan = plan_hops(t_ra, t_dec, fov_deg)
    pts = plan["points"]
    ra0, dec0 = _interpolate(pts[0]["ra"], pts[0]["dec"], t_ra, t_dec, 0.5)
    rot = _zenith_rotation(ra0, dec0, when, site)

    def place(ra: float, dec: float):
        p = _project(ra, dec, ra0, dec0)
        return None if p is None else _rotate(p[0], p[1], rot)

    radius = plan["distance_deg"] / 2 + fov_deg
    stars = []
    for s in load_stars():
        if separation(ra0, dec0, s["ra"], s["dec"]) > radius:
            continue
        p = place(s["ra"], s["dec"])
        if p:
            stars.append({"x": round(p[0], 3), "y": round(p[1], 3), "mag": s["mag"],
                          "label": s["desig"] or s["name"] if s["mag"] <= 4.5 else None})
    lines = []
    for ra1, dec1, ra2, dec2 in load_lines():
        if separation(ra0, dec0, ra1, dec1) > radius * 1.6 or separation(ra0, dec0, ra2, dec2) > radius * 1.6:
            continue
        a, b = place(ra1, dec1), place(ra2, dec2)
        if a and b:
            lines.append([round(a[0], 3), round(a[1], 3), round(b[0], 3), round(b[1], 3)])

    placed = [place(p["ra"], p["dec"]) for p in pts]
    name = target.get("name", "la cible")
    steps = []
    anchor = plan["anchor"]
    steps.append(f"Trouvez {star_label(anchor)} à l'œil nu (magnitude {_fmt(anchor['mag'])}).")
    if plan["distance_deg"] < 0.5 * fov_deg:
        steps.append(f"{name} est dans le même champ : centrez les jumelles dessus.")
    for i in range(1, len(pts)) if plan["distance_deg"] >= 0.5 * fov_deg else []:
        (x1, y1), (x2, y2) = placed[i - 1], placed[i]
        deg = separation(pts[i - 1]["ra"], pts[i - 1]["dec"], pts[i]["ra"], pts[i]["dec"])
        span = f"{round(deg)}° ({_fmt(deg / fov_deg)} champ{'s' if deg / fov_deg >= 2 else ''})"
        where = _direction(x2 - x1, y2 - y1)
        if pts[i].get("target"):
            steps.append(f"{span} {where} : {name}.")
        elif pts[i]["star"]:
            star = pts[i]["star"]
            steps.append(f"{span} {where} jusqu'à {star_label(star)} (mag. {_fmt(star['mag'])}).")
        else:
            steps.append(f"{span} {where}, sans étoile marquante : gardez la direction.")

    return {
        "fovDeg": fov_deg,
        "time": when.isoformat(),
        "anchor": star_label(anchor),
        "distanceDeg": round(plan["distance_deg"], 1),
        "hops": [{"x": round(p[0], 3), "y": round(p[1], 3),
                  "label": (pts[i]["star"]["desig"] or pts[i]["star"]["name"]) if pts[i]["star"] else None,
                  "target": bool(pts[i].get("target"))}
                 for i, p in enumerate(placed)],
        "steps": steps,
        "stars": stars,
        "lines": lines,
        "radiusDeg": round(radius, 2),
        "nakedEye": (target.get("mag") or 99) <= 5.0,
    }
