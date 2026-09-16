"""Chargement du catalogue de cibles (genere par scripts/build_catalog.py)."""
import csv
import re
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"


def _load_csv(path: Path) -> list[dict]:
    rows = []
    with open(path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            rows.append({
                "name": row["name"],
                "ngc_name": row["ngc_name"] or None,
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


def _normalize_designation(text: str) -> str:
    """'NGC 7380' / 'ngc7380' / 'IC 434' / 'ic0434' -> 'NGC7380' / 'IC434' :
    insensible a la casse, aux espaces, et aux zeros de tete du numero (le
    catalogue stocke des designations zero-paddees comme 'IC0434', mais on
    ecrit naturellement 'IC434')."""
    compact = re.sub(r"\s+", "", text).upper()
    m = re.match(r"^([A-Z]+)0*(\d+)$", compact)
    return f"{m.group(1)}{m.group(2)}" if m else compact


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
