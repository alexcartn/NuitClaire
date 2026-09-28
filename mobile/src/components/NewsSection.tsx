import { useCallback } from "react";
import { api } from "../api";
import { useFetch } from "../useFetch";
import { Section } from "./Section";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "aujourd'hui";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/** Le contenu, charge a l'ouverture seulement : une section repliee ne
 * doit rien couter au demarrage de l'ecran. */
function NewsList() {
  const fetchNews = useCallback(() => api.news(), []);
  const { data, error } = useFetch(fetchNews, [], "news");
  if (!data) return <p className="nc-caption" style={{ margin: 0 }}>{error ? "Actualités injoignables." : "Chargement…"}</p>;
  return (
    <>
      {data.items.map((n) => (
        <a
          key={n.link}
          href={n.link}
          target="_blank"
          rel="noopener noreferrer"
          className="nc-row"
          style={{ gap: "var(--space-sm)", alignItems: "flex-start", color: "var(--ink)", textDecoration: "none" }}
        >
          {n.image ? (
            <img
              src={n.image}
              alt=""
              loading="lazy"
              className="nc-none"
              style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 10, background: "var(--line)" }}
            />
          ) : (
            <span className="nc-none" style={{ width: 64, height: 64, borderRadius: 10, background: "var(--line)" }} />
          )}
          <span className="nc-stack-xs nc-grow" style={{ gap: "var(--space-2xs)", minWidth: 0 }}>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, lineHeight: 1.3 }}>{n.title}</span>
            {n.summary && (
              <span
                style={{
                  fontSize: "var(--text-xs)", color: "var(--ink2)", lineHeight: 1.35,
                  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                }}
              >
                {n.summary}
              </span>
            )}
            <span className="nc-caption">
              {n.source}
              {n.date ? ` · ${fmtDate(n.date)}` : ""}
            </span>
          </span>
        </a>
      ))}
      {data.missing.length > 0 && (
        <p className="nc-caption" style={{ margin: 0 }}>Injoignable pour l'instant : {data.missing.join(", ")}.</p>
      )}
    </>
  );
}

/** Actualites astro : Ciel & Espace, le forum Webastro « L'actualite du
 * ciel » et l'image du jour de la NASA (voir news.py). Un appui ouvre
 * l'article sur son site. */
export function NewsSection() {
  return (
    <Section id="soir-actus" title="Actualités" summary="Ciel & Espace · Webastro · APOD" defaultOpen={false}>
      <NewsList />
    </Section>
  );
}
