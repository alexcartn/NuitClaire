"""Les jumelles, compagnes du Seestar : de quoi regarder pendant qu'il pose.

Le Seestar reste l'instrument suivi partout (listes, objectif Messier). Les
jumelles n'interviennent que dans la carte « En attendant le Seestar » (voir
binocular_now.py) et dans la fiche ouverte depuis cette carte.

L'optique voyage avec la cible (`with_optics`) plutot que d'ajouter un
parametre a chaque fonction de calcul : `scoring.min_alt_for`,
`scoring.max_alt_for`, la tolerance a la Lune et le cadrage (`rows.py`)
lisent `target["optics"]`. Sans cle `optics`, c'est le Seestar.

Aux jumelles, la question n'est plus « combien de poses » mais « est-ce que
je le verrai » : on ne garde que ce qu'une paire de jumelles montre
(magnitude, brillance de surface), plus quelques classiques qui ne sont pas
dans le catalogue NGC/IC du Seestar (Cr 399, Mel 20, Albireo...)."""
import math

from config import BINOCULARS

# Types ou la Lune gene peu a l'oeil : etoiles et amas d'etoiles. Les
# nebuleuses et galaxies, a faible brillance de surface, disparaissent sous
# une Lune brillante.
MOON_TOLERANT_TYPES = {"OCl", "GCl", "*Ass", "**", "*", "Ast"}

# Toujours retenus aux jumelles quelle que soit leur taille : un amas ouvert
# ou une double se voient meme petits.
_POINT_LIKE_TYPES = {"OCl", "**", "*Ass", "Ast", "GCl"}


def binocular_optics(settings: dict | None = None) -> dict:
    b = {**BINOCULARS, **((settings or {}).get("binoculars") or {})}
    return {"kind": "jumelles", "label": f"{b['magnification']}x{b['aperture_mm']}",
            "fov_deg": float(b["fov_deg"]), "aperture_mm": float(b["aperture_mm"]),
            "min_alt_deg": float(b["min_alt_deg"]), "max_alt_deg": float(b["max_alt_deg"])}


def with_optics(tgt: dict, optics: dict | None) -> dict:
    return {**tgt, "optics": optics} if optics else tgt


def visual_limit_mag(aperture_mm: float) -> float:
    """Magnitude integree limite d'un objet etendu aux jumelles : ~2 magnitudes
    au-dessus de la limite stellaire (2 + 5 log D), l'eclat etant etale.
    8,5 pour une 50 mm, 9,3 pour une 70 mm."""
    return 2 + 5 * math.log10(aperture_mm) - 2


# Brillance de surface moyenne (mag/arcmin2) au-dela de laquelle un objet
# diffus se perd dans le fond du ciel aux jumelles, meme s'il passe la
# magnitude : M33 (13,9) reste, M101 (14,5) sort.
SURFACE_BRIGHTNESS_LIMIT = 14.3


def surface_brightness(tgt: dict) -> float | None:
    """Magnitude etalee sur l'ellipse de l'objet, par minute d'arc carree."""
    mag, w, h = tgt.get("mag"), tgt.get("w"), tgt.get("h")
    if mag is None or not (w and h):
        return None
    return mag + 2.5 * math.log10(math.pi / 4 * w * h)


def visible_in_binoculars(tgt: dict, optics: dict) -> bool:
    mag = tgt.get("mag")
    if mag is None or mag > visual_limit_mag(optics["aperture_mm"]):
        return False
    if tgt.get("type") in _POINT_LIKE_TYPES:
        return True
    size = max(tgt.get("w") or 0, tgt.get("h") or 0)
    # Plus petit qu'une minute d'arc, un objet etendu se confond avec une
    # etoile a x10.
    if size < 1.0:
        return False
    sb = surface_brightness(tgt)
    return sb is None or sb <= SURFACE_BRIGHTNESS_LIMIT


def framing(tgt: dict, size: tuple | None = None) -> str:
    """Cadrage lisible selon l'instrument de la cible. `size` (largeur,
    hauteur en arcmin) prime sur celle de la cible quand elle est donnee."""
    optics = tgt.get("optics")
    w, h = size if size is not None else (tgt.get("w"), tgt.get("h"))
    if not (w and h):
        return "taille inconnue"
    if optics:
        return "tient dans le champ" if max(w, h) <= optics["fov_deg"] * 60 * 0.8 else "déborde du champ"
    from astro import fits_in_fov
    return fits_in_fov(w, h)
