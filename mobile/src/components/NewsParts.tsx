import { useCallback } from "react";
import { api } from "../api";
import { useFetch } from "../useFetch";
import { isNew, visibility, type Tonight } from "../newsView";
import type { NewsItem } from "../types";

/** Morceaux communs de l'ecran Actus, de son apercu dans « Ce soir » et de
 * l'encart « Dans l'actu » des fiches. */

export function fmtNewsDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "aujourd'hui";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/** Cibles, planetes et cometes de ce soir, deja chargees ailleurs (memes
 * cles de cache) : de quoi dire si un objet cite est visible. */
export function useTonight(): Tonight {
  const targets = useFetch(useCallback(() => api.targets(), []), [], "targets");
  const planets = useFetch(useCallback(() => api.planetsTonight(), []), [], "extras-planets");
  const comets = useFetch(useCallback(() => api.comets(), []), [], "comets");
  return { targets: targets.data, planets: planets.data, comets: comets.data };
}

/** Les actualites, meme cle de cache partout. */
export function useNews() {
  return useFetch(useCallback(() => api.news(), []), [], "news");
}

export function ObjectChips({ item, tonight, onOpenTarget }: {
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
        // Les objets du catalogue et les planetes ont une fiche ; pas les
        // cometes.
        return o.kind !== "comet" ? (
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
export function SourceTile({ source }: { source: string }) {
  const letters = ({ "Ciel & Espace": "C&E", "Sky & Telescope": "S&T", Astronomy: "Ast" } as Record<string, string>)[source]
    ?? source.slice(0, 2);
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

export function NewsRow({ item, since, tonight, onOpenTarget }: {
  item: NewsItem;
  since: string | null;
  tonight: Tonight;
  onOpenTarget: (designation: string) => void;
}) {
  return (
    <div className="nc-row" style={{ gap: "var(--space-sm)", alignItems: "flex-start" }}>
      <a href={item.link} target="_blank" rel="noopener noreferrer" className="nc-none" tabIndex={-1} aria-hidden="true">
        {item.image ? (
          <img className="nc-news-img"
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
          {item.date ? ` · ${fmtNewsDate(item.date)}` : ""}
          {item.note ? ` · ${item.note}` : ""}
        </span>
      </span>
    </div>
  );
}

/** L'image du jour de la NASA en grand, en tete : en vignette de 64 px, elle
 * ne montrait rien. */
export function PictureOfTheDay({ item }: { item: NewsItem }) {
  if (!item.image) return null;
  return (
    <a href={item.link} target="_blank" rel="noopener noreferrer" className="nc-stack-xs" style={{ color: "var(--ink)", textDecoration: "none", gap: "var(--space-2xs)" }}>
      <img className="nc-news-img"
        src={item.image}
        alt={item.title}
        loading="lazy"
        style={{ width: "100%", aspectRatio: "16 / 10", objectFit: "cover", borderRadius: 14, background: "var(--line)", display: "block" }}
      />
      <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>{item.title}</span>
      <span className="nc-caption">Image du jour · NASA APOD{item.date ? ` · ${fmtNewsDate(item.date)}` : ""}</span>
    </a>
  );
}
