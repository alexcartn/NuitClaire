/** Le « Pokedex » Messier : ou en est l'objectif des 110, et quoi chasser
 * ensuite. Pur et sans DOM (teste sous Node) : l'ecran ne fait qu'afficher.
 *
 * Trois sources, rien d'invente : la saison geometrique de chaque objet
 * (season.py : mois observables depuis le site et l'horizon), la faisabilite
 * de ce soir (meteo, Lune, fenetre -- /api/messier), et le journal, d'ou
 * sortent les dates de capture. Un objet marque capture sans trace au
 * journal n'a pas de date : on ne lui en fabrique pas. */
import type { MessierSeason, Sessions, TargetRow } from "./types";

export const MESSIER_TOTAL = 110;

export const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/** "M31" -> "31" ; une designation NGC d'un Messier se resout via `ngcToId`. */
export function messierIdOf(designation: string, ngcToId?: Map<string, string>): string | null {
  const m = /^M\s*0*(\d{1,3})$/i.exec(designation.trim());
  if (m) return m[1];
  return ngcToId?.get(designation.replace(/\s+/g, "").toUpperCase()) ?? null;
}

/** Premiere nuit du journal ou chaque Messier a ete photographie : la
 * sortie ou il est coche fait, a defaut la premiere ou il apparait. */
export function captureDates(sessions: Sessions | null, ngcToId?: Map<string, string>): Map<string, string> {
  const done = new Map<string, string>();
  const seen = new Map<string, string>();
  const keepEarliest = (map: Map<string, string>, id: string, date: string) => {
    const cur = map.get(id);
    if (!cur || date < cur) map.set(id, date);
  };
  for (const outing of sessions?.past ?? []) {
    const items = outing.items?.length ? outing.items : outing.targets.map((designation) => ({ designation, done: false }));
    for (const item of items) {
      const id = messierIdOf(item.designation, ngcToId);
      if (!id) continue;
      keepEarliest(seen, id, outing.date);
      if (item.done) keepEarliest(done, id, outing.date);
    }
  }
  for (const [id, date] of seen) if (!done.has(id)) done.set(id, date);
  return done;
}

export interface DexEntry {
  id: string;
  designation: string;
  number: number;
  captured: boolean;
  capturedOn: string | null;
  row: TargetRow | null;
  season: MessierSeason | null;
  /** Faisable ce soir (meteo et Lune comprises) ; null si inconnu. */
  tonight: boolean | null;
  /** Visible ce mois-ci mais plus dans un ou deux mois. */
  leavingSoon: boolean;
}

export interface DexPlan {
  entries: DexEntry[];
  tonight: DexEntry[];
  lastChance: DexEntry[];
  thisMonth: DexEntry[];
  upcoming: { month: number; entries: DexEntry[] }[];
  hiddenByHorizon: DexEntry[];
  outOfReach: DexEntry[];
  capturedCount: number;
}

const visibleIn = (s: MessierSeason | null, month0: number) => !!s && s.monthHours[((month0 % 12) + 12) % 12] > 0;

function toMinutesFromNoon(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return ((h < 12 ? h + 24 : h) - 12) * 60 + m;
}

export function buildDex(
  rows: TargetRow[] | null,
  seasons: MessierSeason[] | null,
  captured: Set<string>,
  dates: Map<string, string>,
  month: number,
): DexPlan {
  const m0 = month - 1;
  const rowById = new Map((rows ?? []).filter((r) => r.messierId).map((r) => [r.messierId as string, r]));
  const seasonById = new Map((seasons ?? []).filter((s) => s.id).map((s) => [s.id as string, s]));

  const entries: DexEntry[] = [];
  for (let n = 1; n <= MESSIER_TOTAL; n++) {
    const id = String(n);
    const row = rowById.get(id) ?? null;
    const season = seasonById.get(id) ?? null;
    const isCaptured = captured.has(id);
    entries.push({
      id,
      designation: `M${n}`,
      number: n,
      captured: isCaptured,
      capturedOn: isCaptured ? dates.get(id) ?? null : null,
      row,
      season,
      tonight: row ? (row.feasibleTonight ?? null) : null,
      leavingSoon: visibleIn(season, m0) && (!visibleIn(season, m0 + 1) || !visibleIn(season, m0 + 2)),
    });
  }

  const missing = entries.filter((e) => !e.captured);
  // Ceux qui s'en vont d'abord : un objet qui reviendra dans six mois peut
  // attendre, pas celui qu'on ne reverra qu'a l'automne prochain.
  const tonight = missing
    .filter((e) => e.tonight && e.row?.start)
    .sort((a, b) => Number(b.leavingSoon) - Number(a.leavingSoon)
      || toMinutesFromNoon(a.row!.start!) - toMinutesFromNoon(b.row!.start!));
  const rest = missing.filter((e) => !tonight.includes(e));
  const lastChance = rest.filter((e) => e.leavingSoon);
  const thisMonth = rest.filter((e) => !e.leavingSoon && visibleIn(e.season, m0));
  const hiddenByHorizon = rest.filter((e) => e.season?.reachable && e.season.bestMonth === null);
  const outOfReach = rest.filter((e) => e.season && !e.season.reachable);

  // A venir : groupes par premier mois ou l'objet redevient visible.
  const later = rest.filter((e) => e.season?.bestMonth != null && !visibleIn(e.season, m0));
  const byMonth = new Map<number, DexEntry[]>();
  for (const e of later) {
    for (let k = 1; k <= 12; k++) {
      if (visibleIn(e.season, m0 + k)) {
        const target = ((m0 + k) % 12) + 1;
        byMonth.set(target, [...(byMonth.get(target) ?? []), e]);
        break;
      }
    }
  }
  const upcoming = [...byMonth.entries()]
    .sort(([a], [b]) => ((a - month + 12) % 12) - ((b - month + 12) % 12))
    .map(([m, list]) => ({ month: m, entries: list }));

  return {
    entries, tonight, lastChance, thisMonth, upcoming, hiddenByHorizon, outOfReach,
    capturedCount: entries.filter((e) => e.captured).length,
  };
}

export interface Pace {
  thisMonth: number;
  thisYear: number;
  /** Captures datees sur les 12 derniers mois, et le nombre de mois qu'il
   * faudrait a ce rythme pour finir ; null tant qu'il y a trop peu de dates
   * pour parler de rythme. */
  lastYear: number;
  monthsToGo: number | null;
}

export function pace(dates: Map<string, string>, capturedCount: number, today: Date): Pace {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const month = iso(today).slice(0, 7);
  const year = iso(today).slice(0, 4);
  const yearAgo = new Date(today);
  yearAgo.setFullYear(today.getFullYear() - 1);
  const all = [...dates.values()];
  const lastYear = all.filter((d) => d > iso(yearAgo)).length;
  const remaining = MESSIER_TOTAL - capturedCount;
  return {
    thisMonth: all.filter((d) => d.startsWith(month)).length,
    thisYear: all.filter((d) => d.startsWith(year)).length,
    lastYear,
    monthsToGo: lastYear >= 3 && remaining > 0 ? Math.ceil(remaining / (lastYear / 12)) : null,
  };
}
