"""Genere data/stars.csv et data/constellation_lines.json depuis le paquet npm
d3-celestial (licence BSD-3-Clause, (c) 2015 Olaf Frohn ; donnees Hipparcos),
pour les cartes du chemin d'etoiles (starhop.py).

    npm pack d3-celestial && tar xzf d3-celestial-*.tgz
    python scripts/build_stars.py package/data

Etoiles jusqu'a la magnitude 6 (~5000) : ce que l'oeil voit sous un ciel
correct, et les reperes d'un chemin aux jumelles. Avec leur indice de
couleur (B-V), les noms francais des constellations et le contour de la
Voie lactee, pour la carte du ciel du telephone."""
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
        w.writerow(["hip", "ra_deg", "dec_deg", "mag", "name", "desig", "bv"])
        for s in stars:
            lon, lat = s["geometry"]["coordinates"]
            info = names.get(str(s["id"]), {})
            desig = f"{info['desig']} {info['c']}".strip() if info.get("desig") and info.get("c") else ""
            w.writerow([s["id"], round(ra_deg(lon), 4), round(lat, 4), s["properties"]["mag"],
                        info.get("name", ""), desig, s["properties"].get("bv", "")])
    lines = json.loads((src / "constellations.lines.json").read_text())["features"]
    segments = []
    segment_ids = []
    for c in lines:
        for line in c["geometry"]["coordinates"]:
            for (a, b) in zip(line, line[1:]):
                segments.append([round(ra_deg(a[0]), 3), round(a[1], 3), round(ra_deg(b[0]), 3), round(b[1], 3)])
                segment_ids.append(c["id"])
    (OUT / "constellation_lines.json").write_text(json.dumps(segments, separators=(",", ":")))
    # Constellation de chaque segment, dans le meme ordre : la carte du ciel
    # s'en sert pour mettre en valeur une constellation entiere. A part, pour
    # que starhop.py continue de lire des segments a quatre nombres.
    (OUT / "constellation_line_ids.json").write_text(json.dumps(segment_ids, separators=(",", ":")))

    # Noms des constellations (francais) et point ou poser l'etiquette.
    names = [
        {"id": c["id"], "fr": c["properties"].get("fr") or c["properties"]["name"],
         "ra": round(ra_deg(c["geometry"]["coordinates"][0]), 2), "dec": round(c["geometry"]["coordinates"][1], 2),
         "rank": int(c["properties"].get("rank", 3))}
        for c in json.loads((src / "constellations.json").read_text())["features"]
    ]
    (OUT / "constellation_names.json").write_text(json.dumps(names, ensure_ascii=False, separators=(",", ":")))

    # Voie lactee : cinq niveaux de luminosite (ol1, le plus etendu et le plus
    # pale, a ol5, le coeur), contours alleges a un point tous les ~0,8 deg.
    levels = []
    for f in json.loads((src / "mw.json").read_text())["features"]:
        rings = []
        for poly in f["geometry"]["coordinates"]:
            for ring in poly:
                kept, last = [], None
                for lon, lat in ring:
                    pt = (round(ra_deg(lon), 1), round(lat, 1))
                    if last is None or abs(pt[0] - last[0]) + abs(pt[1] - last[1]) >= 0.8:
                        kept.append(pt)
                        last = pt
                if len(kept) >= 4:
                    rings.append([v for pt in kept for v in pt])
        levels.append(rings)
    (OUT / "milkyway.json").write_text(json.dumps(levels, separators=(",", ":")))
    print(f"{len(stars)} etoiles, {len(segments)} segments, {len(names)} constellations, "
          f"{sum(len(r) for lv in levels for r in lv) // 2} points de Voie lactee")




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
                bv = round(float(r["bv"]), 2) if r.get("bv") else 0.6
                stars.append([round(float(r["ra_deg"]), 2), round(float(r["dec_deg"]), 2), round(m, 1),
                              MOBILE_NAMES.get(r["name"], ""), bv])
    segments = json.loads((OUT / "constellation_lines.json").read_text())
    ids = json.loads((OUT / "constellation_line_ids.json").read_text())
    # Cinquieme valeur : l'identifiant de la constellation (voir main()).
    lines = [[*[round(v, 2) for v in seg], cid] for seg, cid in zip(segments, ids)]
    constellations = json.loads((OUT / "constellation_names.json").read_text())
    milkyway = json.loads((OUT / "milkyway.json").read_text())
    target = OUT.parent / "mobile" / "src" / "sky" / "skyData.json"
    target.write_text(json.dumps({"stars": stars, "lines": lines, "constellations": constellations,
                                  "milkyway": milkyway}, ensure_ascii=False, separators=(",", ":")))


if __name__ == "__main__":
    # Sans argument : ne refait que la carte du telephone, depuis data/.
    if len(sys.argv) > 1:
        main(Path(sys.argv[1]))
    build_mobile_sky()
