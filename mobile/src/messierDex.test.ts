import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDex, captureDates, messierIdOf, pace } from "./messierDex.ts";
import type { MessierSeason, Sessions, TargetRow } from "./types";

const season = (id: string, months: number[], reachable = true): MessierSeason => ({
  id, designation: `M${id}`, culminationDeg: 40, minAltDeg: 20, reachable,
  monthHours: Array.from({ length: 12 }, (_, i) => (months.includes(i + 1) ? 4 : 0)),
  bestMonth: months.length ? months[0] : null,
});

const row = (id: string, start: string | null, feasible: boolean | null = true): TargetRow => ({
  designation: `M${id}`, isMessier: true, messierId: id, commonName: "", ngc: null, type: "", typeCode: "",
  filter: "", start, end: start ? "04:00" : null, hours: 2, altMaxDeg: 50, moonSepDeg: 90, cadrage: "",
  imageUrl: "", ra: 0, dec: 0, mag: null, sizeW: null, sizeH: null, reasons: [], feasibleTonight: feasible,
});

test("M31 et NGC d'un Messier se resolvent en identifiant", () => {
  assert.equal(messierIdOf("M31"), "31");
  assert.equal(messierIdOf("m 042"), "42");
  assert.equal(messierIdOf("NGC0224", new Map([["NGC0224", "31"]])), "31");
  assert.equal(messierIdOf("NGC7000"), null);
});

test("la date de capture est la premiere sortie ou l'objet est coche fait", () => {
  const sessions = {
    current: {} as Sessions["current"],
    past: [
      { date: "2026-09-20", targets: ["M31"], items: [{ designation: "M31", done: true }] },
      { date: "2026-08-01", targets: ["M31", "M13"], items: [{ designation: "M31", done: false }, { designation: "M13", done: false }] },
    ],
  } as unknown as Sessions;
  const dates = captureDates(sessions);
  assert.equal(dates.get("31"), "2026-09-20");
  // Jamais coche : premiere apparition.
  assert.equal(dates.get("13"), "2026-08-01");
});

test("le Pokedex range chaque Messier manquant dans une seule section", () => {
  // Mois courant : septembre (9).
  const seasons = [
    season("1", [9, 10, 11]),          // visible, ce soir
    season("2", [8, 9]),               // s'en va : derniere chance
    season("3", [9, 10, 11, 12]),      // visible ce mois, pas ce soir
    season("4", [1, 2]),               // a venir en janvier
    season("5", [], true),             // masque par l'horizon
    season("6", [], false),            // hors de portee
    season("7", [9, 10]),              // deja capture
  ];
  const rows = [row("1", "21:00"), row("2", null, false), row("3", null, false)];
  const dex = buildDex(rows, seasons, new Set(["7"]), new Map([["7", "2026-09-01"]]), 9);

  assert.deepEqual(dex.tonight.map((e) => e.id), ["1"]);
  assert.deepEqual(dex.lastChance.map((e) => e.id), ["2"]);
  assert.ok(dex.thisMonth.map((e) => e.id).includes("3"));
  assert.deepEqual(dex.upcoming.find((g) => g.month === 1)?.entries.map((e) => e.id), ["4"]);
  assert.deepEqual(dex.hiddenByHorizon.map((e) => e.id), ["5"]);
  assert.deepEqual(dex.outOfReach.map((e) => e.id), ["6"]);
  assert.equal(dex.entries.length, 110);
  assert.equal(dex.capturedCount, 1);
  assert.equal(dex.entries[6].capturedOn, "2026-09-01");
});

test("les groupes a venir suivent l'ordre des mois a partir de maintenant", () => {
  const dex = buildDex([], [season("4", [1]), season("5", [11])], new Set(), new Map(), 9);
  assert.deepEqual(dex.upcoming.map((g) => g.month), [11, 1]);
});

test("pas de rythme annonce sans assez de captures datees", () => {
  const today = new Date("2026-09-24T12:00:00Z");
  assert.equal(pace(new Map([["1", "2026-09-01"]]), 1, today).monthsToGo, null);
  const dates = new Map([["1", "2026-09-01"], ["2", "2026-06-01"], ["3", "2026-01-10"], ["4", "2025-12-01"]]);
  const p = pace(dates, 4, today);
  assert.equal(p.thisMonth, 1);
  assert.equal(p.thisYear, 3);
  assert.equal(p.lastYear, 4);
  assert.equal(p.monthsToGo, Math.ceil(106 / (4 / 12)));
});
