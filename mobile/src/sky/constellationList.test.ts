import { test } from "node:test";
import assert from "node:assert/strict";
import { listConstellations, mergeConstellations, namedStarsByConstellation } from "./constellationList.ts";

test("le Serpent en deux morceaux devient une seule constellation, au milieu des deux", () => {
  const out = mergeConstellations([
    { id: "Ori", fr: "Orion", ra: 83, dec: 0 },
    { id: "Ser", fr: "Serpent", ra: 232.5, dec: 5 },
    { id: "Ser", fr: "Serpent", ra: 280.5, dec: 3 },
  ]);
  assert.equal(out.length, 2);
  const ser = out.find((c) => c.id === "Ser")!;
  assert.ok(Math.abs(ser.raDeg - 256.5) < 1, `${ser.raDeg}`);
  assert.equal(ser.decDeg, 4);
  assert.deepEqual(out.find((c) => c.id === "Ori"), { id: "Ori", name: "Orion", raDeg: 83, decDeg: 0 });
});

test("deux morceaux de part et d'autre de 0 h se rejoignent par le plus court", () => {
  const [c] = mergeConstellations([
    { id: "X", fr: "X", ra: 350, dec: 0 },
    { id: "X", fr: "X", ra: 10, dec: 0 },
  ]);
  assert.ok(c.raDeg < 1 || c.raDeg > 359, `${c.raDeg}`);
});

test("les espaces fines des noms composes redeviennent des espaces", () => {
  const [c] = mergeConstellations([{ id: "Ant", fr: "Machine Pneumatique", ra: 156, dec: -36 }]);
  assert.equal(c.name, "Machine Pneumatique");
});

test("une etoile nommee est rangee avec la constellation de son trait, la plus brillante d'abord", () => {
  const stars: [number, number, number, string, number][] = [
    [78.63, -8.2, 0.2, "Rigel", -0.03],
    [88.79, 7.41, 0.5, "Bételgeuse", 1.5],
    [279.23, 38.78, 0.0, "Véga", 0],
    [10, 10, 3, "", 0], // sans nom : ignoree
  ];
  const lines: [number, number, number, number, string][] = [
    [88.79, 7.41, 83.0, 9.9, "Ori"],
    [78.63, -8.2, 83.0, -0.3, "Ori"],
    [279.23, 38.78, 282.5, 33.4, "Lyr"],
  ];
  const out = namedStarsByConstellation(stars, lines);
  assert.deepEqual(out.get("Ori"), ["Rigel", "Bételgeuse"]);
  assert.deepEqual(out.get("Lyr"), ["Véga"]);
  assert.equal(out.size, 2);
});

test("la liste met le ciel d'abord, du plus haut au plus bas, puis le reste dans l'ordre", () => {
  // Latitude 45, temps sideral 0 : un objet a l'ascension 0 est au meridien.
  const entries = [
    { id: "A", name: "Zeta", raDeg: 0, decDeg: 20 }, // meridien, haut
    { id: "B", name: "Bas", raDeg: 60, decDeg: 10 }, // a l'est, plus bas
    { id: "C", name: "Zenith", raDeg: 0, decDeg: 45 }, // au zenith
    { id: "D", name: "Sud", raDeg: 180, decDeg: -50 }, // sous l'horizon
    { id: "E", name: "Austral", raDeg: 180, decDeg: -60 }, // sous l'horizon
  ];
  const out = listConstellations(entries, 45, 0);
  assert.deepEqual(out.map((c) => c.id), ["C", "A", "B", "E", "D"]);
  assert.ok(out[0].up && out[1].up && out[2].up);
  assert.ok(!out[3].up && !out[4].up);
});
