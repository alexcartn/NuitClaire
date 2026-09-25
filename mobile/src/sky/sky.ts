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
