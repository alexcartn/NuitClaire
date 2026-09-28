import { test } from "node:test";
import assert from "node:assert/strict";
import { altAz, bvColor, domeProject, domeProjectFree, fold, gmstDeg, guidance, guidanceText, horizonFloor, horizonProject, lstDeg, pointing, separation, sectorOf, sunRaDec, symbolOf, viewProject, visibility } from "./sky.ts";

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

test("le Soleil a l'equinoxe de septembre, et au solstice d'ete", () => {
  const sep = sunRaDec(new Date(Date.UTC(2026, 8, 23, 0, 0, 0)));
  near(sep.dec, 0, 0.6);
  near(sep.ra, 180, 1);
  near(sunRaDec(new Date(Date.UTC(2026, 5, 21, 12, 0, 0))).dec, 23.44, 0.1);
});

test("couleurs des etoiles : bleutees, blanches, orangees", () => {
  assert.equal(bvColor(-1), bvColor(-0.4));
  assert.equal(bvColor(1.85), "rgb(255,180,120)");
  assert.equal(bvColor(0.4), "rgb(248,247,255)");
});

test("silhouette d'horizon continue entre les secteurs", () => {
  const open = { N: true, NE: true, E: true, SE: true, S: true, SW: true, W: true, NW: true };
  const alt = { S: 20 };
  assert.equal(horizonFloor(180, open, alt), 20);
  near(horizonFloor(157.5, open, alt)!, 10, 0.01);
  assert.equal(horizonFloor(90, open, alt), 0);
  assert.equal(horizonFloor(0, { ...open, N: false }, alt), null);
});

test("projection libre : identique au-dessus de l'horizon, prolongee dessous", () => {
  const p = { alt: 30, az: 120 };
  const a = domeProject(p)!;
  const b = domeProjectFree(p);
  near(a.x, b.x, 1e-9);
  assert.ok(Math.hypot(domeProjectFree({ alt: -20, az: 0 }).x, domeProjectFree({ alt: -20, az: 0 }).y) > 1);
});

test("symboles d'atlas, depuis le code du catalogue ou le type en clair", () => {
  assert.equal(symbolOf("G"), "galaxy");
  assert.equal(symbolOf("amas ouvert"), "open");
  assert.equal(symbolOf("GCl"), "globular");
  assert.equal(symbolOf("PN"), "planetary");
  assert.equal(symbolOf("HII"), "nebula");
  assert.equal(symbolOf(undefined), "other");
});

test("vue horizon : centre au milieu, a droite quand l'azimut augmente, en haut quand on monte", () => {
  const c = { alt: 30, az: 180 };
  const mid = horizonProject(c, c)!;
  near(mid.x, 0, 1e-9);
  near(mid.y, 0, 1e-9);
  assert.ok(horizonProject({ alt: 30, az: 200 }, c)!.x > 0);
  assert.ok(horizonProject({ alt: 50, az: 180 }, c)!.y < 0);
  // Meme echelle que le dome : 90 deg du centre a 1.
  near(horizonProject({ alt: 0, az: 270 }, { alt: 0, az: 180 })!.x, 1, 1e-9);
  // Derriere soi reste fini (a l'oppose exact seulement : null).
  assert.ok(horizonProject({ alt: 0, az: 0 }, c));
  assert.equal(horizonProject({ alt: -30, az: 0 }, c), null);
});

test("visibilite : lever, passage au sud, coucher, et plage au-dessus des arbres", () => {
  const site = { lat: 48.9, lon: 2.35 };
  const open = { N: true, NE: true, E: true, SE: true, S: true, SW: true, W: true, NW: true };
  const none: Record<string, number> = {};
  const from = new Date(Date.UTC(2026, 8, 28, 12, 0, 0));
  // Vega a Paris : circumpolaire de justesse ? Non (dec 38,8 < 41,1) : elle se couche.
  const vega = visibility(279.23, 38.78, site, from, open, none);
  assert.equal(vega.circumpolar, false);
  assert.ok(vega.rise && vega.set);
  near(vega.culmination.alt, 90 - 48.9 + 38.78, 0.5);
  near(vega.culmination.az, 180, 3);
  // La Polaire ne se couche jamais ; la Croix du Sud ne se leve jamais.
  assert.equal(visibility(37.95, 89.26, site, from, open, none).circumpolar, true);
  assert.equal(visibility(187, -60, site, from, open, none).neverUp, true);
  // Des arbres a 30 deg partout : la plage degagee est plus courte.
  const trees = { N: 30, NE: 30, E: 30, SE: 30, S: 30, SW: 30, W: 30, NW: 30 };
  const hidden = visibility(279.23, 38.78, site, from, open, trees);
  const len = (v: typeof vega) => v.clear!.to.getTime() - v.clear!.from.getTime();
  assert.ok(len(hidden) < len(vega));
  // Tout bouche : jamais degagee.
  assert.equal(visibility(279.23, 38.78, site, from, {}, none).clear, null);
});

test("recherche sans accents ni espaces speciaux", () => {
  assert.equal(fold("Grande Ourse"), "grande ourse");
  assert.equal(fold("  Véga "), "vega");
});
