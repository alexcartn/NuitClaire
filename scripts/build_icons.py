"""Generation des icones PWA de l'appli mobile (croissant de lune sur fond
sombre, aux couleurs du theme).

Script ponctuel, comme build_catalog.py : les PNG produits sont commits dans
`mobile/public/`, ce script sert a les regenerer si le dessin ou les
couleurs changent. Ecrit le PNG a la main (zlib + CRC32) plutot que via
Pillow : une dependance de moins a installer pour trois fichiers generes
une fois.

    python scripts/build_icons.py

Les formes sont anticrenelees analytiquement (couverture approchee a partir
de la distance signee au bord, pas de suréchantillonnage) : suffisant pour
des disques, et assez rapide pour rester instantane a 512 px.
"""
from __future__ import annotations

import struct
import zlib
from pathlib import Path

PUBLIC = Path(__file__).resolve().parent.parent / "mobile" / "public"

BG = (10, 9, 12)          # --bg du theme sombre
MOON = (227, 123, 209)    # --accent (oklch(0.74 0.15 326)), approche en sRGB
STAR = (244, 242, 247)    # --ink

# Icone maskable : Android peut rogner jusqu'a ~10 % de chaque bord, donc le
# dessin reste dans le cercle de securite central (80 % de la largeur).
MOON_RADIUS = 0.30        # rayon du croissant, en fraction de la largeur
CUT_OFFSET = (0.125, -0.075)  # decalage du disque qui creuse le croissant
CUT_RADIUS = 0.27
STARS = [(0.755, 0.245, 0.020), (0.835, 0.40, 0.013), (0.70, 0.435, 0.010)]


def _coverage(dist: float) -> float:
    """Fraction du pixel couverte, a partir de la distance signee (en pixels)
    a la forme : negative dedans, positive dehors. Rampe lineaire sur 1 px."""
    return min(1.0, max(0.0, 0.5 - dist))


def _blend(dst: tuple[int, int, int], src: tuple[int, int, int], alpha: float) -> tuple[int, int, int]:
    return tuple(round(d + (s - d) * alpha) for d, s in zip(dst, src))  # type: ignore[return-value]


def render(size: int) -> bytes:
    """Rend l'icone et renvoie les octets PNG."""
    cx = cy = size / 2
    moon_r = MOON_RADIUS * size
    cut_r = CUT_RADIUS * size
    cut_x = cx + CUT_OFFSET[0] * size
    cut_y = cy + CUT_OFFSET[1] * size
    stars = [(sx * size, sy * size, sr * size) for sx, sy, sr in STARS]

    rows = bytearray()
    for y in range(size):
        py = y + 0.5
        rows.append(0)  # filtre PNG "None" sur chaque ligne
        for x in range(size):
            px = x + 0.5
            color = BG

            moon_d = ((px - cx) ** 2 + (py - cy) ** 2) ** 0.5 - moon_r
            if moon_d < 1.0:
                cut_d = ((px - cut_x) ** 2 + (py - cut_y) ** 2) ** 0.5 - cut_r
                alpha = min(_coverage(moon_d), 1.0 - _coverage(cut_d))
                if alpha > 0.0:
                    color = _blend(color, MOON, alpha)

            for sx, sy, sr in stars:
                star_d = ((px - sx) ** 2 + (py - sy) ** 2) ** 0.5 - sr
                if star_d < 1.0:
                    alpha = _coverage(star_d)
                    if alpha > 0.0:
                        color = _blend(color, STAR, alpha)

            rows.extend(color)
    return _png(size, bytes(rows))


def _chunk(kind: bytes, payload: bytes) -> bytes:
    return (struct.pack(">I", len(payload)) + kind + payload
            + struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF))


def _png(size: int, raw: bytes) -> bytes:
    # 8 bits par canal, RGB sans alpha : l'icone est pleine, le fond fait
    # partie du dessin (exigence des icones maskable).
    header = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    return (b"\x89PNG\r\n\x1a\n"
            + _chunk(b"IHDR", header)
            + _chunk(b"IDAT", zlib.compress(raw, 9))
            + _chunk(b"IEND", b""))


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    for name, size in [("icon-192.png", 192), ("icon-512.png", 512),
                       ("apple-touch-icon.png", 180)]:
        path = PUBLIC / name
        path.write_bytes(render(size))
        print(f"{path} ({size}x{size})")


if __name__ == "__main__":
    main()
