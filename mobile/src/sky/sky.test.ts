import { test } from "node:test";
import assert from "node:assert/strict";
import { altAz, domeProject, gmstDeg, guidance, guidanceText, lstDeg, pointing, separation, sectorOf, viewProject } from "./sky.ts";

const near = (a: number, b: number, tol = 0.5) => assert.ok(Math.abs(a - b) <= tol, `${a} ≈ ${b}`);

test("temps sideral de reference (J2000)", () => {
  near(gmstDeg(new Date(Date.UTC(2000, 0, 1, 12, 0, 0))), 280.46, 0.01);
});

test("la Polaire est a la hauteur de la latitude, plein nord", () => {
  const lst = lstDeg(new Date(Date.UTC(2026, 8, 25, 21, 0, 0)), 4.53);
  const p = altAz(37.95, 89.26, 48.91, lst);
  near(p.alt, 48.9, 1);
  assert.ok(p.az < 2 || p.az > 358);
});

test("un objet au meridien culmine plein sud", () => {
  const p = altAz(100, 10, 48.9, 100); // angle horaire nul
  near(p.alt, 90 - 48.9 + 10, 0.01);
  near(p.az, 180, 0.01);
});

test("dome : zenith au centre, horizon sur le cercle, est a gauche", () => {
  assert.deepEqual(domeProject({ alt: 90, az: 0 }), { x: -0, y: -0 });
  const east = domeProject({ alt: 0, az: 90 })!;
  near(east.x, -1, 1e-9);
  const north = domeProject({ alt: 0, az: 0 })!;
  near(north.y, -1, 1e-9);
  assert.equal(domeProject({ alt: -5, az: 0 }), null);
  // Face au sud, le sud en bas : la rotation vaut cap + 180.
  const south = domeProject({ alt: 0, az: 180 }, 180 + 180)!;
  near(south.y, 1, 1e-9);
});

test("viseur : a droite quand l'azimut augmente, en haut quand la hauteur augmente", () => {
  const c = { alt: 30, az: 180 };
  assert.ok(viewProject({ alt: 30, az: 190 }, c)!.x > 0);
  assert.ok(viewProject({ alt: 40, az: 180 }, c)!.y > 0);
  assert.equal(viewProject({ alt: 30, az: 0 }, c), null); // derriere soi
});

test("le dos du telephone vise ou l'on pense", () => {
  // Debout, haut du telephone vers le ciel, alpha 0 : on vise le nord a
  // l'horizon.
  const flat = pointing(0, 90, 0);
  near(flat.alt, 0, 0.01);
  near(flat.az, 0, 0.01);
  // Incline de 45 deg vers l'arriere : on vise 45 deg au-dessus de l'horizon.
  near(pointing(0, 135, 0).alt, 45, 0.01);
  // Tourne d'un quart de tour (alpha 90, sens trigo) : on vise l'ouest.
  near(pointing(90, 90, 0).az, 270, 0.01);
});

test("guidage : ecart et consigne en clair", () => {
  const g = guidance({ alt: 40, az: 100 }, { alt: 32, az: 88 });
  near(g.right, 12, 1e-9);
  near(g.up, 8, 1e-9);
  assert.equal(guidanceText(g), "12° à droite, 8° plus haut");
  // Passage par le nord : 350 -> 10 vaut 20 deg a droite, pas 340 a gauche.
  near(guidance({ alt: 20, az: 10 }, { alt: 20, az: 350 }).right, 20, 1e-9);
  near(separation({ alt: 0, az: 0 }, { alt: 90, az: 0 }), 90, 1e-9);
  assert.equal(sectorOf(359), "N");
  assert.equal(sectorOf(225), "SW");
});
