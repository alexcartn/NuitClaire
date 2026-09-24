import { test } from "node:test";
import assert from "node:assert/strict";
import { itemSummary, latestMonth, outingYears, outingsByMonth } from "./journalView.ts";
import type { PastSession, SessionItem } from "./types";

const outing = (date: string) => ({ date, closedAt: `${date}T23:00:00` }) as PastSession;

test("les sorties se rangent par annee et par mois, les plus recentes d'abord", () => {
  const past = [outing("2026-09-02"), outing("2026-09-20"), outing("2026-03-11"), outing("2025-12-30")];
  assert.deepEqual(outingYears(past), [2026, 2025]);
  const months = outingsByMonth(past, 2026);
  assert.deepEqual(months[8].map((p) => p.date), ["2026-09-20", "2026-09-02"]);
  assert.deepEqual(months[2].map((p) => p.date), ["2026-03-11"]);
  assert.equal(months[11].length, 0); // decembre 2025 n'est pas dans 2026
  assert.deepEqual(latestMonth(past), { year: 2026, month: 9 });
  assert.equal(latestMonth([]), null);
});

test("le resume d'une cible ne dit que ce qui a ete saisi", () => {
  const item = { designation: "M31", addedAt: "", done: false, notes: [], exposureMin: null, rating: null } as SessionItem;
  assert.equal(itemSummary(item), "");
  assert.equal(
    itemSummary({ ...item, notes: [{}, {}] as SessionItem["notes"], exposureMin: 45, rating: 4 }),
    "2 notes · 45 min · 4/5",
  );
});
