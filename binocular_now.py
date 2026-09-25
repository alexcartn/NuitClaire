"""« En attendant le Seestar » : quelques cibles faciles aux jumelles, bien
placees maintenant (ou a la nuit tombee, si elle n'est pas encore la).

Pas un catalogue a parcourir : une poignee d'objets qui se trouvent vite et
se voient sans peine, pour patienter pendant que le Seestar pose. Le choix
favorise l'eclat, la hauteur et la brillance de surface, ecarte ce qu'une
Lune brillante efface, et varie les types (pas cinq amas ouverts).
"""
import math
from datetime import datetime, timedelta

import ephem

from astro import compass_sector, target_altaz
from catalog import french_name, load_binocular_extras, load_targets
from optics import MOON_TOLERANT_TYPES, surface_brightness, visible_in_binoculars, visual_limit_mag
from scoring import sector_floor

LOOKAHEAD_MIN = 60   # une cible doit rester pointable l'heure qui vient
MAX_PER_TYPE = 2
EASY_SB = 13.5       # brillance de surface d'un objet diffus « facile »
# En dessous, pas « facile » : mieux vaut une liste courte que des objets
# qu'on cherchera en vain (M57, trop petit a x10 ; nebuleuses pales).
MIN_EASE = 2.5

# Ce qu'on voit dans l'oculaire, en quelques mots.
_LOOK = {
    "OCl": "amas d'étoiles",
    "GCl": "boule floue au cœur brillant",
    "*Ass": "groupe d'étoiles brillantes",
    "Ast": "figure d'étoiles",
    "**": "couple d'étoiles, souvent coloré",
    "G": "tache ovale laiteuse",
    "PN": "petit disque flou",
    "HII": "voile lumineux diffus",
    "EmN": "voile lumineux diffus",
    "RfN": "voile pâle autour des étoiles",
    "SNR": "petite tache pâle",
    "Neb": "voile lumineux diffus",
    "Cl+N": "amas dans une nébulosité pâle",
}


def _moon(when: datetime, site: dict) -> tuple[float, float]:
    """(hauteur de la Lune en degres, eclairement en %) a `when` (heure locale naive)."""
    obs = ephem.Observer()
    obs.lat, obs.lon = str(site["lat"]), str(site["lon"])
    obs.elevation = site.get("elevation_m", 0)
    from zoneinfo import ZoneInfo
    obs.date = when.replace(tzinfo=ZoneInfo(site["tz"])).astimezone(ZoneInfo("UTC")).replace(tzinfo=None)
    m = ephem.Moon(obs)
    return math.degrees(m.alt), float(m.phase)


_NEBULAE = {"HII", "EmN", "Neb", "RfN", "SNR", "Cl+N"}


def kind_is_nebula(tgt: dict) -> bool:
    return tgt.get("type") in _NEBULAE


def _ease(tgt: dict, alt: float, limit_mag: float, moon_bright: bool) -> float:
    """Plus c'est grand, plus c'est facile : eclat, hauteur, contraste."""
    score = (limit_mag - tgt["mag"]) * 1.0          # marge d'eclat
    score += min(alt, 60) / 20                       # 0 a 3 : haut dans le ciel
    point_like = tgt.get("type") in MOON_TOLERANT_TYPES
    if not point_like:
        sb = surface_brightness(tgt)
        if sb is not None:
            score -= max(0.0, sb - EASY_SB) * 2      # diffus et pale : penalise
        if moon_bright:
            score -= 3
        if kind_is_nebula(tgt):
            score -= 1.5                             # nebuleuses : un filtre aide beaucoup, l'oeil nu peu
    if tgt.get("messier"):
        score += 0.5                                 # classiques : plus faciles a documenter
    return score


def binocular_picks(site: dict, horizon: dict, optics: dict, when: datetime, limit: int = 5) -> list[dict]:
    """Les `limit` cibles les plus faciles a `when` (heure locale naive du
    site), pointables au moins l'heure qui suit."""
    later = when + timedelta(minutes=LOOKAHEAD_MIN)
    limit_mag = visual_limit_mag(optics["aperture_mm"])
    moon_alt, moon_illum = _moon(when, site)
    moon_bright = moon_alt > 0 and moon_illum >= 40
    min_alt = optics["min_alt_deg"]

    seen: set[str] = set()
    candidates = []
    for tgt in load_targets() + load_binocular_extras():
        if tgt["name"] in seen or not visible_in_binoculars(tgt, optics):
            continue
        seen.add(tgt["name"])
        ok = True
        positions = []
        for t in (when, later):
            alt, az = target_altaz(t, tgt["ra"], tgt["dec"], site=site)
            floor = sector_floor(horizon, compass_sector(az))
            if floor is None or alt < max(min_alt, floor):
                ok = False
                break
            positions.append((alt, az))
        if not ok:
            continue
        (alt, az), (alt_later, _) = positions
        candidates.append((_ease(tgt, alt, limit_mag, moon_bright), tgt, alt, az, alt_later))

    candidates.sort(key=lambda c: -c[0])
    per_type: dict[str, int] = {}
    out = []
    for score, tgt, alt, az, alt_later in candidates:
        if score < MIN_EASE:
            break
        kind = tgt.get("type", "")
        if per_type.get(kind, 0) >= MAX_PER_TYPE:
            continue
        per_type[kind] = per_type.get(kind, 0) + 1
        size = max(tgt.get("w") or 0, tgt.get("h") or 0)
        out.append({
            "designation": tgt["name"],
            "name": french_name(tgt) or tgt.get("common_name") or None,
            "messierId": tgt.get("messier") or None,
            "type": tgt.get("type_fr", ""),
            "look": _LOOK.get(kind, tgt.get("type_fr", "")),
            "mag": tgt["mag"],
            "altDeg": round(alt),
            "azDeg": round(az),
            "sector": compass_sector(az),
            "rising": alt_later > alt,
            "fitsField": not size or size <= optics["fov_deg"] * 60 * 0.8,
            "raDeg": tgt["ra"] * 15,
            "decDeg": tgt["dec"],
        })
        if len(out) >= limit:
            break
    return out
