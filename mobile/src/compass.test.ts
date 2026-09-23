/** Tests de la conversion cap -> secteur cardinal (compass.ts).
 *
 * Doit s'accorder avec `astro.compass_sector` cote Python : sinon la
 * boussole designerait un secteur d'horizon que le calcul de visibilite
 * appelle autrement.
 *
 *     npm test        # depuis mobile/
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { sectorFor } from "./compass.ts";

test("chaque direction cardinale tombe dans son secteur", () => {
  assert.deepEqual(
    [0, 45, 90, 135, 180, 225, 270, 315].map(sectorFor),
    ["N", "NE", "E", "SE", "S", "SW", "W", "NW"],
  );
});

test("un secteur couvre 45 degres, centres sur sa direction", () => {
  // Le nord va de 337,5° a 22,5° : il enjambe le zero.
  assert.equal(sectorFor(337.5), "N");
  assert.equal(sectorFor(359.9), "N");
  assert.equal(sectorFor(22.4), "N");
  assert.equal(sectorFor(22.6), "NE");
  assert.equal(sectorFor(337.4), "NW");
});

test("un cap hors bornes est ramene sur le tour", () => {
  // Certains navigateurs publient des valeurs cumulees ou negatives.
  assert.equal(sectorFor(360), "N");
  assert.equal(sectorFor(450), "E");
  assert.equal(sectorFor(-90), "W");
  assert.equal(sectorFor(-1), "N");
});
