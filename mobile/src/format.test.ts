import { test } from "node:test";
import assert from "node:assert/strict";
import { fmtLatLon, plural } from "./format.ts";

test("zero et un au singulier", () => {
  assert.equal(plural(0, "sortie", "sorties"), "0 sortie");
  assert.equal(plural(1, "sortie", "sorties"), "1 sortie");
  assert.equal(plural(2, "sortie", "sorties"), "2 sorties");
});

test("l'hemisphere suit le signe", () => {
  assert.equal(fmtLatLon(48.9124, 4.529), "48,91° N · 4,53° E");
  assert.equal(fmtLatLon(-33.86, -70.65), "33,86° S · 70,65° O");
});
