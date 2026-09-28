/** Calculs du ciel sur le telephone, pour la carte et le viseur.
 *
 * Tout se calcule ici, sans requete : dehors, le reseau manque, et une carte
 * qui tourne avec le telephone ne peut pas attendre un serveur a chaque
 * mouvement. Precision de l'ordre du dixieme de degre (positions J2000, sans
 * precession ni refraction), largement sous l'erreur d'une boussole de
 * telephone (5 a 10 deg). Pur et sans DOM : teste sous Node. */

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

export interface AltAz {
  alt: number;
  az: number;
}

export function julianDate(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

/** Temps sideral moyen de Greenwich, en degres. */
export function gmstDeg(date: Date): number {
  const d = julianDate(date) - 2451545.0;
  return (((280.46061837 + 360.98564736629 * d) % 360) + 360) % 360;
}

export function lstDeg(date: Date, lonDeg: number): number {
  return (((gmstDeg(date) + lonDeg) % 360) + 360) % 360;
}

/** Hauteur et azimut (nord = 0, est = 90) d'une position equatoriale. */
export function altAz(raDeg: number, decDeg: number, latDeg: number, lst: number): AltAz {
  const h = (lst - raDeg) * RAD;
  const dec = decDeg * RAD;
  const lat = latDeg * RAD;
  const sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(h);
  const x = -Math.sin(h) * Math.cos(dec);
  const y = Math.sin(dec) * Math.cos(lat) - Math.cos(dec) * Math.sin(lat) * Math.cos(h);
  return {
    alt: Math.asin(Math.max(-1, Math.min(1, sinAlt))) * DEG,
    az: ((Math.atan2(x, y) * DEG) % 360 + 360) % 360,
  };
}

/** Ecart angulaire entre deux directions du ciel, en degres. */
export function separation(a: AltAz, b: AltAz): number {
  const c =
    Math.sin(a.alt * RAD) * Math.sin(b.alt * RAD) +
    Math.cos(a.alt * RAD) * Math.cos(b.alt * RAD) * Math.cos((a.az - b.az) * RAD);
  return Math.acos(Math.max(-1, Math.min(1, c))) * DEG;
}

/** Carte en dome, comme un planisphere tenu au-dessus de la tete : zenith au
 * centre, horizon sur le cercle de rayon 1, est a gauche. `rotation` (deg)
 * fait tourner le ciel : 0 = nord en haut ; cap + 180 = la direction qu'on
 * regarde en bas, comme on tient un planisphere devant soi. Null sous
 * l'horizon. Projection stereographique : les constellations gardent leur
 * forme jusqu'au bord. */
export function domeProject(p: AltAz, rotation = 0): { x: number; y: number } | null {
  if (p.alt < 0) return null;
  const r = Math.tan(((90 - p.alt) / 2) * RAD); // tan(45) = 1 a l'horizon
  const a = (p.az - rotation) * RAD;
  return { x: -r * Math.sin(a), y: -r * Math.cos(a) };
}

/** Vue autour d'une direction (viseur) : projection gnomonique, en degres,
 * x vers la droite, y vers le haut, comme on voit le ciel en le regardant.
 * Null derriere soi. */
export function viewProject(p: AltAz, center: AltAz): { x: number; y: number } | null {
  const alt = p.alt * RAD;
  const alt0 = center.alt * RAD;
  const dAz = (p.az - center.az) * RAD;
  const c = Math.sin(alt0) * Math.sin(alt) + Math.cos(alt0) * Math.cos(alt) * Math.cos(dAz);
  if (c <= 0.15) return null;
  return {
    x: ((Math.cos(alt) * Math.sin(dAz)) / c) * DEG,
    y: ((Math.cos(alt0) * Math.sin(alt) - Math.sin(alt0) * Math.cos(alt) * Math.cos(dAz)) / c) * DEG,
  };
}

/** Direction visee par le dos du telephone (l'axe de l'appareil photo), a
 * partir de l'orientation W3C : `alpha` absolu (sens trigonometrique depuis
 * le nord), `beta`, `gamma` en degres. On tient le telephone contre les
 * jumelles, dans le meme axe. */
export function pointing(alpha: number, beta: number, gamma: number): AltAz {
  const a = alpha * RAD;
  const b = beta * RAD;
  const g = gamma * RAD;
  // Troisieme colonne de Rz(alpha) Rx(beta) Ry(gamma) : l'axe z de
  // l'appareil (sortant de l'ecran) dans le repere est-nord-haut. L'appareil
  // photo regarde a l'oppose.
  const zx = Math.cos(a) * Math.sin(g) + Math.sin(a) * Math.sin(b) * Math.cos(g);
  const zy = Math.sin(a) * Math.sin(g) - Math.cos(a) * Math.sin(b) * Math.cos(g);
  const zz = Math.cos(b) * Math.cos(g);
  const vx = -zx;
  const vy = -zy;
  const vz = -zz;
  return {
    alt: Math.asin(Math.max(-1, Math.min(1, vz))) * DEG,
    az: ((Math.atan2(vx, vy) * DEG) % 360 + 360) % 360,
  };
}

export interface Guidance {
  /** Degres a tourner vers la droite (negatif : vers la gauche). */
  right: number;
  /** Degres a monter (negatif : descendre). */
  up: number;
  separation: number;
}

export function guidance(target: AltAz, aim: AltAz): Guidance {
  const right = ((target.az - aim.az + 540) % 360) - 180;
  return { right, up: target.alt - aim.alt, separation: separation(target, aim) };
}

/** « 12° à droite, 8° plus haut ». */
export function guidanceText(g: Guidance): string {
  const parts = [];
  if (Math.abs(g.right) >= 1) parts.push(`${Math.round(Math.abs(g.right))}° ${g.right > 0 ? "à droite" : "à gauche"}`);
  if (Math.abs(g.up) >= 1) parts.push(`${Math.round(Math.abs(g.up))}° ${g.up > 0 ? "plus haut" : "plus bas"}`);
  return parts.join(", ") || "droit devant";
}

const SECTORS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

/** Secteur cardinal d'un azimut (meme regle que astro.compass_sector). */
export function sectorOf(az: number): string {
  return SECTORS[Math.round((((az % 360) + 360) % 360) / 45) % 8];
}

/** Comme `domeProject`, sans rien couper sous l'horizon (jusqu'a -85 deg) :
 * pour les contours de la Voie lactee, que la carte rogne ensuite au cercle
 * de l'horizon. */
export function domeProjectFree(p: AltAz, rotation = 0): { x: number; y: number } {
  const alt = Math.max(-85, p.alt);
  const r = Math.tan(((90 - alt) / 2) * RAD);
  const a = (p.az - rotation) * RAD;
  return { x: -r * Math.sin(a), y: -r * Math.cos(a) };
}

/** Position du Soleil (ascension droite, declinaison, degres), formule
 * simplifiee de l'Astronomical Almanac : a 0,01 deg pres, bien assez pour
 * la lueur du crepuscule et le cote eclaire de la Lune. */
export function sunRaDec(date: Date): { ra: number; dec: number } {
  const n = julianDate(date) - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * RAD;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const eps = (23.439 - 0.0000004 * n) * RAD;
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda)) * DEG;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda)) * DEG;
  return { ra: ((ra % 360) + 360) % 360, dec };
}

