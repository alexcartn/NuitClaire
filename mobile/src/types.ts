export interface Site {
  name: string;
  lat: number;
  lon: number;
  elevationM: number;
  tz: string;
}

export interface Settings {
  site: Site;
  windowMode: "complete" | "habituelle";
  alerts: Record<string, boolean>;
}

export interface AppState {
  site: Site;
  horizon: Record<string, boolean>;
  windowMode: string;
  messierCaptured: string[];
}

export interface HourlyPoint {
  time: string;
  score: number;
  cloudCoverPct: number | null;
  windGustsKmh: number | null;
  temperatureC: number | null;
  dewPointC: number | null;
}

export interface CloudTrend {
  direction: "amelioration" | "stable" | "degradation";
  label: string;
  nowPct: number;
  futurePct: number;
  delta: number;
}

export interface Night {
  date: string;
  civilDusk: string;
  civilDawn: string;
  nauticalDusk: string;
  nauticalDawn: string;
  astroDusk: string;
  astroDawn: string;
  score: number;
  scorePct: number;
  scoreLabel: string;
  goHours: number;
  bestWindow: string | null;
  moonIllum: number;
  moonWaxing: boolean;
  moonSizeArcmin: number;
  dewSpread: number | null;
  dewRisk: string;
  dewAdvice: string;
  windGustsKmh: number | null;
  windQuality: number;
  cloudTrend: CloudTrend | null;
  hourly: HourlyPoint[];
}

export interface TargetRow {
  designation: string;
  isMessier: boolean;
  messierId: string | null;
  commonName: string;
  ngc: string | null;
  type: string;
  typeCode: string;
  filter: string;
  start: string | null;
  end: string | null;
  hours: number;
  altMaxDeg: number;
  moonSepDeg: number;
  cadrage: string;
  imageUrl: string;
  ra: number;
  dec: number;
  mag: number | null;
  sizeW: number | null;
  sizeH: number | null;
  reasons: string[];
  feasibleTonight: boolean | null;
}

export interface AltitudePoint {
  time: string;
  alt: number;
  az: number;
  sector: string;
  moonSep: number;
}

export interface WikiSummary {
  title: string;
  extract: string;
  url: string;
  lang: string;
}

export interface TargetDetail extends TargetRow {
  altitudeSeries: AltitudePoint[];
  peakSector: string;
  peakAz: number;
  peakTime: string;
  exposureLowMin: number;
  exposureHighMin: number;
  wiki: WikiSummary | null;
}

export const COMPASS_SECTORS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
export type CompassSector = (typeof COMPASS_SECTORS)[number];

// "detail" et "recherche" ne sont pas des onglets de la barre du bas (voir
// TabBar) : on y arrive respectivement en tapant une cible et via l'icone
// recherche de l'ecran "Ce soir", comme dans la maquette.
export type Screen = "soir" | "cibles" | "detail" | "messier" | "recherche" | "reglages" | "journal";

export interface SettingsUpdate {
  site?: { name: string; lat: number; lon: number };
  windowMode?: "complete" | "habituelle";
  alerts?: Record<string, boolean>;
}

export interface GeocodeResult {
  lat: number;
  lon: number;
  displayName: string;
}

export interface Note {
  id: string;
  text: string;
  at: string;
}

export interface TimelineEntry {
  id: string;
  at: string;
  text: string;
  target: string | null;
}

export interface SessionItem {
  designation: string;
  addedAt: string;
  done: boolean;
  notes: Note[];
  exposureMin: number | null;
}

export interface CurrentSession {
  openedAt: string | null;
  scoreAtOpen: number | null;
  items: SessionItem[];
  freeNotes: Note[];
  timeline: TimelineEntry[];
}

export interface PastSession {
  date: string;
  score: number | null;
  targets: string[];
  note: string;
  closedAt: string;
  timeline: TimelineEntry[];
}

export interface Sessions {
  current: CurrentSession;
  past: PastSession[];
}

export interface MonthCount {
  month: string;
  count: number;
}

export interface TargetExposure {
  designation: string;
  totalMin: number;
}

export interface Stats {
  totalOutings: number;
  outingsByMonth: MonthCount[];
  capturesByMonth: MonthCount[];
  successfulOutings: number;
  avgScoreSuccessful: number | null;
  exposureByTarget: TargetExposure[];
  totalExposureMin: number;
}
