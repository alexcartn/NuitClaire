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




# Etoiles nommees sur la carte du telephone : les reperes qu'on trouve a
# l'oeil nu, sous leur nom francais. Une designation (« α UMa ») ne parle
# pas dehors ; trente noms sur un dome de telephone, c'est illisible.
MOBILE_NAMES = {
    "Vega": "Véga", "Altair": "Altaïr", "Deneb": "Deneb", "Arcturus": "Arcturus",
    "Capella": "Capella", "Aldebaran": "Aldébaran", "Betelgeuse": "Bételgeuse",
    "Rigel": "Rigel", "Sirius": "Sirius", "Procyon": "Procyon", "Pollux": "Pollux",
    "Castor": "Castor", "Regulus": "Régulus", "Spica": "Épi", "Antares": "Antarès",
    "Fomalhaut": "Fomalhaut", "Polaris": "Polaire",
}


def build_mobile_sky() -> None:
    """Version reduite pour la carte du ciel du telephone (mobile/src/sky/
    skyData.json) : etoiles visibles a l'oeil nu (magnitude 5 au plus), nom
    des reperes (MOBILE_NAMES), traces des constellations. Calculee sur le
    telephone, donc disponible hors ligne."""
    stars = []
    with open(OUT / "stars.csv", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            m = float(r["mag"])
            if m <= 5.0:
                stars.append([round(float(r["ra_deg"]), 2), round(float(r["dec_deg"]), 2), round(m, 1),
                              MOBILE_NAMES.get(r["name"], "")])
    lines = [[round(v, 2) for v in seg] for seg in json.loads((OUT / "constellation_lines.json").read_text())]
    target = OUT.parent / "mobile" / "src" / "sky" / "skyData.json"
    target.write_text(json.dumps({"stars": stars, "lines": lines}, ensure_ascii=False, separators=(",", ":")))


if __name__ == "__main__":
    # Sans argument : ne refait que la carte du telephone, depuis data/.
    if len(sys.argv) > 1:
        main(Path(sys.argv[1]))
    build_mobile_sky()
