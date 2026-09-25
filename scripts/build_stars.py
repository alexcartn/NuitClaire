"""Genere data/stars.csv et data/constellation_lines.json depuis le paquet npm
d3-celestial (licence BSD-3-Clause, (c) 2015 Olaf Frohn ; donnees Hipparcos),
pour les cartes du chemin d'etoiles (starhop.py).

    npm pack d3-celestial && tar xzf d3-celestial-*.tgz
    python scripts/build_stars.py package/data

Etoiles jusqu'a la magnitude 6 (~5000) : ce que l'oeil voit sous un ciel
correct, et les reperes d'un chemin aux jumelles."""
import csv
import json
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "data"


def ra_deg(lon: float) -> float:
    return lon + 360 if lon < 0 else lon


def main(src: Path) -> None:
    stars = json.loads((src / "stars.6.json").read_text())["features"]
    names = json.loads((src / "starnames.json").read_text())
    with open(OUT / "stars.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["hip", "ra_deg", "dec_deg", "mag", "name", "desig"])
        for s in stars:
            lon, lat = s["geometry"]["coordinates"]
            info = names.get(str(s["id"]), {})
            desig = f"{info['desig']} {info['c']}".strip() if info.get("desig") and info.get("c") else ""
            w.writerow([s["id"], round(ra_deg(lon), 4), round(lat, 4), s["properties"]["mag"],
                        info.get("name", ""), desig])
    lines = json.loads((src / "constellations.lines.json").read_text())["features"]
    segments = []
    for c in lines:
        for line in c["geometry"]["coordinates"]:
            for (a, b) in zip(line, line[1:]):
                segments.append([round(ra_deg(a[0]), 3), round(a[1], 3), round(ra_deg(b[0]), 3), round(b[1], 3)])
    (OUT / "constellation_lines.json").write_text(json.dumps(segments, separators=(",", ":")))
    print(f"{len(stars)} etoiles, {len(segments)} segments")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
