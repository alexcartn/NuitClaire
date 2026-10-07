import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFigure, type LineRow, type StarRow } from "./constellationFigure.ts";

// Un petit trace en forme de L autour de (ra 100, dec 20).
const lines: LineRow[] = [
  [100, 25, 100, 15, "Tst"], // vertical
  [100, 15, 90, 15, "Tst"], // vers l'ouest... l'ascension DIMINUE : c'est l'ouest
  [10, 10, 12, 12, "Aut"], // une autre constellation
];

test("nord en haut, est a gauche", () => {
  const fig = buildFigure("Tst", [], lines)!;
  const north = fig.segments[0]; // (100,25) -> (100,15)
  assert.ok(north.y1 < north.y2, "le nord (dec 25) est plus haut (y plus petit) que le sud (dec 15)");
  const west = fig.segments[1]; // (100,15) -> (90,15) : ra plus petite = vers l'ouest = a droite
  assert.ok(west.x2 > west.x1, "ra plus petite : a droite, l'est est a gauche");
});

test("le cadre contient tout le trace et respecte la forme demandee", () => {
  const fig = buildFigure("Tst", [], lines, 4 / 3)!;
  const { x, y, w, h } = fig.box;
  assert.ok(Math.abs(w / h - 4 / 3) < 1e-9);
  for (const s of fig.segments) {
    for (const [px, py] of [[s.x1, s.y1], [s.x2, s.y2]]) {
      assert.ok(px >= x && px <= x + w && py >= y && py <= y + h, `(${px}, ${py}) hors du cadre`);
    }
  }
});

test("seuls les traits de la constellation demandee comptent", () => {
  assert.equal(buildFigure("Tst", [], lines)!.segments.length, 2);
  assert.equal(buildFigure("Aut", [], lines)!.segments.length, 1);
});

test("pas de trace, pas de dessin", () => {
  assert.equal(buildFigure("Zzz", [], lines), null);
});

test("on garde les etoiles du cadre, pas celles qui sont loin, et leur nom", () => {
  const stars: StarRow[] = [
    [100, 25, 1.5, "Haute", 0.2], // au bout du trace
    [101, 20, 4, "", 0.6], // a cote
    [250, -40, 2, "Lointaine", 0.1], // de l'autre cote du ciel
  ];
  const fig = buildFigure("Tst", stars, lines)!;
  assert.deepEqual(fig.stars.map((s) => s.label), ["Haute", ""]);
});

test("une constellation a cheval sur 0 h reste d'un seul tenant", () => {
  const across: LineRow[] = [[355, 10, 5, 10, "Zer"]];
  const fig = buildFigure("Zer", [], across)!;
  const s = fig.segments[0];
  // 10 degres d'ascension a la declinaison 10 : environ 9,85 degres de large, pas 350.
  assert.ok(Math.abs(s.x2 - s.x1) < 12, `largeur ${Math.abs(s.x2 - s.x1)}`);
});

test("un tout petit trace n'est pas agrandi jusqu'a remplir le cadre", () => {
  const tiny: LineRow[] = [[50, 0, 50.5, 0.5, "Pet"]];
  const fig = buildFigure("Pet", [], tiny)!;
  assert.ok(fig.box.w >= 8 && fig.box.h >= 8 * 0.99);
});
