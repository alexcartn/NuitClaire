/** Conversion d'un cap en secteur cardinal.
 *
 * Meme regle que `astro.compass_sector` cote Python : huit secteurs de 45°,
 * centres sur leur direction (N va de 337,5° a 22,5°). Les deux doivent
 * s'accorder, sinon la boussole designerait un secteur d'horizon que le
 * calcul de visibilite appelle autrement. */
// Extension explicite : `COMPASS_SECTORS` est une valeur, pas un type, et ce
// module est dans le graphe d'import des tests Node, dont la resolution ESM
// ne devine pas les extensions.
import { COMPASS_SECTORS } from "./types.ts";
import type { CompassSector } from "./types";

export function sectorFor(heading: number): CompassSector {
  const index = Math.floor((((heading % 360) + 360) % 360 + 22.5) / 45) % 8;
  return COMPASS_SECTORS[index];
}
