import { test } from "node:test";
import assert from "node:assert/strict";
import { isBody, matchBody } from "./solarSystem.ts";

test("un astre se reconnait a son nom entier, en francais ou en anglais", () => {
  assert.equal(matchBody("saturn"), "Saturne");
  assert.equal(matchBody("  VENUS "), "Vénus");
  assert.equal(matchBody("Lune"), "Lune");
  assert.equal(matchBody("ma"), null);
  assert.equal(isBody("Jupiter"), true);
  assert.equal(isBody("M31"), false);
});
