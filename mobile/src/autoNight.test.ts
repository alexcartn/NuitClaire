import { test } from "node:test";
import assert from "node:assert/strict";
import { autoNightAction, isDarkNow } from "./autoNight.ts";

const night = {
  date: "2026-09-24",
  nauticalDusk: "2026-09-24T20:40:00",
  nauticalDawn: "2026-09-25T06:10:00",
};

test("il fait noir entre les deux crepuscules nautiques", () => {
  assert.equal(isDarkNow(night, new Date("2026-09-24T20:39:00")), false);
  assert.equal(isDarkNow(night, new Date("2026-09-24T20:40:00")), true);
  assert.equal(isDarkNow(night, new Date("2026-09-25T02:00:00")), true);
  assert.equal(isDarkNow(night, new Date("2026-09-25T06:10:00")), false);
});

test("entre une fois par nuit, pas davantage", () => {
  const late = new Date("2026-09-24T23:00:00");
  assert.equal(autoNightAction(night, late, null), "enter");
  assert.equal(autoNightAction(night, late, "2026-09-23"), "enter");
  // Deja fait cette nuit : on respecte un retour manuel au theme de jour.
  assert.equal(autoNightAction(night, late, "2026-09-24"), null);
});

test("ressort au jour, et ne fait rien sans nuit connue", () => {
  assert.equal(autoNightAction(night, new Date("2026-09-25T09:00:00"), "2026-09-24"), "leave");
  assert.equal(autoNightAction(null, new Date(), null), null);
});
