import { test } from "node:test";
import assert from "node:assert/strict";
import { lastMonths, localMonthKey } from "./statsView.ts";

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
