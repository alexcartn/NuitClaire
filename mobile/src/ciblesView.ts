/** Organisation de la page « Cibles » : filtres, heure choisie, groupes.
 * Pur et sans DOM (teste sous Node).
 *
 * Meme logique que le Pokedex Messier : plutot qu'une seule liste de
 * trois cents cartes, une vue d'ensemble de la nuit heure par heure (le
 * pendant du calendrier Messier), puis des groupes repliables. */
import type { TargetRow } from "./types";

export interface CiblesFilters {
  types: string[];
  magRange: [number, number] | null;
  /** Cadre unique seulement : pas de mosaique a assembler. */
  singleFrame: boolean;
  /** Heure choisie (minutes depuis midi), ou null pour toute la nuit. */
  hour: number | null;
}

/** "23:30" -> minutes depuis midi ; la nuit passe minuit sans se retourner. */
export function nightMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return ((h < 12 ? h + 24 : h) - 12) * 60 + m;
}

export function hourLabel(minutesFromNoon: number): string {
  return `${String(Math.floor(minutesFromNoon / 60 + 12) % 24).padStart(2, "0")}h`;
}

/** Visible pendant l'heure qui commence a `hour` (au moins en partie). */
export function visibleDuring(row: TargetRow, hour: number): boolean {
  if (!row.start || !row.end) return false;
  const from = nightMinutes(row.start);
  const to = nightMinutes(row.end);
  return from < hour + 60 && to >= hour;
}

/** Heures pleines couvertes par les creneaux de la nuit. */
export function nightHours(rows: TargetRow[]): number[] {
  const slots = rows.filter((r) => r.start && r.end);
  if (!slots.length) return [];
  const first = Math.floor(Math.min(...slots.map((r) => nightMinutes(r.start!))) / 60) * 60;
  const last = Math.max(...slots.map((r) => nightMinutes(r.end!)));
  const hours = [];
  for (let h = first; h <= last; h += 60) hours.push(h);
  return hours;
}

/** Tous les filtres sauf l'heure : la grille horaire compte ce que les
 * autres filtres laissent passer. */
export function applyFilters(rows: TargetRow[], f: Omit<CiblesFilters, "hour">): TargetRow[] {
  return rows.filter(
    (r) =>
      (f.types.length === 0 || f.types.includes(r.type)) &&
      (!f.magRange || r.mag == null || (r.mag >= f.magRange[0] && r.mag <= f.magRange[1])) &&
      (!f.singleFrame || r.cadrage === "cadre unique" || r.cadrage === "tient dans le champ"),
  );
}

export function activeFilterCount(f: Omit<CiblesFilters, "hour">): number {
  return (f.types.length ? 1 : 0) + (f.magRange ? 1 : 0) + (f.singleFrame ? 1 : 0);
}

export interface CiblesGroup {
  key: string;
  title: string;
  rows: TargetRow[];
}

/** Les Messier encore a capturer d'abord (l'objectif), puis un groupe par
 * type, du plus fourni au moins fourni. L'ordre de l'API (priorite) est
 * garde a l'interieur de chaque groupe. */
export function groupRows(rows: TargetRow[], captured: Set<string>, missingTitle = "Messier à capturer"): CiblesGroup[] {
  const missing = rows.filter((r) => r.messierId && !captured.has(r.messierId));
  const rest = rows.filter((r) => !missing.includes(r));
  const byType = new Map<string, TargetRow[]>();
  for (const r of rest) byType.set(r.type, [...(byType.get(r.type) ?? []), r]);
  const groups: CiblesGroup[] = [];
  if (missing.length) groups.push({ key: "messier", title: missingTitle, rows: missing });
  [...byType.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .forEach(([type, list]) => groups.push({ key: `type:${type}`, title: type, rows: list }));
  return groups;
}
