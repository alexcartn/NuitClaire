import skyData from "./skyData.json";
import { mergeConstellations, namedStarsByConstellation, type ConstellationName } from "./constellationList";

/** Ce que la carte sait nommer sans reseau : les etoiles brillantes qui ont
 * un nom usuel et les constellations, pour la recherche et la selection. */
export interface SkyName {
  name: string;
  raDeg: number;
  decDeg: number;
  mag?: number;
}

export const NAMED_STARS: SkyName[] = (skyData.stars as [number, number, number, string, number][])
  .filter(([, , , label]) => label)
  .map(([ra, dec, mag, label]) => ({ name: label, raDeg: ra, decDeg: dec, mag }));

// Une entree par constellation (le Serpent, en deux morceaux dans le
// fichier, n'en fait qu'une ici), noms en espaces ordinaires pour la
// recherche : voir mergeConstellations.
export const CONSTELLATIONS: ConstellationName[] = mergeConstellations(
  skyData.constellations as { id: string; fr: string; ra: number; dec: number }[],
);

/** Etoiles nommees sur la carte, par constellation (« Ori » : Rigel,
 * Bételgeuse). Quinze constellations seulement en ont une. */
export const CONSTELLATION_STARS = namedStarsByConstellation(
  skyData.stars as [number, number, number, string, number][],
  skyData.lines as [number, number, number, number, string][],
);

export function namedStar(name: string | null): SkyName | null {
  return (name && NAMED_STARS.find((s) => s.name === name)) || null;
}
