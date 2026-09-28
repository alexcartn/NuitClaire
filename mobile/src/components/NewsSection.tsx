import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { useFetch } from "../useFetch";
import { fmtHM, plural } from "../format";
import { readText, writeText } from "../storage";
import { Section } from "./Section";
import type { CometsInfo, NewsItem, NewsObject, TargetRow } from "../types";
import type { PlanetTonight } from "../sky/types";

const SEEN_KEY = "news:seen";

type Filter = "tout" | "observer" | "espace";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "aujourd'hui";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function isNew(item: NewsItem, since: string | null): boolean {
  return Boolean(since && item.date && item.date > since);
}

/** Ce que l'appli sait deja de ce soir : de quoi dire si un objet cite est
 * visible, sans nouveau calcul. */
interface Tonight {
  targets: TargetRow[] | null;
  planets: PlanetTonight[] | null;
  comets: CometsInfo | null;
}

/** « visible 21:30–03:00 », « pas pointable ce soir », ou rien quand on ne
 * sait pas (Neptune, que l'appli ne calcule pas ; donnees pas encore la). */
function visibility(o: NewsObject, t: Tonight): { text: string; visible: boolean } | null {
  if (o.kind === "target") {
    if (!t.targets) return null;
    const row = t.targets.find(
      (r) => r.designation === o.designation || (o.ngc && r.ngc === o.ngc) || (o.messier && r.messierId === o.messier),
    );
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

function ObjectChips({ item, tonight, onOpenTarget }: {
  item: NewsItem;
  tonight: Tonight;
  onOpenTarget: (designation: string) => void;
}) {
  if (item.objects.length === 0) return null;
  return (
    <span className="nc-row nc-wrap" style={{ gap: "var(--space-2xs)" }}>
      {item.objects.map((o) => {
        const v = visibility(o, tonight);
        const content = (
          <>
            <span className="nc-num" style={{ fontWeight: 600 }}>{o.label}</span>
            {v && <span style={{ color: v.visible ? "var(--good)" : "var(--ink3)" }}> · {v.text}</span>}
          </>
        );
        const style = {
          display: "inline-flex", alignItems: "center", gap: 2, padding: "4px 10px", borderRadius: 14,
          border: "1px solid var(--line)", background: "var(--surf)", color: "var(--ink)",
          fontSize: "var(--text-xs)", minHeight: 32,
        } as const;
        // Seuls les objets du catalogue ont une fiche.
        return o.kind === "target" ? (
          <button key={o.designation} onClick={() => onOpenTarget(o.designation)} style={{ ...style, cursor: "pointer" }}>
            {content}
            <span aria-hidden="true" style={{ color: "var(--ink3)", marginLeft: 2 }}>›</span>
          </button>
        ) : (
          <span key={o.designation} style={style}>{content}</span>
        );
      })}
    </span>
  );
}

/** Pastille de la source quand l'article n'a pas d'image : un carre gris
 * a chaque ligne n'apprenait rien. */
function SourceTile({ source }: { source: string }) {
  const letters = source === "Ciel & Espace" ? "C&E" : source.slice(0, 2);
  return (
    <span
      className="nc-none nc-num"
      aria-hidden="true"
      style={{
        width: 64, height: 64, borderRadius: 10, display: "grid", placeItems: "center",
        background: "var(--surf)", border: "1px solid var(--line)", color: "var(--accent)",
        fontSize: "var(--text-sm)", fontWeight: 600,
      }}
    >
      {letters}
    </span>
  );
}

function NewsRow({ item, since, tonight, onOpenTarget }: {
  item: NewsItem;
  since: string | null;
  tonight: Tonight;
  onOpenTarget: (designation: string) => void;
}) {
  return (
    <div className="nc-row" style={{ gap: "var(--space-sm)", alignItems: "flex-start" }}>
      <a href={item.link} target="_blank" rel="noopener noreferrer" className="nc-none" tabIndex={-1} aria-hidden="true">
        {item.image ? (
          <img
            src={item.image}
            alt=""
            loading="lazy"
            style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 10, background: "var(--line)", display: "block" }}
          />
        ) : (
          <SourceTile source={item.source} />
        )}
      </a>
      <span className="nc-stack-xs nc-grow" style={{ gap: "var(--space-2xs)", minWidth: 0 }}>
        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: "var(--text-sm)", fontWeight: 600, lineHeight: 1.3, color: "var(--ink)", textDecoration: "none" }}
        >
          {isNew(item, since) && (
            <span
              aria-label="nouveau"
              style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: "var(--accent)", marginRight: 6, verticalAlign: "middle" }}
            />
          )}
          {item.title}
        </a>
        {item.summary && (
          <span
            style={{
              fontSize: "var(--text-xs)", color: "var(--ink2)", lineHeight: 1.35,
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
            }}
          >
            {item.summary}
          </span>
        )}
        <ObjectChips item={item} tonight={tonight} onOpenTarget={onOpenTarget} />
        <span className="nc-caption">
          {item.kind === "observer" && <span style={{ color: "var(--accent)", fontWeight: 600 }}>À observer · </span>}
          {item.source}
          {item.date ? ` · ${fmtDate(item.date)}` : ""}
        </span>
      </span>
    </div>
  );
}

