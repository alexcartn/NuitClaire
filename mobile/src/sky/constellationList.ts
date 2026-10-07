import { altAz } from "./sky.ts";

/** Une constellation telle que skyData.json la donne : le Serpent y figure
 * deux fois (tete et queue), chaque morceau avec son point central. */
export interface RawConstellation {
  id: string;
  fr: string;
  ra: number;
  dec: number;
}

export interface ConstellationName {
  /** Identifiant du trace (« Ori »), voir skyData.lines. */
  id: string;
  name: string;
  raDeg: number;
  decDeg: number;
}

/** Une entree par constellation. Le Serpent, en deux morceaux, prend le
 * point milieu des deux : la carte s'y centre et la fiche parle d'un seul
 * astre, au lieu de deux lignes identiques dans la recherche. */
export function mergeConstellations(raw: RawConstellation[]): ConstellationName[] {
  const groups = new Map<string, RawConstellation[]>();
  for (const c of raw) groups.set(c.id, [...(groups.get(c.id) ?? []), c]);
  return [...groups.values()].map((g) => {
    // Les noms composes sont ecrits avec des espaces fines (la carte les
    // espace en capitales) : des espaces ordinaires pour la recherche.
    const name = g[0].fr.replace(/\s/g, " ");
    if (g.length === 1) return { id: g[0].id, name, raDeg: g[0].ra, decDeg: g[0].dec };
    // Moyenne sur le cercle : deux ascensions droites de part et d'autre de
    // 0 h ne se moyennent pas comme deux nombres.
    const x = g.reduce((s, c) => s + Math.cos((c.ra * Math.PI) / 180), 0);
    const y = g.reduce((s, c) => s + Math.sin((c.ra * Math.PI) / 180), 0);
    const ra = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
    return { id: g[0].id, name, raDeg: ra, decDeg: g.reduce((s, c) => s + c.dec, 0) / g.length };
  });
}

/** Les etoiles qui portent un nom sur la carte, rangees par constellation
 * (la plus brillante d'abord). Le fichier ne dit pas a quelle constellation
 * appartient une etoile ; mais une etoile nommee est toujours au bout d'un
 * trait de sa constellation, d'ou le rapprochement par les coordonnees. */
export function namedStarsByConstellation(
  stars: [number, number, number, string, number][],
  lines: [number, number, number, number, string][],
): Map<string, string[]> {
  const TOL = 0.02; // deg
  const found = new Map<string, { name: string; mag: number }[]>();
  for (const [ra, dec, mag, label] of stars) {
    if (!label) continue;
    const line = lines.find(
      ([ra1, dec1, ra2, dec2]) =>
        (Math.abs(ra1 - ra) < TOL && Math.abs(dec1 - dec) < TOL) || (Math.abs(ra2 - ra) < TOL && Math.abs(dec2 - dec) < TOL),
    );
    if (line) found.set(line[4], [...(found.get(line[4]) ?? []), { name: label, mag }]);
  }
  return new Map([...found].map(([id, list]) => [id, list.sort((a, b) => a.mag - b.mag).map((s) => s.name)]));
}

export interface ListedConstellation extends ConstellationName {
  alt: number;
  az: number;
  /** Le centre de la figure est au-dessus de l'horizon. */
  up: boolean;
}

/** La liste a parcourir : d'abord ce qui est dans le ciel a cette heure, de
 * la plus haute a la plus basse (ce qu'on a le plus de chances de bien voir),
 * puis le reste par ordre alphabetique. */
export function listConstellations(entries: ConstellationName[], latDeg: number, lst: number): ListedConstellation[] {
  const all = entries.map((c) => {
    const p = altAz(c.raDeg, c.decDeg, latDeg, lst);
    return { ...c, alt: p.alt, az: p.az, up: p.alt > 0 };
  });
  const up = all.filter((c) => c.up).sort((a, b) => b.alt - a.alt);
  const down = all.filter((c) => !c.up).sort((a, b) => a.name.localeCompare(b.name, "fr"));
  return [...up, ...down];
}
