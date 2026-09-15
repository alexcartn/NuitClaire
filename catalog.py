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
