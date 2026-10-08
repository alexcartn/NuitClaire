/** La saison d'une cible, en clair : hors de portee, cachee par l'horizon, ou
 * de quelle date a quelle date. Pur et sans DOM (teste sous Node) : la fiche
 * ne fait qu'afficher.
 *
 * Tout vient de l'API (season.target_year_windows) : ici on ne decide que des
 * mots et des positions sur la barre. Rien n'est invente : sans meteo ni Lune
 * dans le calcul, la fiche le dit. */
import type { TargetYear } from "./types";

/** Meme seuil que season.MIN_NIGHT_HOURS : une nuit compte a partir de la. */
export const MIN_NIGHT_HOURS = 2;

const DAY_MS = 86_400_000;

/** "2027-03-16" -> minuit local de ce jour. */
function localDay(iso: string): Date {
  return new Date(iso + "T00:00");
}

/** "1er mars", "16 mars" : le premier du mois prend son ordinal, que
 * Intl ne met pas. */
function fmtDay(iso: string, month: "long" | "short"): string {
  const d = localDay(iso);
  return `${d.getDate() === 1 ? "1er" : d.getDate()} ${d.toLocaleDateString("fr-FR", { month })}`;
}

const fmtLong = (iso: string) => fmtDay(iso, "long");
const fmtShort = (iso: string) => fmtDay(iso, "short");

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Jours d'ici a `iso` (negatif si passe). */
function daysUntil(iso: string, today: Date): number {
  return Math.round((localDay(iso).getTime() - startOfDay(today).getTime()) / DAY_MS);
}

/** "demain", "dans 12 jours", "dans 5 mois" : au-dela de deux mois, le jour
 * pres n'apporte rien. */
export function fromNow(days: number): string {
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "demain";
  if (days < 60) return `dans ${days} jours`;
  return `dans ${Math.round(days / 30.4)} mois`;
}

export interface YearView {
  headline: string;
  detail: string | null;
  /** Une ligne par plage de dates : [dates, ce qu'on y gagne]. */
  rows: [string, string][];
  /** La barre n'a rien a montrer quand la cible n'est jamais atteignable. */
  hasBar: boolean;
}

export function describeYear(y: TargetYear, today: Date): YearView {
  const minAlt = Math.round(y.minAltDeg);
  if (y.status === "unreachable") {
    return {
      headline: "Jamais visible depuis ta position",
      detail:
        y.culminationDeg < 0
          ? "Elle reste sous l'horizon toute l'année."
          : y.culminationDeg < y.minAltDeg
            ? `Elle culmine à ${Math.round(y.culminationDeg)}° au mieux, il en faut au moins ${minAlt}°.`
            : `Elle reste moins de ${MIN_NIGHT_HOURS} h par nuit au-dessus de ${minAlt}° en pleine nuit : trop court pour la pointer.`,
      rows: [],
      hasBar: false,
    };
  }
  if (y.status === "hidden") {
    return {
      headline: "Cachée par ton horizon",
      detail: `Elle monte assez haut (${Math.round(y.culminationDeg)}° au mieux), mais jamais dans un secteur dégagé. À revoir dans Réglages, section Horizon.`,
      rows: [],
      hasBar: false,
    };
  }
  const best = y.peakDate ? `, au mieux vers le ${fmtLong(y.peakDate)}` : "";
  if (y.status === "allYear") {
    return {
      headline: "Visible toute l'année",
      detail: `Jusqu'à ${y.peakHours} h par nuit${best}.`,
      rows: [],
      hasBar: true,
    };
  }
  const rows = y.windows.map((w): [string, string] => [
    `${fmtShort(w.start)} → ${fmtShort(w.end)}`,
    `jusqu'à ${w.peakHours} h · pic ${fmtShort(w.peakDate)}`,
  ]);
  const current = y.windows.find((w) => w.current);
  if (current) {
    return { headline: `Visible en ce moment, jusqu'au ${fmtLong(current.end)}`, detail: null, rows, hasBar: true };
  }
  const next = y.windows[0];
  return {
    headline: `Visible à partir du ${fmtLong(next.start)}`,
    detail: `C'est ${fromNow(daysUntil(next.start, today))}.`,
    rows,
    hasBar: true,
  };
}

export interface YearBar {
  /** Plages atteignables, en % de la largeur (0 = debut du mois courant). */
  segments: { left: number; width: number }[];
  /** Position d'aujourd'hui, en %. */
  today: number;
  months: { label: string; left: number; width: number }[];
}

const MONTH_INITIALS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

/** Les 12 mois qui commencent au premier du mois courant. Une plage deja
 * commencee (ou qui reviendra l'an prochain dans la barre) est dessinee
 * aussi a son decalage d'un an : le ciel se repete. */
export function yearBar(y: TargetYear, today: Date): YearBar {
  const axisStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const axisEnd = new Date(today.getFullYear(), today.getMonth() + 12, 1);
  const total = axisEnd.getTime() - axisStart.getTime();
  const pct = (t: number) => ((t - axisStart.getTime()) / total) * 100;
  const shifted = (d: Date, years: number) => new Date(d.getFullYear() + years, d.getMonth(), d.getDate());

  const segments: YearBar["segments"] = [];
  if (y.status === "allYear") {
    segments.push({ left: 0, width: 100 });
  } else {
    for (const w of y.windows) {
      const from = localDay(w.start);
      const to = new Date(localDay(w.end).getTime() + DAY_MS);   // fin incluse
      for (const years of [-1, 0, 1]) {
        const a = Math.max(shifted(from, years).getTime(), axisStart.getTime());
        const b = Math.min(shifted(to, years).getTime(), axisEnd.getTime());
        if (b > a) segments.push({ left: pct(a), width: pct(b) - pct(a) });
      }
    }
  }
  segments.sort((p, q) => p.left - q.left);

  const months = Array.from({ length: 12 }, (_, k) => {
    const from = new Date(axisStart.getFullYear(), axisStart.getMonth() + k, 1);
    const to = new Date(axisStart.getFullYear(), axisStart.getMonth() + k + 1, 1);
    return { label: MONTH_INITIALS[from.getMonth()], left: pct(from.getTime()), width: pct(to.getTime()) - pct(from.getTime()) };
  });
  return { segments, today: pct(startOfDay(today).getTime()), months };
}
