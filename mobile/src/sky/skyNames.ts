import skyData from "./skyData.json";

/** Ce que la carte sait nommer sans reseau : les etoiles brillantes qui ont
 * un nom usuel et les constellations, pour la recherche et la selection. */
export interface SkyName {
  /** Constellations : identifiant du tracé (« Ori »), voir skyData.lines. */
  id?: string;
  name: string;
  raDeg: number;
  decDeg: number;
  mag?: number;
}

export const NAMED_STARS: SkyName[] = (skyData.stars as [number, number, number, string, number][])
  .filter(([, , , label]) => label)
  .map(([ra, dec, mag, label]) => ({ name: label, raDeg: ra, decDeg: dec, mag }));

// Les noms composes sont ecrits avec des espaces fines (la carte les
// espace en capitales) : des espaces ordinaires pour la recherche.
export const CONSTELLATIONS: SkyName[] = (skyData.constellations as { id: string; fr: string; ra: number; dec: number }[])
  .map((c) => ({ id: c.id, name: c.fr.replace(/\s/g, " "), raDeg: c.ra, decDeg: c.dec }));

export function namedStar(name: string | null): SkyName | null {
  return (name && NAMED_STARS.find((s) => s.name === name)) || null;
}
