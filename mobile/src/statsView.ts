/** Mise en forme des statistiques du journal (journal/JournalStats.tsx) :
 * mois, Messier, nuits, durees et heures de l'annee choisie. Pur et sans
 * DOM. */
import type { MonthCount, PastSession } from "./types";

/** "2026-09" pour la date locale. `toISOString()` donnait le mois UTC :
 * le soir du 30 septembre apres minuit heure d'ete, on comptait deja
 * octobre, ou l'inverse le 1er au petit matin. */
export function localMonthKey(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export interface MonthBar {
  month: string;
  outings: number;
  captures: number;
}

/** Les `n` derniers mois jusqu'au mois courant inclus, du plus ancien au
 * plus recent. Un mois sans sortie vaut zero : le trou se voit sur le
 * graphique, c'est justement ce qu'on veut y lire. */
export function lastMonths(outings: MonthCount[], captures: MonthCount[], now: Date, n = 12): MonthBar[] {
  const out = new Map(outings.map((m) => [m.month, m.count]));
  const cap = new Map(captures.map((m) => [m.month, m.count]));
  return Array.from({ length: n }, (_, i) => {
    const month = localMonthKey(new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1));
    return { month, outings: out.get(month) ?? 0, captures: cap.get(month) ?? 0 };
  });
}

/** Initiale du mois pour l'axe : « s » pour septembre. */
export function monthInitial(month: string): string {
  return new Date(`${month}-01T00:00`).toLocaleDateString("fr-FR", { month: "narrow" });
}

/** « septembre 2026 » pour la ligne de lecture sous le graphique. */
export function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

/** Les douze mois de `year`, janvier en tete. */
export function monthsOfYear(outings: MonthCount[], captures: MonthCount[], year: number): MonthBar[] {
  return lastMonths(outings, captures, new Date(year, 11, 1), 12);
}

const MESSIER = /^M\d+$/;

export interface MessierCapture {
  date: string;
  designation: string;
  /** Rang du Messier, tous temps confondus : « 24e ». */
  rank: number;
}

/** Premiere capture datee de chaque Messier, a partir des cibles cochees
 * dans les sorties. `before` compte celles d'avant `year`, `captures` celles
 * de l'annee dans l'ordre. Un Messier coche seulement depuis l'ecran Messier
 * n'a pas de date : il n'est pas place sur la courbe, surtout pas a une date
 * inventee (voir `undated`). */
export function messierProgress(past: PastSession[], captured: string[], year: number) {
  const first = new Map<string, string>();
  for (const p of past) {
    for (const item of p.items) {
      if (!item.done || !MESSIER.test(item.designation)) continue;
      const known = first.get(item.designation);
      if (!known || p.date < known) first.set(item.designation, p.date);
    }
  }
  const dated = [...first.entries()]
    .map(([designation, date]) => ({ designation, date }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.designation < b.designation ? -1 : 1))
    .map((c, i) => ({ ...c, rank: i + 1 }));
  const y = String(year);
  return {
    before: dated.filter((c) => c.date.slice(0, 4) < y).length,
    captures: dated.filter((c) => c.date.slice(0, 4) === y) as MessierCapture[],
    undated: captured.filter((d) => !first.has(d)).length,
    total: new Set([...captured, ...first.keys()]).size,
  };
}

export interface NightCell {
  date: string;
  outing: PastSession | null;
}

/** Une ligne par mois, une case par jour : la sortie du jour s'il y en a
 * une (la mieux notee si plusieurs). */
export function yearGrid(past: PastSession[], year: number): NightCell[][] {
  const byDate = new Map<string, PastSession>();
  for (const p of past) {
    const known = byDate.get(p.date);
    if (!known || (p.feeling?.rating ?? 0) > (known.feeling?.rating ?? 0)) byDate.set(p.date, p);
  }
  return Array.from({ length: 12 }, (_, m) => {
    const days = new Date(year, m + 1, 0).getDate();
    return Array.from({ length: days }, (_, d) => {
      const date = `${year}-${String(m + 1).padStart(2, "0")}-${String(d + 1).padStart(2, "0")}`;
      return { date, outing: byDate.get(date) ?? null };
    });
  });
}

/** Horodatages d'activite d'une sortie : ajouts de cibles, notes. Tous en
 * heure locale du site sans fuseau (voir sessionQueue.localIsoNow), donc
 * comparables entre eux comme des chaines. */
function activity(p: PastSession): string[] {
  return [
    ...p.timeline.map((t) => t.at),
    ...p.items.flatMap((i) => [i.addedAt, ...i.notes.map((n) => n.at)]),
  ].filter(Boolean);
}

/** Duree de chaque sortie de l'annee : de l'ouverture a la derniere saisie.
 * Pas jusqu'a la cloture : on la fait souvent le lendemain, au reveil. Une
 * sortie sans deux instants distincts n'a pas de duree mesurable et n'est
 * pas comptee ; au-dela de 14 h, c'est une saisie de rattrapage, pas une
 * nuit. */
export function outingDurations(past: PastSession[], year: number): { date: string; minutes: number }[] {
  const out: { date: string; minutes: number }[] = [];
  for (const p of past) {
    if (Number(p.date.slice(0, 4)) !== year) continue;
    const stamps = activity(p).sort();
    const start = p.openedAt ?? stamps[0];
    const end = stamps[stamps.length - 1];
    if (!start || !end) continue;
    const minutes = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
    if (minutes > 0 && minutes <= 14 * 60) out.push({ date: p.date, minutes });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Heures ou l'on observe : notes du fil de la nuit par heure locale,
 * de midi a midi pour que la nuit tienne d'un seul tenant. */
export function notesByHour(past: PastSession[], year: number): { hour: number; count: number }[] {
  const counts = new Array(24).fill(0);
  for (const p of past) {
    if (Number(p.date.slice(0, 4)) !== year) continue;
    for (const t of p.timeline) {
      const h = Number(t.at.slice(11, 13));
      if (!Number.isNaN(h)) counts[h]++;
    }
  }
  return Array.from({ length: 24 }, (_, i) => {
    const hour = (i + 12) % 24;
    return { hour, count: counts[hour] };
  });
}
