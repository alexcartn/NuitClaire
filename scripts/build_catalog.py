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

    # Garde-fou : evite d'ecraser les CSV commits par des donnees quasi vides
    # ou aberrantes si le telechargement echoue silencieusement ou si le
    # schema OpenNGC change (ex: renommage d'un type, colonne manquante).
    assert 1000 < len(target_rows) < 3000, (
        f"nombre de cibles suspect ({len(target_rows)}), attendu ~1700-1800 : "
        "le format OpenNGC a peut-etre change, verifier avant d'ecraser les CSV")
    assert len(messier_rows) == 110, (
        f"catalogue Messier incomplet ({len(messier_rows)} au lieu de 110)")

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
