/** Mise en forme des statistiques du journal (journal/JournalStats.tsx) :
 * les douze derniers mois pour le graphique, et le mois courant. Pur et
 * sans DOM. */
import type { MonthCount } from "./types";

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
