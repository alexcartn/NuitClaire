/** Releve, pour une heure donnee, ce que la prevision de la nuit annoncait.
 *
 * C'est ce qui donne sa valeur au carnet a la relecture : six mois plus tard,
 * « M31, 22h40, ca bavait » se lit avec « 8,2 °C, 5 % de nuages, seeing 2 »
 * a cote, et on comprend pourquoi. Aujourd'hui tout cela est calcule pour
 * l'ecran "Ce soir" puis jete ; il suffit d'en garder une ligne avec chaque
 * note.
 *
 * Fait cote client, et non au moment ou la note arrive au serveur, pour deux
 * raisons :
 *
 *  - une note ecrite hors ligne part quand le reseau revient, parfois des
 *    heures plus tard. Le serveur ne saurait pas retrouver les conditions de
 *    22h40 : sa prevision courante commence aujourd'hui ;
 *  - le client, lui, a deja la nuit entiere sous la main : c'est la reponse
 *    `GET /api/night` gardee sur l'appareil par le cache de `useFetch`.
 *
 * Rien n'est fabrique : la valeur existait, elle est conservee au lieu
 * d'etre jetee. Quand la prevision manque (jamais chargee, ou note ecrite
 * hors de la plage couverte), le contexte vaut null -- inventer une
 * temperature plausible serait exactement la donnee fabriquee que
 * `sessions.py` proscrit. */
// Extension explicite : ce module est dans le graphe d'import des tests
// Node, dont la resolution ESM ne devine pas les extensions.
import { readCache } from "./storage.ts";
import type { Night, NoteContext } from "./types";

/** Au-dela de cet ecart, on considere que la prevision ne dit rien de cette
 * heure-la : la courbe est horaire, une note tombe donc au pire a trente
 * minutes d'un point, et deux heures d'ecart signifient qu'on est hors de la
 * plage couverte. */
const MAX_GAP_MS = 2 * 60 * 60 * 1000;

/** Les horodatages du journal et de la prevision sont en heure locale sans
 * fuseau ("2026-09-21T22:40:03.120000", voir sessionQueue.localIsoNow) :
 * compares tels quels, ils sont donc dans le meme repere. */
function parseLocal(iso: string): number {
  return new Date(iso).getTime();
}

/** Point horaire le plus proche de `at`, ou null s'il n'y en a pas d'assez
 * proche. */
export function contextAt(night: Night | null, at: string): NoteContext | null {
  if (!night || night.hourly.length === 0) return null;
  const target = parseLocal(at);
  if (Number.isNaN(target)) return null;

  let best = night.hourly[0];
  let bestGap = Math.abs(parseLocal(best.time) - target);
  for (const point of night.hourly) {
    const gap = Math.abs(parseLocal(point.time) - target);
    if (gap < bestGap) {
      best = point;
      bestGap = gap;
    }
  }
  if (bestGap > MAX_GAP_MS) return null;

  return {
    temperatureC: best.temperatureC,
    cloudCoverPct: best.cloudCoverPct,
    seeing: best.seeing,
    transparency: best.transparency,
    score: best.score,
    // L'illumination de la Lune bouge a peine sur une nuit (cycle de ~29,5
    // jours) : la valeur de la nuit suffit, pas besoin d'une serie horaire.
    moonIllum: night.moonIllum,
  };
}

/** Contexte a retenir pour une note ecrite a `at`, lu dans la prevision que
 * l'appareil a deja en cache. */
export function captureContext(at: string): NoteContext | null {
  return contextAt(readCache<Night>("night"), at);
}
