/** Lune et planetes a un instant (GET /api/sky/bodies), positions J2000. */
export interface SkyBodies {
  time: string;
  moon: { raDeg: number; decDeg: number; illum: number };
  planets: { name: string; raDeg: number; decDeg: number; mag: number }[];
}

/** La Lune ce soir (GET /api/extras/moon). */
export interface MoonTonight {
  illum: number;
  ageDays: number;
  waxing: boolean;
  rise: string | null;
  set: string | null;
  /** Reliefs le long du terminateur : ceux qui ressortent ce soir. */
  terminatorFeatures: string[];
  tip: string;
}

/** Une planete visible cette nuit (GET /api/extras/planets). */
export interface PlanetTonight {
  name: string;
  mag: number;
  constellation: string;
  from: string;
  to: string;
  bestTime: string;
  bestAlt: number;
  bestAz: number;
  sector: string;
  binocular: boolean;
  /** Jupiter : lunes galileennes, x vers l'est en rayons de Jupiter. */
  moons?: { name: string; x: number; y: number; visible: boolean }[];
  /** Saturne : inclinaison des anneaux vus de la Terre. */
  ringTiltDeg?: number;
}

export interface IssPass {
  start: string;
  startDir: string;
  peak: string;
  peakAlt: number;
  end: string;
  endDir: string;
  brightness: string;
}

export interface IssInfo {
  available: boolean;
  reason?: string;
  passes: IssPass[];
}