/** L'image du jour de la NASA en grand, en tete : en vignette de 64 px, elle
 * ne montrait rien. */
function PictureOfTheDay({ item }: { item: NewsItem }) {
  if (!item.image) return null;
  return (
    <a href={item.link} target="_blank" rel="noopener noreferrer" className="nc-stack-xs" style={{ color: "var(--ink)", textDecoration: "none", gap: "var(--space-2xs)" }}>
      <img
        src={item.image}
        alt={item.title}
        loading="lazy"
        style={{ width: "100%", aspectRatio: "16 / 10", objectFit: "cover", borderRadius: 14, background: "var(--line)", display: "block" }}
      />
      <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>{item.title}</span>
      <span className="nc-caption">Image du jour · NASA APOD{item.date ? ` · ${fmtDate(item.date)}` : ""}</span>
    </a>
  );
}

/** Le contenu de la section ouverte. Son ouverture vaut lecture : l'heure
 * est retenue, et les points « nouveau » visibles maintenant restent
 * jusqu'a la prochaine fois. */
function NewsList({ items, missing, since, onOpened, onOpenTarget }: {
  items: NewsItem[];
  missing: string[];
  since: string | null;
  onOpened: () => void;
  onOpenTarget: (designation: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>("tout");
  useEffect(onOpened, [onOpened]);
  const targets = useFetch(useCallback(() => api.targets(), []), [], "targets");
  const planets = useFetch(useCallback(() => api.planetsTonight(), []), [], "extras-planets");
  const comets = useFetch(useCallback(() => api.comets(), []), [], "comets");
  const tonight: Tonight = { targets: targets.data, planets: planets.data, comets: comets.data };

  const picture = items.find((i) => i.kind === "image");
  const articles = items.filter((i) => i.kind !== "image");
  // A observer en tete ; l'ordre des dates est garde dans chaque groupe.
  const shown =
    filter === "tout"
      ? [...articles.filter((i) => i.kind === "observer"), ...articles.filter((i) => i.kind !== "observer")]
      : articles.filter((i) => i.kind === filter);
  const count = (f: Filter) => (f === "tout" ? articles.length : articles.filter((i) => i.kind === f).length);

  return (
    <>
      <div className="nc-row nc-wrap" style={{ gap: "var(--space-xs)" }} role="radiogroup" aria-label="Filtre">
        {([["tout", "Tout"], ["observer", "À observer"], ["espace", "Espace"]] as const).map(([f, label]) => (
          <button
            key={f}
            role="radio"
            aria-checked={filter === f}
            onClick={() => setFilter(f)}
            className={`nc-chip nc-none ${filter === f ? "nc-chip-active" : ""}`}
          >
            {label} <span className="nc-num" style={{ opacity: 0.7, marginLeft: 4 }}>{count(f)}</span>
          </button>
        ))}
      </div>
      {filter === "tout" && picture && <PictureOfTheDay item={picture} />}
      {shown.map((n) => (
        <NewsRow key={n.link} item={n} since={since} tonight={tonight} onOpenTarget={onOpenTarget} />
      ))}
      {shown.length === 0 && <p className="nc-caption" style={{ margin: 0 }}>Rien dans cette rubrique pour l'instant.</p>}
      {missing.length > 0 && (
        <p className="nc-caption" style={{ margin: 0 }}>Injoignable pour l'instant : {missing.join(", ")}.</p>
      )}
    </>
  );
}

/** Actualites astro : Ciel & Espace, le forum Webastro « L'actualite du
 * ciel » et l'image du jour de la NASA (voir news.py). Chargees meme
 * section repliee, pour annoncer les nouveautes dans l'en-tete. */
export function NewsSection({ onOpenTarget }: { onOpenTarget: (designation: string) => void }) {
  const fetchNews = useCallback(() => api.news(), []);
  const { data, error } = useFetch(fetchNews, [], "news");
  // Derniere lecture : lue une fois, pour que les points « nouveau » ne
  // s'effacent pas pendant qu'on lit.
  const [since] = useState<string | null>(() => readText(SEEN_KEY));
  const [readNow, setReadNow] = useState(false);
  const onOpened = useCallback(() => {
    writeText(SEEN_KEY, new Date().toISOString());
    setReadNow(true);
  }, []);
  const fresh = data && !readNow ? data.items.filter((i) => isNew(i, since)).length : 0;
  return (
    <Section
      id="soir-actus"
      title="Actualités"
      summary={fresh ? plural(fresh, "nouvelle", "nouvelles") : "Ciel & Espace · Webastro · APOD"}
      defaultOpen={false}
    >
      {data ? (
        <NewsList items={data.items} missing={data.missing} since={since} onOpened={onOpened} onOpenTarget={onOpenTarget} />
      ) : (
        <p className="nc-caption" style={{ margin: 0 }}>{error ? "Actualités injoignables." : "Chargement…"}</p>
      )}
    </Section>
  );
}
