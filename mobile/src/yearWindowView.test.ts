import { test } from "node:test";
import assert from "node:assert/strict";
import { describeYear, fromNow, yearBar } from "./yearWindowView.ts";
import type { TargetYear } from "./types";

const TODAY = new Date(2026, 9, 8);   // 8 octobre 2026

const year = (extra: Partial<TargetYear>): TargetYear => ({
  status: "seasonal", culminationDeg: 60, minAltDeg: 20, windows: [], peakDate: null, peakHours: 0, ...extra,
});

test("une cible toujours sous l'horizon le dit, sans chiffre de culmination", () => {
  const v = describeYear(year({ status: "unreachable", culminationDeg: -18.8 }), TODAY);
  assert.equal(v.headline, "Jamais visible depuis ta position");
  assert.equal(v.detail, "Elle reste sous l'horizon toute l'année.");
  assert.equal(v.hasBar, false);
});

test("une cible trop basse donne sa culmination et la hauteur qu'il lui faut", () => {
  const v = describeYear(year({ status: "unreachable", culminationDeg: 16.7, minAltDeg: 20 }), TODAY);
  assert.equal(v.detail, "Elle culmine à 17° au mieux, il en faut au moins 20°.");
});

test("une cible qui passe a peine la hauteur minimale ne pretend pas culminer trop bas", () => {
  const v = describeYear(year({ status: "unreachable", culminationDeg: 20.4, minAltDeg: 20 }), TODAY);
  assert.match(v.detail!, /moins de 2 h par nuit au-dessus de 20°/);
});

test("une cible cachee par l'horizon renvoie aux reglages", () => {
  const v = describeYear(year({ status: "hidden", culminationDeg: 36 }), TODAY);
  assert.equal(v.headline, "Cachée par ton horizon");
  assert.match(v.detail!, /Réglages, section Horizon/);
});

test("une fenetre en cours dit jusqu'a quand", () => {
  const v = describeYear(year({
    windows: [{ start: "2026-09-09", end: "2027-03-18", current: true, peakDate: "2026-12-20", peakHours: 7 }],
  }), TODAY);
  assert.equal(v.headline, "Visible en ce moment, jusqu'au 18 mars");
  assert.deepEqual(v.rows, [["9 sept. → 18 mars", "jusqu'à 7 h · pic 20 déc."]]);
});

test("une fenetre a venir dit a partir de quand, et dans combien de temps", () => {
  const v = describeYear(year({
    windows: [{ start: "2027-04-03", end: "2027-09-01", current: false, peakDate: "2027-06-24", peakHours: 4 }],
  }), TODAY);
  assert.equal(v.headline, "Visible à partir du 3 avril");
  assert.equal(v.detail, "C'est dans 6 mois.");
});

test("une fenetre a deux plages les liste toutes", () => {
  const v = describeYear(year({
    windows: [
      { start: "2026-10-01", end: "2026-11-02", current: true, peakDate: "2026-10-15", peakHours: 3 },
      { start: "2027-03-01", end: "2027-04-10", current: false, peakDate: "2027-03-20", peakHours: 5 },
    ],
  }), TODAY);
  assert.equal(v.rows.length, 2);
  assert.match(v.headline, /jusqu'au 2 novembre/);
});

test("toute l'annee : pas de plage, la meilleure nuit", () => {
  const v = describeYear(year({ status: "allYear", peakDate: "2027-09-22", peakHours: 10 }), TODAY);
  assert.equal(v.headline, "Visible toute l'année");
  assert.equal(v.detail, "Jusqu'à 10 h par nuit, au mieux vers le 22 septembre.");
  assert.deepEqual(v.rows, []);
});

test("le premier du mois s'ecrit 1er", () => {
  const v = describeYear(year({
    windows: [{ start: "2027-04-01", end: "2027-09-30", current: false, peakDate: "2027-06-01", peakHours: 4 }],
  }), TODAY);
  assert.equal(v.headline, "Visible à partir du 1er avril");
  assert.deepEqual(v.rows, [["1er avr. → 30 sept.", "jusqu'à 4 h · pic 1er juin"]]);
});

test("fromNow", () => {
  assert.equal(fromNow(0), "aujourd'hui");
  assert.equal(fromNow(1), "demain");
  assert.equal(fromNow(12), "dans 12 jours");
  assert.equal(fromNow(177), "dans 6 mois");
});

test("la barre part du premier du mois courant et suit les mois", () => {
  const bar = yearBar(year({ status: "allYear", peakDate: "2027-09-22", peakHours: 10 }), TODAY);
  assert.equal(bar.months.length, 12);
  assert.equal(bar.months[0].label, "O");          // octobre
  assert.equal(bar.months[11].label, "S");         // septembre suivant
  assert.ok(Math.abs(bar.months.reduce((n, m) => n + m.width, 0) - 100) < 1e-9);
  assert.ok(bar.today > 0 && bar.today < 100 / 12);   // le 8 est dans le premier mois
  assert.deepEqual(bar.segments, [{ left: 0, width: 100 }]);
});

test("une fenetre deja commencee reapparait au bout de la barre, un an plus tard", () => {
  const bar = yearBar(year({
    windows: [{ start: "2026-05-25", end: "2027-03-16", current: true, peakDate: "2026-10-25", peakHours: 12 }],
  }), TODAY);
  // octobre -> mi-mars, puis fin mai -> fin septembre de l'annee suivante
  assert.equal(bar.segments.length, 2);
  assert.equal(bar.segments[0].left, 0);
  assert.ok(bar.segments[0].width > 45 && bar.segments[0].width < 52);
  assert.ok(bar.segments[1].left > 60 && bar.segments[1].left + bar.segments[1].width > 99.9);
});

test("une fenetre a venir ne reapparait pas avant", () => {
  const bar = yearBar(year({
    windows: [{ start: "2027-04-03", end: "2027-09-01", current: false, peakDate: "2027-06-24", peakHours: 4 }],
  }), TODAY);
  assert.equal(bar.segments.length, 1);
  assert.ok(bar.segments[0].left > 50);
});
