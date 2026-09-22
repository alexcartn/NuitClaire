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
import type { Night, NightConditions, NoteContext } from "./types";

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

/** Moyenne des valeurs connues, ou null si aucune ne l'est. */
function mean(values: (number | null)[]): number | null {
  const known = values.filter((v): v is number => v != null);
  if (known.length === 0) return null;
  return Math.round((known.reduce((a, b) => a + b, 0) / known.length) * 10) / 10;
}

function extremum(values: (number | null)[], pick: (a: number, b: number) => number): number | null {
  const known = values.filter((v): v is number => v != null);
  // Lambda binaire explicite : passer `Math.min` directement a `reduce` lui
  // ferait aussi recevoir l'index et le tableau, et rendrait NaN.
  return known.length === 0 ? null : Math.round(known.reduce((a, b) => pick(a, b)) * 10) / 10;
}

/** Resume des conditions annoncees sur la duree d'une sortie, pour figer a la
 * cloture la vue d'ensemble que le contexte des notes ne donne qu'heure par
 * heure : « il a fait entre 6 et 9 °C, lune a 77 %, seeing moyen 2 ».
 *
 * Borne a la sortie elle-meme, pas a la nuit entiere : ce qui s'est passe
 * apres le rangement du materiel ne raconte pas cette sortie-la. */
export function conditionsBetween(
  night: Night | null,
  from: string,
  to: string,
): NightConditions | null {
  if (!night) return null;
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;

  const span = night.hourly.filter((p) => {
    const t = new Date(p.time).getTime();
    return t >= start && t <= end;
  });
  // Une sortie plus courte qu'un pas horaire peut ne contenir aucun point :
  // on retombe alors sur l'heure la plus proche de son debut, plutot que de
  // ne rien garder.
  const points = span.length > 0 ? span : night.hourly.filter((p) =>
    Math.abs(new Date(p.time).getTime() - start) <= 60 * 60 * 1000);
  if (points.length === 0) return null;

  const dewSpreads = points.map((p) =>
    p.temperatureC != null && p.dewPointC != null ? p.temperatureC - p.dewPointC : null);

  return {
    tempMinC: extremum(points.map((p) => p.temperatureC), Math.min),
    tempMaxC: extremum(points.map((p) => p.temperatureC), Math.max),
    cloudAvgPct: mean(points.map((p) => p.cloudCoverPct)),
    seeingAvg: mean(points.map((p) => p.seeing)),
    transparencyAvg: mean(points.map((p) => p.transparency)),
    // Le plus petit ecart temperature/point de rosee : c'est le moment le
    // plus expose a la buee qui compte, pas la moyenne de la nuit.
    dewSpreadC: extremum(dewSpreads, Math.min),
    moonIllum: night.moonIllum,
  };
}

/** Conditions a figer pour une sortie ouverte a `from` et cloturee a `to`,
 * lues dans la prevision que l'appareil a deja en cache. */
export function captureConditions(from: string, to: string): NightConditions | null {
  return conditionsBetween(readCache<Night>("night"), from, to);
}
