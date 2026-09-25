/** Lune et planetes a un instant (GET /api/sky/bodies), positions J2000. */
export interface SkyBodies {
  time: string;
  moon: { raDeg: number; decDeg: number; illum: number };
  planets: { name: string; raDeg: number; decDeg: number; mag: number }[];
}
