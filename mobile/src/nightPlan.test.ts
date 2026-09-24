import { test } from "node:test";
import assert from "node:assert/strict";
import { planNight } from "./nightPlan.ts";

test("enchaine les cibles dans l'ordre de priorite, a travers minuit", () => {
  const plan = planNight([
    { designation: "M31", start: "21:00", end: "05:00" },
    { designation: "M33", start: "21:00", end: "04:00" },
    { designation: "M42", start: "01:00", end: "05:30" },
  ]);
  assert.deepEqual(plan.slice(0, 2), [
    { designation: "M31", start: "21:00", end: "22:00" },
    { designation: "M33", start: "22:00", end: "23:00" },
  ]);
  // Plus rien avant 01:00 : on attend le lever de M42 plutot que de
  // reprendre une cible deja faite.
  assert.deepEqual(plan[2], { designation: "M42", start: "01:00", end: "02:00" });
  assert.equal(plan.length, 3);
});

test("ignore les creneaux trop courts et les cibles infaisables", () => {
  assert.deepEqual(
    planNight([
      { designation: "M1", start: "22:00", end: "22:20" },
      { designation: "M2", start: null, end: null },
    ]),
    [],
  );
});

test("ne laisse pas de miette en fin de creneau", () => {
  const plan = planNight([{ designation: "M13", start: "21:00", end: "22:30" }]);
  assert.deepEqual(plan, [{ designation: "M13", start: "21:00", end: "22:30" }]);
});
