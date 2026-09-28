import { test } from "node:test";
import assert from "node:assert/strict";
import { lastMonths, localMonthKey, messierProgress, notesByHour, outingDurations, yearGrid } from "./statsView.ts";
import type { PastSession, SessionItem } from "./types";

test("le mois courant se lit a l'heure locale, pas en UTC", () => {
  assert.equal(localMonthKey(new Date(2026, 8, 30, 23, 59)), "2026-09");
  assert.equal(localMonthKey(new Date(2026, 9, 1, 0, 30)), "2026-10");
});

test("douze mois glissants, les mois vides a zero, a cheval sur deux annees", () => {
  const bars = lastMonths(
    [{ month: "2025-10", count: 2 }, { month: "2026-09", count: 3 }, { month: "2025-09", count: 9 }],
    [{ month: "2026-09", count: 5 }],
    new Date(2026, 8, 15),
  );
  assert.equal(bars.length, 12);
  assert.deepEqual(bars[0], { month: "2025-10", outings: 2, captures: 0 });
  assert.deepEqual(bars[11], { month: "2026-09", outings: 3, captures: 5 });
  assert.equal(bars[5].outings, 0);
});

const night = (date: string, extra: Partial<PastSession> = {}) =>
  ({ date, closedAt: `${date}T23:00:00`, items: [], timeline: [], feeling: { rating: null }, ...extra }) as unknown as PastSession;
const item = (designation: string, done: boolean, addedAt = "2026-01-01T21:00:00") =>
  ({ designation, done, addedAt, notes: [], exposureMin: null, rating: null }) as SessionItem;

test("les Messier se datent a leur premiere capture, les autres restent sans date", () => {
  const past = [
    night("2025-11-02", { items: [item("M31", true)] }),
    night("2026-03-10", { items: [item("M31", true), item("M42", true), item("NGC 7000", true), item("M13", false)] }),
  ];
  const p = messierProgress(past, ["M31", "M42", "M45"], 2026);
  assert.equal(p.before, 1);
  assert.deepEqual(p.captures, [{ designation: "M42", date: "2026-03-10", rank: 2 }]);
  assert.equal(p.undated, 1);
  assert.equal(p.total, 3);
});

test("la grille de l'annee a une ligne par mois et garde la sortie la mieux notee", () => {
  const grid = yearGrid(
    [night("2024-02-29", { feeling: { rating: 2 } as PastSession["feeling"] }), night("2024-02-29", { feeling: { rating: 5 } as PastSession["feeling"] })],
    2024,
  );
  assert.equal(grid.length, 12);
  assert.equal(grid[1].length, 29);
  assert.equal(grid[1][28].outing?.feeling.rating, 5);
});

test("la duree va de l'ouverture a la derniere saisie, pas a la cloture", () => {
  const p = night("2026-05-01", {
    openedAt: "2026-05-01T21:30:00",
    closedAt: "2026-05-02T09:00:00",
    items: [item("M13", true, "2026-05-01T21:40:00")],
    timeline: [{ id: "a", at: "2026-05-02T00:10:00", text: "", target: null, context: null }],
  });
  assert.deepEqual(outingDurations([p, night("2026-05-03")], 2026), [{ date: "2026-05-01", minutes: 160 }]);
});

test("les notes se rangent par heure, de midi a midi", () => {
  const p = night("2026-05-01", {
    timeline: ["2026-05-01T22:05:00", "2026-05-01T22:50:00", "2026-05-02T01:15:00"].map((at, i) => ({ id: String(i), at, text: "", target: null, context: null })),
  });
  const hours = notesByHour([p], 2026);
  assert.equal(hours[0].hour, 12);
  assert.equal(hours.find((h) => h.hour === 22)?.count, 2);
  assert.equal(hours.find((h) => h.hour === 1)?.count, 1);
});