// Couleur d'une etoile selon son indice B-V : des bleues (Rigel, -0,03) aux
// orangees (Antares, Betelgeuse, 1,8). Teintes adoucies : sur un ecran, des
// couleurs franches feraient guirlande.
const BV_COLORS: [number, [number, number, number]][] = [
  [-0.4, [170, 191, 255]], [0.0, [202, 215, 255]], [0.4, [248, 247, 255]],
  [0.6, [255, 244, 234]], [0.8, [255, 232, 206]], [1.2, [255, 210, 161]], [1.8, [255, 180, 120]],
];

export function bvColor(bv: number): string {
  const x = Math.max(-0.4, Math.min(1.8, bv));
  let i = 0;
  while (i < BV_COLORS.length - 2 && x > BV_COLORS[i + 1][0]) i++;
  const [x0, c0] = BV_COLORS[i];
  const [x1, c1] = BV_COLORS[i + 1];
  const t = (x - x0) / (x1 - x0);
  const c = c0.map((v, k) => Math.round(v + (c1[k] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/** Hauteur de l'horizon masque dans la direction `az`, interpolee entre les
 * huit secteurs (la hauteur de chacun vaut en son milieu) : une silhouette
 * continue plutot que huit marches. Un secteur bouche compte pour null. */
export function horizonFloor(az: number, horizon: Record<string, boolean>, horizonAlt: Record<string, number>): number | null {
  const a = ((az % 360) + 360) % 360;
  const i = Math.floor(a / 45);
  const t = (a - i * 45) / 45;
  const s0 = SECTORS[i];
  const s1 = SECTORS[(i + 1) % 8];
  if (!horizon[s0] && !horizon[s1]) return null;
  if (!horizon[s0]) return t > 0.5 ? horizonAlt[s1] ?? 0 : null;
  if (!horizon[s1]) return t < 0.5 ? horizonAlt[s0] ?? 0 : null;
  const h0 = horizonAlt[s0] ?? 0;
  const h1 = horizonAlt[s1] ?? 0;
  // Raccord en cosinus : pas d'angle vif entre deux secteurs.
  const k = (1 - Math.cos(t * Math.PI)) / 2;
  return h0 + (h1 - h0) * k;
}

export type SkySymbol = "galaxy" | "open" | "globular" | "planetary" | "nebula" | "other";

/** Symboles des atlas : ellipse pour une galaxie, cercle pointille pour un
 * amas ouvert, cercle barre pour un globulaire, carre pour une nebuleuse. */
export function symbolOf(kind?: string): SkySymbol {
  const k = (kind ?? "").toLowerCase();
  if (k === "g" || k.includes("galax")) return "galaxy";
  if (k === "gcl" || k.includes("globul")) return "globular";
  if (k === "ocl" || k === "*ass" || k.includes("amas") || k.includes("astérisme") || k.includes("association")) return "open";
  if (k === "pn" || k.includes("planétaire")) return "planetary";
  if (["neb", "hii", "rfn", "snr", "cl+n", "emn"].includes(k) || k.includes("nébuleuse") || k.includes("rémanent") || k.includes("région")) return "nebula";
  return "other";
}

/** Vue face a l'horizon, comme on voit le ciel debout : projection
 * stereographique centree sur la direction regardee `center`, x vers la
 * droite, y vers le bas (coordonnees d'ecran). Meme echelle que le dome au
 * centre (tan de la moitie de l'ecart) : un degre y a la meme taille. Les
 * cercles restent des cercles, les constellations gardent leur forme jusque
 * sur les bords. Null seulement a l'oppose exact de la direction regardee. */
export function horizonProject(p: AltAz, center: AltAz): { x: number; y: number } | null {
  const alt = p.alt * RAD;
  const alt0 = center.alt * RAD;
  const dAz = (p.az - center.az) * RAD;
  const cosC = Math.sin(alt0) * Math.sin(alt) + Math.cos(alt0) * Math.cos(alt) * Math.cos(dAz);
  if (1 + cosC < 1e-6) return null;
  const k = 1 / (1 + cosC);
  return {
    x: k * Math.cos(alt) * Math.sin(dAz),
    y: -k * (Math.cos(alt0) * Math.sin(alt) - Math.sin(alt0) * Math.cos(alt) * Math.cos(dAz)),
  };
}

export interface Visibility {
  /** Hauteur et direction a l'instant de depart. */
  now: AltAz;
  /** Derriere les arbres ou les toits a l'instant de depart (au-dessus de
   * l'horizon mais sous la cime), ou dans un secteur bouche. */
  hiddenNow: boolean;
  rise: Date | null;
  set: Date | null;
  /** Passage au plus haut dans les 24 h qui suivent. */
  culmination: { time: Date; alt: number; az: number };
  /** Premiere plage degagee (au-dessus de l'horizon masque) a partir du
   * depart, dans les 24 h ; null si l'objet ne sort jamais des arbres. */
  clear: { from: Date; to: Date } | null;
  circumpolar: boolean;
  neverUp: boolean;
}

/** Lever, coucher, passage au plus haut et plage degagee au-dessus de
 * l'horizon reel (arbres, toits, secteurs bouches), sur les 24 h qui
 * suivent `from`, au pas de 5 min : a quelques minutes pres, ce qui suffit
 * pour savoir quand sortir les jumelles. `raRateDegPerHour` fait avancer la
 * Lune (environ 0,55 deg/h) ; les etoiles et le ciel profond restent fixes,
 * les planetes bougent trop peu pour compter en une nuit. */
export function visibility(
  raDeg: number,
  decDeg: number,
  site: { lat: number; lon: number },
  from: Date,
  horizon: Record<string, boolean>,
  horizonAlt: Record<string, number>,
  raRateDegPerHour = 0,
): Visibility {
  const STEP_MIN = 5;
  const steps = (24 * 60) / STEP_MIN;
  let rise: Date | null = null;
  let set: Date | null = null;
  let best = { time: from, alt: -91, az: 0 };
  let clearFrom: Date | null = null;
  let clearTo: Date | null = null;
  let prev: AltAz | null = null;
  let prevClear = false;
  let now: AltAz = { alt: 0, az: 0 };
  let hiddenNow = false;
  let everUp = false;
  let everDown = false;
  for (let i = 0; i <= steps; i++) {
    const t = new Date(from.getTime() + i * STEP_MIN * 60000);
    const p = altAz(raDeg + (raRateDegPerHour * i * STEP_MIN) / 60, decDeg, site.lat, lstDeg(t, site.lon));
    const floor = horizonFloor(p.az, horizon, horizonAlt);
    const isClear = floor != null && p.alt > Math.max(0, floor);
    if (i === 0) {
      now = p;
      hiddenNow = p.alt > 0 && !isClear;
    }
    if (p.alt > 0) everUp = true;
    else everDown = true;
    if (prev) {
      if (!rise && prev.alt <= 0 && p.alt > 0) rise = t;
      if (!set && prev.alt > 0 && p.alt <= 0) set = t;
    }
    if (p.alt > best.alt) best = { time: t, alt: p.alt, az: p.az };
    if (isClear && !clearFrom) clearFrom = t;
    if (clearFrom && !clearTo && prevClear && !isClear) clearTo = t;
    prev = p;
    prevClear = isClear;
  }
  const end = new Date(from.getTime() + 24 * 3600000);
  return {
    now,
    hiddenNow,
    rise,
    set,
    culmination: best,
    clear: clearFrom ? { from: clearFrom, to: clearTo ?? end } : null,
    circumpolar: !everDown,
    neverUp: !everUp,
  };
}

/** Pour chercher sans se soucier des accents, des majuscules ni des espaces
 * speciaux (« Grande Ourse » est ecrit avec des espaces fines). */
export function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").toLowerCase().trim();
}
