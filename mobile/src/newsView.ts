/** Les actualites reliees au reste de l'appli : un objet cite est-il visible
 * ce soir, quels articles parlent d'une cible, ce qui merite d'etre signale
 * dans « Ce soir ». Pur et sans DOM. */
import { fmtHM } from "./format.ts";
import { readText, writeText } from "./storage.ts";
import type { CometsInfo, NewsItem, NewsObject, TargetRow } from "./types";
import type { PlanetTonight } from "./sky/types";

/** Ce que l'appli sait deja de ce soir : de quoi dire si un objet cite est
 * visible, sans nouveau calcul. */
export interface Tonight {
  targets: TargetRow[] | null;
  planets: PlanetTonight[] | null;
  comets: CometsInfo | null;
}

export interface Visibility {
  text: string;
  visible: boolean;
}

/** Une cible du catalogue, par ses trois noms possibles. */
export interface TargetKey {
  designation: string;
  ngc: string | null;
  messierId: string | null;
}

export function sameTarget(o: NewsObject, t: TargetKey): boolean {
  if (o.kind === "planet") return o.designation === t.designation;
  return o.kind === "target"
    && (o.designation === t.designation || Boolean(o.ngc && o.ngc === t.ngc) || Boolean(o.messier && o.messier === t.messierId));
}

/** « visible 21:30–03:00 », « pas pointable ce soir », ou null quand on ne
 * sait pas (Neptune, que l'appli ne calcule pas ; donnees pas encore la). */
export function visibility(o: NewsObject, t: Tonight): Visibility | null {
  if (o.kind === "target") {
    if (!t.targets) return null;
    const row = t.targets.find((r) => sameTarget(o, r));
    return row?.start && row.end
      ? { text: `visible ${row.start}–${row.end}`, visible: true }
      : { text: "pas pointable ce soir", visible: false };
  }
  if (o.kind === "planet") {
    if (!t.planets || o.designation === "Neptune") return null;
    const p = t.planets.find((x) => x.name === o.designation);
    return p ? { text: `visible ${fmtHM(p.from)}–${fmtHM(p.to)}`, visible: true } : { text: "pas visible ce soir", visible: false };
  }
  if (!t.comets?.available) return null;
  const c = t.comets.comets.find((x) => x.designation === o.designation);
  return c
    ? { text: `visible, mag. ${c.mag.toFixed(1).replace(".", ",")}`, visible: true }
    : { text: "pas à portée ce soir", visible: false };
}

const RECENT_DAYS = 30;

function recent(item: NewsItem, now: Date): boolean {
  return Boolean(item.date && now.getTime() - new Date(item.date).getTime() <= RECENT_DAYS * 86_400_000);
}

export interface MustSee {
  item: NewsItem;
  object: NewsObject;
  visibility: Visibility;
}

/** « À ne pas manquer » : articles « à observer » recents dont un objet cite
 * est visible ce soir. Un objet n'apparait qu'une fois (l'article le plus
 * recent), et les planetes seulement si rien d'autre : Saturne visible des
 * semaines durant n'est pas une nouvelle chaque soir. */
export function mustSee(items: NewsItem[], tonight: Tonight, now: Date, limit = 2): MustSee[] {
  const out: MustSee[] = [];
  const seen = new Set<string>();
  const candidates = items.filter((i) => i.kind === "observer" && recent(i, now));
  for (const pass of ["rare", "planet"] as const) {
    for (const item of candidates) {
      for (const object of item.objects) {
        if ((object.kind === "planet") !== (pass === "planet") || seen.has(object.designation)) continue;
        const v = visibility(object, tonight);
        if (v?.visible) {
          seen.add(object.designation);
          out.push({ item, object, visibility: v });
        }
      }
    }
    if (out.length > 0) break;
  }
  return out.slice(0, limit);
}

/** Articles recents qui citent une cible, pour sa fiche. */
export function mentionsOf(items: NewsItem[], target: TargetKey, now: Date): NewsItem[] {
  return items.filter((i) => recent(i, now) && i.objects.some((o) => sameTarget(o, target)));
}

/** Designations des cibles citees recemment, pour le badge du plan de nuit. */
export function inTheNews(items: NewsItem[], rows: TargetRow[], now: Date): Set<string> {
  const out = new Set<string>();
  for (const r of rows) {
    if (items.some((i) => recent(i, now) && i.objects.some((o) => sameTarget(o, r)))) out.add(r.designation);
  }
  return out;
}

// Derniere lecture de l'ecran Actus : les articles parus depuis sont
// « nouveaux ».
const SEEN_KEY = "news:seen";

export function newsSeenAt(): string | null {
  return readText(SEEN_KEY);
}

export function markNewsSeen(now: Date = new Date()): void {
  writeText(SEEN_KEY, now.toISOString());
}

export function isNew(item: NewsItem, since: string | null): boolean {
  return Boolean(since && item.date && item.date > since);
}

/** Un objet cite est visible ce soir. */
export function visibleTonight(item: NewsItem, t: Tonight): boolean {
  return item.objects.some((o) => visibility(o, t)?.visible);
}

/** Ordre de lecture : d'abord ce qui se voit ce soir, puis le reste a
 * observer, puis la science et l'espace ; par date dans chaque groupe. */
export function orderForTonight(items: NewsItem[], t: Tonight): NewsItem[] {
  const rank = (i: NewsItem) => (i.kind !== "observer" ? 2 : visibleTonight(i, t) ? 0 : 1);
  return [...items].sort((a, b) => rank(a) - rank(b) || ((b.date ?? "") > (a.date ?? "") ? 1 : (b.date ?? "") < (a.date ?? "") ? -1 : 0));
}

/** « il y a 2 h », « il y a 5 min », « à l'instant ». */
export function sinceLabel(iso: string, now: Date): string {
  const min = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
  if (min < 2) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  return `il y a ${Math.round(min / 60)} h`;
}
