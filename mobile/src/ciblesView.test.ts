import { test } from "node:test";
import assert from "node:assert/strict";
import { activeFilterCount, applyFilters, groupRows, hourLabel, nightHours, nightMinutes, visibleDuring } from "./ciblesView.ts";
import type { TargetRow } from "./types";

const row = (designation: string, type: string, start: string | null, end: string | null, extra: Partial<TargetRow> = {}): TargetRow => ({
  designation, isMessier: false, messierId: null, commonName: "", ngc: null, type, typeCode: "", filter: "",
  start, end, hours: 2, altMaxDeg: 50, moonSepDeg: 90, cadrage: "cadre unique", imageUrl: "", ra: 0, dec: 0,
  mag: 9, sizeW: null, sizeH: null, reasons: [], feasibleTonight: true, ...extra,
});

test("les heures de la nuit passent minuit dans l'ordre", () => {
  assert.ok(nightMinutes("23:00") < nightMinutes("01:00"));
  assert.equal(hourLabel(nightMinutes("01:00")), "01h");
  const rows = [row("A", "galaxie", "21:30", "23:00"), row("B", "galaxie", "00:00", "02:15")];
  assert.deepEqual(nightHours(rows).map(hourLabel), ["21h", "22h", "23h", "00h", "01h", "02h"]);
});

test("une cible compte pour chaque heure qu'elle touche", () => {
  const r = row("A", "galaxie", "21:30", "23:00");
  assert.equal(visibleDuring(r, nightMinutes("21:00")), true);
  assert.equal(visibleDuring(r, nightMinutes("22:00")), true);
  assert.equal(visibleDuring(r, nightMinutes("23:00")), true);
  assert.equal(visibleDuring(r, nightMinutes("00:00")), false);
  assert.equal(visibleDuring(row("B", "galaxie", null, null), nightMinutes("22:00")), false);
});

test("filtres type, magnitude et cadre unique", () => {
  const rows = [
    row("A", "galaxie", "21:00", "23:00", { mag: 12 }),
    row("B", "amas ouvert", "21:00", "23:00", { mag: 6 }),
    row("C", "galaxie", "21:00", "23:00", { mag: 8, cadrage: "mosaique 2x" }),
  ];
  const f = { types: ["galaxie"], magRange: [5, 10] as [number, number], singleFrame: false };
  assert.deepEqual(applyFilters(rows, f).map((r) => r.designation), ["C"]);
  assert.deepEqual(applyFilters(rows, { ...f, singleFrame: true }).map((r) => r.designation), []);
  assert.equal(activeFilterCount(f), 2);
  assert.equal(activeFilterCount({ types: [], magRange: null, singleFrame: false }), 0);
});

test("Messier manquants d'abord, puis les types du plus fourni au moins fourni", () => {
  const rows = [
    row("M31", "galaxie", "21:00", "23:00", { messierId: "31" }),
    row("M42", "nebuleuse", "21:00", "23:00", { messierId: "42" }),
    row("NGC1", "galaxie", "21:00", "23:00"),
    row("NGC2", "galaxie", "21:00", "23:00"),
    row("NGC3", "amas ouvert", "21:00", "23:00"),
  ];
  const groups = groupRows(rows, new Set(["42"]));
  assert.deepEqual(groups.map((g) => g.title), ["Messier à capturer", "galaxie", "amas ouvert", "nebuleuse"]);
  assert.deepEqual(groups[0].rows.map((r) => r.designation), ["M31"]);
  assert.deepEqual(groups[1].rows.map((r) => r.designation), ["NGC1", "NGC2"]);
});
