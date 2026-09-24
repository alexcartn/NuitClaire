/** Organisation de la page Journal : les sorties passees rangees par annee
 * et par mois, comme le calendrier du Pokedex Messier -- une grille de
 * douze mois ou l'on voit d'un coup d'oeil quand on sort, puis la liste du
 * mois touche, au lieu d'un long defilement de cartes. Pur et sans DOM. */
import type { PastSession, SessionItem } from "./types";

/** Annees ou il y a au moins une sortie, la plus recente d'abord. */
export function outingYears(past: PastSession[]): number[] {
  return [...new Set(past.map((p) => Number(p.date.slice(0, 4))))].sort((a, b) => b - a);
}

/** Sorties de l'annee par mois (janvier = 0), les plus recentes d'abord. */
export function outingsByMonth(past: PastSession[], year: number): PastSession[][] {
  const months: PastSession[][] = Array.from({ length: 12 }, () => []);
  for (const p of past) {
    if (Number(p.date.slice(0, 4)) !== year) continue;
    months[Number(p.date.slice(5, 7)) - 1].push(p);
  }
  months.forEach((list) => list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)));
  return months;
}

/** Mois a ouvrir par defaut : celui de la sortie la plus recente. */
export function latestMonth(past: PastSession[]): { year: number; month: number } | null {
  if (past.length === 0) return null;
  const latest = past.reduce((a, b) => (a.date >= b.date ? a : b));
  return { year: Number(latest.date.slice(0, 4)), month: Number(latest.date.slice(5, 7)) };
}

/** Une ligne pour une cible repliee de la session en cours :
 * « 3 notes · 45 min · 4/5 ». Rien pour ce qui n'est pas saisi. */
export function itemSummary(item: SessionItem): string {
  return [
    item.notes.length ? `${item.notes.length} note${item.notes.length > 1 ? "s" : ""}` : null,
    item.exposureMin ? `${item.exposureMin} min` : null,
    item.rating != null ? `${item.rating}/5` : null,
  ].filter(Boolean).join(" · ");
}
