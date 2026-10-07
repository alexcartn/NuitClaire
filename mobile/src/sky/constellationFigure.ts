/** Le dessin d'une constellation, a plat, tel qu'on la voit dans le ciel
 * (nord en haut, est a gauche) : ses traits et les etoiles qui les entourent.
 * Calcul seul ; le dessin est dans ConstellationFigure.tsx. */

export type StarRow = [ra: number, dec: number, mag: number, label: string, bv: number];
export type LineRow = [ra1: number, dec1: number, ra2: number, dec2: number, id: string];

export interface Figure {
  /** Cadre en degres de ciel autour du trace, a la forme demandee. */
  box: { x: number; y: number; w: number; h: number };
  segments: { x1: number; y1: number; x2: number; y2: number }[];
  stars: { x: number; y: number; mag: number; bv: number; label: string }[];
}

const RAD = Math.PI / 180;

/** Projection stereographique centree sur (ra0, dec0), en degres, est a
 * gauche et nord en haut (y vers le bas, comme en SVG). Conforme : les
 * angles sont respectes, donc le dessin ressemble au ciel meme pour les
 * constellations etendues (Hydre, Grande Ourse). Null au point opposé. */
function project(ra: number, dec: number, ra0: number, dec0: number): { x: number; y: number } | null {
  const d = (ra - ra0) * RAD;
  const cosC = Math.sin(dec0 * RAD) * Math.sin(dec * RAD) + Math.cos(dec0 * RAD) * Math.cos(dec * RAD) * Math.cos(d);
  if (cosC < -0.9) return null;
  const k = 2 / (1 + cosC);
  const x = k * Math.cos(dec * RAD) * Math.sin(d);
  const y = k * (Math.cos(dec0 * RAD) * Math.sin(dec * RAD) - Math.sin(dec0 * RAD) * Math.cos(dec * RAD) * Math.cos(d));
  return { x: -x / RAD, y: -y / RAD };
}

/** Centre du trace : moyenne des extremites, l'ascension droite prise sur le
 * cercle (une constellation a cheval sur 0 h ne se moyenne pas comme deux
 * nombres). */
function centerOf(segs: LineRow[]): { ra: number; dec: number } {
  let x = 0, y = 0, dec = 0, n = 0;
  for (const [ra1, dec1, ra2, dec2] of segs) {
    for (const [ra, d] of [[ra1, dec1], [ra2, dec2]]) {
      x += Math.cos(ra * RAD);
      y += Math.sin(ra * RAD);
      dec += d;
      n++;
    }
  }
  return { ra: ((Math.atan2(y, x) / RAD) + 360) % 360, dec: dec / n };
}

/** Dessin de la constellation `id`. `aspect` : largeur / hauteur du cadre ;
 * `margin` : part de marge autour du trace. Null si on n'a aucun trait pour
 * elle. */
export function buildFigure(id: string, stars: StarRow[], lines: LineRow[], aspect = 4 / 3, margin = 0.14): Figure | null {
  const mine = lines.filter((l) => l[4] === id);
  if (mine.length === 0) return null;
  const { ra: ra0, dec: dec0 } = centerOf(mine);

  const segments = mine
    .map(([ra1, dec1, ra2, dec2]) => {
      const a = project(ra1, dec1, ra0, dec0);
      const b = project(ra2, dec2, ra0, dec0);
      return a && b ? { x1: a.x, y1: a.y, x2: b.x, y2: b.y } : null;
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);
  if (segments.length === 0) return null;

  const xs = segments.flatMap((s) => [s.x1, s.x2]);
  const ys = segments.flatMap((s) => [s.y1, s.y2]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  // Au moins quelques degres : une constellation toute petite (le Cheval)
  // ne doit pas remplir le cadre d'une seule etoile.
  let w = Math.max((x1 - x0) * (1 + 2 * margin), 8);
  let h = Math.max((y1 - y0) * (1 + 2 * margin), 8);
  if (w / h < aspect) w = h * aspect;
  else h = w / aspect;
  const box = { x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - h / 2, w, h };

  const inside = stars
    .map(([ra, dec, mag, label, bv]) => {
      const p = project(ra, dec, ra0, dec0);
      return p ? { x: p.x, y: p.y, mag, bv, label } : null;
    })
    .filter((s): s is NonNullable<typeof s> => s !== null && s.x >= box.x && s.x <= box.x + w && s.y >= box.y && s.y <= box.y + h);

  return { box, segments, stars: inside };
}
