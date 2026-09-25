/** Enchainement suggere des cibles de la nuit.
 *
 * La liste « Cibles » dit ce qui est pointable, pas dans quel ordre : il
 * fallait soi-meme croiser les creneaux de cinquante objets. Ici, a chaque
 * heure libre, on prend la premiere cible (dans l'ordre de la liste, qui met
 * deja en tete les Messier manquants et les cadrages simples) encore visible
 * assez longtemps, et on lui donne un bloc. Une suggestion calculee sur les
 * creneaux reels, rien d'autre : pas de meteo inventee, pas de temps de pose
 * pretendument optimal.
 *
 * Les heures de la nuit passent minuit : on les compte en minutes depuis
 * midi, pour que 23:00 < 01:00. Pur et sans DOM, teste sous Node. */
export interface PlanInput {
  designation: string;
  start: string | null;
  end: string | null;
}

export interface PlanBlock {
  designation: string;
  start: string;
  end: string;
}

/** Duree visee par cible : de quoi empiler une image correcte au Seestar. */
export const BLOCK_MIN = 60;
/** En dessous, le reste du creneau ne vaut pas un changement de cible. */
export const MIN_BLOCK_MIN = 40;
export const MAX_BLOCKS = 6;

function toNightMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h < 12 ? h + 24 : h) * 60 + m - 12 * 60;
}

function fromNightMinutes(minutes: number): string {
  const total = (minutes + 12 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export interface PlanOptions {
  blockMin?: number;
  minBlockMin?: number;
  maxBlocks?: number;
}

/** Aux jumelles, un objet se regarde en un quart d'heure, pas en une heure
 * de pose : blocs courts, et plus d'objets dans la nuit. */
export const BINOCULAR_PLAN: PlanOptions = { blockMin: 15, minBlockMin: 10, maxBlocks: 10 };

export function planNight(rows: PlanInput[], options: PlanOptions = {}): PlanBlock[] {
  const BLOCK = options.blockMin ?? BLOCK_MIN;
  const MIN_BLOCK = options.minBlockMin ?? MIN_BLOCK_MIN;
  const MAX = options.maxBlocks ?? MAX_BLOCKS;
  const windows = rows
    .filter((r): r is PlanInput & { start: string; end: string } => Boolean(r.start && r.end))
    .map((r) => ({ designation: r.designation, from: toNightMinutes(r.start), to: toNightMinutes(r.end) }))
    .filter((w) => w.to - w.from >= MIN_BLOCK);
  if (windows.length === 0) return [];

  const plan: PlanBlock[] = [];
  const used = new Set<string>();
  const nightEnd = Math.max(...windows.map((w) => w.to));
  let t = Math.min(...windows.map((w) => w.from));

  while (t < nightEnd && plan.length < MAX) {
    const now = t;
    const pick = windows.find((w) => !used.has(w.designation) && w.from <= now && w.to - now >= MIN_BLOCK);
    if (!pick) {
      // Personne de disponible maintenant : on saute au prochain lever.
      const next = windows
        .filter((w) => !used.has(w.designation) && w.from > now)
        .reduce((min, w) => Math.min(min, w.from), Infinity);
      if (!Number.isFinite(next)) break;
      t = next;
      continue;
    }
    // Pas de bloc qui laisserait derriere lui une miette inutilisable.
    let end = Math.min(t + BLOCK, pick.to);
    if (pick.to - end < MIN_BLOCK) end = Math.min(pick.to, t + BLOCK + MIN_BLOCK);
    plan.push({ designation: pick.designation, start: fromNightMinutes(t), end: fromNightMinutes(end) });
    used.add(pick.designation);
    t = end;
  }
  return plan;
}
