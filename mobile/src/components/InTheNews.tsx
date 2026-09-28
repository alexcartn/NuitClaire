import { mentionsOf } from "../newsView";
import { fmtNewsDate, useNews } from "./NewsParts";

/** « Dans l'actu » sur la fiche d'un objet : les articles recents qui le
 * citent (une supernova dans NGC 7331, par exemple). Rien s'il n'y en a pas. */
export function InTheNews({ designation, ngc, messierId }: {
  designation: string;
  ngc: string | null;
  messierId: string | null;
}) {
  const { data } = useNews();
  const items = data ? mentionsOf(data.items, { designation, ngc, messierId }, new Date()) : [];
  if (items.length === 0) return null;
  return (
    <div className="nc-card nc-stack-xs">
      <div className="nc-eyebrow">Dans l'actu</div>
      {items.slice(0, 3).map((i) => (
        <a key={i.link} href={i.link} target="_blank" rel="noopener noreferrer" className="nc-stack-xs"
          style={{ gap: 2, color: "var(--ink)", textDecoration: "none" }}>
          <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, lineHeight: 1.3 }}>{i.title} ›</span>
          <span className="nc-caption">{i.source}{i.date ? ` · ${fmtNewsDate(i.date)}` : ""}</span>
        </a>
      ))}
    </div>
  );
}
