"""Chargement du catalogue de cibles (genere par scripts/build_catalog.py)."""
import csv
import re
from functools import lru_cache
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"


# Les CSV portent des types sans accents (voir scripts/build_catalog.py) :
# corriges au chargement, l'interface les affiche tels quels.
_TYPE_FR_ACCENTS = {
    "amas + nebuleuse": "amas + nébuleuse", "nebuleuse planetaire": "nébuleuse planétaire",
    "nebuleuse": "nébuleuse", "region HII": "région HII",
    "nebuleuse par reflexion": "nébuleuse par réflexion", "remanent de supernova": "rémanent de supernova",
    "association d'etoiles": "association d'étoiles", "etoile double": "étoile double",
}


def _load_csv(path: Path) -> list[dict]:
    rows = []
    with open(path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            rows.append({
                "name": row["name"],
                "ngc_name": row["ngc_name"] or None,
                "common_name": row["common_name"],
                "type": row["type"],
                "type_fr": _TYPE_FR_ACCENTS.get(row["type_fr"], row["type_fr"]),
                "ra": float(row["ra_h"]),
                "dec": float(row["dec_deg"]),
                "w": float(row["size_w_arcmin"]) if row["size_w_arcmin"] else None,
                "h": float(row["size_h_arcmin"]) if row["size_h_arcmin"] else None,
                "mag": float(row["mag"]) if row["mag"] else None,
                "filter": row["filter"],
                "messier": row["messier"] or None,
            })
    return rows


@lru_cache(maxsize=1)
def load_targets() -> list[dict]:
    """Catalogue large (cibles jugees imageables au Seestar S50). Mis en
    cache en memoire (processus long-lived Streamlit/uvicorn) : ce fichier
    est un artefact statique regenere hors ligne par scripts/build_catalog.py,
    jamais modifie a l'execution -- sans quoi cet appel reparsait ~1700 lignes
    CSV a chaque rerun Streamlit (tout widget declenche un rerun complet du
    script) et a chaque recherche (`find_target` l'appelle a chaque fois)."""
    return _load_csv(DATA_DIR / "ngc_seestar.csv")


@lru_cache(maxsize=1)
def load_messier() -> list[dict]:
    """Les 110 objets du catalogue Messier -- mis en cache, meme rationale
    que `load_targets`."""
    return _load_csv(DATA_DIR / "messier.csv")


def _normalize_designation(text: str) -> str:
    """'NGC 7380' / 'ngc7380' / 'IC 434' / 'ic0434' -> 'NGC7380' / 'IC434' :
    insensible a la casse, aux espaces, et aux zeros de tete du numero (le
    catalogue stocke des designations zero-paddees comme 'IC0434', mais on
    ecrit naturellement 'IC434')."""
    compact = re.sub(r"\s+", "", text).upper()
    m = re.match(r"^([A-Z]+)0*(\d+)$", compact)
    return f"{m.group(1)}{m.group(2)}" if m else compact


def search_prefix(query: str, limit: int = 8) -> list[dict]:
    """Recherche par prefixe de designation (M##, NGC####, IC####), sur le
    catalogue Messier puis le catalogue large -- pour l'auto-completion
    pendant la frappe (contrairement a `find_target`, qui exige une
    designation complete et n'en renvoie qu'une). Renvoie au plus `limit`
    resultats, Messier d'abord (catalogue plus restreint, plus susceptible
    d'etre ce que l'utilisateur cherche). Liste vide si `query` normalise
    a moins de 2 caracteres -- une seule lettre ("M", "N"...) matcherait
    des centaines d'objets, pas assez precis pour etre utile."""
    normalized = _normalize_designation(query)
    if len(normalized) < 2:
        return []
    results = []
    seen = set()
    for tgt in load_messier() + load_targets():
        if tgt["name"] in seen:
            continue
        candidates = (tgt["name"], tgt.get("ngc_name") or "")
        if any(_normalize_designation(c).startswith(normalized) for c in candidates if c):
            results.append(tgt)
            seen.add(tgt["name"])
            if len(results) >= limit:
                break
    return results


# Noms francais des objets les plus connus : le catalogue OpenNGC n'a de nom
# usuel que pour une poignee d'objets, et en anglais. Sans eux, chercher
# « orion » ou « pleiades » ne trouvait rien. Plusieurs noms par objet quand
# l'usage hesite.
FRENCH_NAMES: dict[str, list[str]] = {
    "M1": ["Nébuleuse du Crabe"], "M2": ["Amas du Verseau"], "M3": ["Amas des Chiens de Chasse"],
    "M8": ["Nébuleuse de la Lagune"], "M11": ["Amas du Canard sauvage", "Amas de l'Écu de Sobieski"],
    "M13": ["Grand amas d'Hercule"], "M16": ["Nébuleuse de l'Aigle", "Piliers de la création"],
    "M17": ["Nébuleuse Oméga", "Nébuleuse du Cygne"], "M20": ["Nébuleuse Trifide"],
    "M27": ["Nébuleuse de l'Haltère"], "M31": ["Galaxie d'Andromède"], "M32": ["Satellite d'Andromède"],
    "M33": ["Galaxie du Triangle"], "M42": ["Grande nébuleuse d'Orion"], "M43": ["Nébuleuse de De Mairan"],
    "M44": ["Amas de la Crèche", "Praesepe"], "M45": ["Pléiades", "Les Sept Sœurs"],
    "M51": ["Galaxie du Tourbillon"], "M57": ["Nébuleuse de l'Anneau", "Nébuleuse de la Lyre"],
    "M63": ["Galaxie du Tournesol"], "M64": ["Galaxie de l'Œil noir"], "M76": ["Petite Haltère"],
    "M81": ["Galaxie de Bode"], "M82": ["Galaxie du Cigare"], "M87": ["Virgo A"],
    "M97": ["Nébuleuse du Hibou"], "M101": ["Galaxie du Moulinet"], "M104": ["Galaxie du Sombrero"],
    "M106": ["Galaxie des Chiens de Chasse"], "M110": ["Satellite d'Andromède"],
    "NGC7000": ["Nébuleuse de l'Amérique du Nord"], "IC5070": ["Nébuleuse du Pélican"],
    "NGC2238": ["Nébuleuse de la Rosette"], "NGC2239": ["Amas de la Rosette"],
    "IC1805": ["Nébuleuse du Cœur"], "IC1848": ["Nébuleuse de l'Âme"],
    "NGC6960": ["Dentelles du Cygne", "Nébuleuse du Voile"], "NGC6992": ["Dentelles du Cygne", "Nébuleuse du Voile"],
    "NGC869": ["Double amas de Persée"], "NGC884": ["Double amas de Persée"],
    "IC434": ["Nébuleuse de la Tête de Cheval"],
    "NGC7293": ["Nébuleuse de l'Hélice"], "NGC6543": ["Nébuleuse de l'Œil de chat"],
    "NGC891": ["Galaxie de la Tranche d'Andromède"], "NGC4565": ["Galaxie de l'Aiguille"],
    "NGC7635": ["Nébuleuse de la Bulle"],
    "NGC6888": ["Nébuleuse du Croissant"], "IC405": ["Nébuleuse de l'Étoile flamboyante"],
    "NGC7380": ["Nébuleuse du Sorcier"], "NGC1499": ["Nébuleuse de Californie"],
    "NGC2392": ["Nébuleuse de l'Esquimau"], "NGC7662": ["Boule de neige bleue"],
    "NGC457": ["Amas de la Chouette", "Amas E.T."],
}


def _fold(text: str) -> str:
    """Minuscules sans accents ni ponctuation : « Pléiades » = « pleiades »."""
    import unicodedata

    # Les ligatures ne se decomposent pas : « cœur » doit valoir « coeur ».
    text = text.lower().replace("œ", "oe").replace("æ", "ae")
    decomposed = unicodedata.normalize("NFKD", text)
    plain = "".join(c for c in decomposed if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", plain).strip()


def french_name(tgt: dict) -> str | None:
    """Premier nom francais connu de l'objet (par sa designation ou son NGC)."""
    for key in (tgt["name"], tgt.get("ngc_name") or ""):
        names = FRENCH_NAMES.get(_normalize_designation(key)) if key else None
        if names:
            return names[0]
    return None


def search_by_name(query: str, limit: int = 8) -> list[dict]:
    """Recherche par nom (francais ou anglais, sans accents, partout dans le
    nom) : « orion », « tourbillon », « whirlpool ». Au moins 3 caracteres."""
    folded = _fold(query)
    if len(folded) < 3:
        return []
    results, seen = [], set()
    for tgt in load_messier() + load_targets():
        if tgt["name"] in seen:
            continue
        names = [tgt.get("common_name") or ""]
        for key in (tgt["name"], tgt.get("ngc_name") or ""):
            if key:
                names += FRENCH_NAMES.get(_normalize_designation(key), [])
        if any(folded in _fold(n) for n in names if n):
            results.append(tgt)
            seen.add(tgt["name"])
            if len(results) >= limit:
                break
    return results


def find_target(query: str) -> dict | None:
    """Cherche un objet par designation exacte (M##, NGC####, IC####), dans le
    catalogue Messier puis le catalogue large -- pas de recherche par nom
    commun/surnom (couverture trop partielle dans OpenNGC pour etre fiable,
    voir docs/plans). Renvoie le premier objet trouve, ou None."""
    normalized = _normalize_designation(query)
    if not normalized:
        return None
    for tgt in load_messier() + load_targets():
        candidates = (tgt["name"], tgt.get("ngc_name") or "")
        if any(_normalize_designation(c) == normalized for c in candidates if c):
            return tgt
    return None
