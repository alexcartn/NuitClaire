import { isNew, mustSee, newsSeenAt } from "../newsView";
import { plural } from "../format";
import { fmtNewsDate, useNews, useTonight } from "./NewsParts";

/** « À ne pas manquer » : une actu recente parle d'un objet visible cette
 * nuit. N'apparait que dans ce cas, donc rarement, et c'est la qu'elle
 * compte. */
export function MustSeeCard({ onOpenTarget }: { onOpenTarget: (designation: string) => void }) {
  const { data } = useNews();
  const tonight = useTonight();
  const picks = data ? mustSee(data.items, tonight, new Date()) : [];
  if (picks.length === 0) return null;
  return (
    <div className="nc-card nc-stack-xs" style={{ borderColor: "var(--accent)" }}>
      <div className="nc-eyebrow" style={{ color: "var(--accent)" }}>À ne pas manquer</div>
      {picks.map(({ item, object, visibility }) => {
        const open = object.kind === "target" ? () => onOpenTarget(object.designation) : undefined;
        return (
          <div key={object.designation} className="nc-stack-xs" style={{ gap: "var(--space-2xs)" }}>
            <a href={item.link} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--ink)", textDecoration: "none", lineHeight: 1.3 }}>
              {item.title}
            </a>
            <div className="nc-row nc-between" style={{ gap: "var(--space-xs)" }}>
              <span className="nc-caption">{item.source}{item.date ? ` · ${fmtNewsDate(item.date)}` : ""}</span>
              {open ? (
                <button onClick={open} className="nc-link nc-link-accent nc-none" style={{ minHeight: 36 }}>
                  <span className="nc-num">{object.label}</span> · {visibility.text} ›
                </button>
              ) : (
                <span className="nc-caption nc-none" style={{ color: "var(--good)" }}>
                  <span className="nc-num">{object.label}</span> · {visibility.text}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Apercu des actualites dans « Ce soir » : l'image du jour, le titre a
 * observer le plus recent, le nombre de nouveautes ; un appui ouvre l'ecran
 * Actus. */
export function NewsTeaser({ onOpen }: { onOpen: () => void }) {
  const { data } = useNews();
  if (!data || data.items.length === 0) return null;
  const since = newsSeenAt();
  const fresh = data.items.filter((i) => isNew(i, since)).length;
  const picture = data.items.find((i) => i.kind === "image");
  const headline = data.items.find((i) => i.kind === "observer") ?? data.items.find((i) => i.kind !== "image");
  return (
    <button
      onClick={onOpen}
      className="nc-card nc-row"
      style={{ gap: "var(--space-sm)", alignItems: "center", textAlign: "left", cursor: "pointer", color: "var(--ink)", width: "100%" }}
    >
      {picture?.image && (
        <img src={picture.image} alt="" loading="lazy" className="nc-none nc-news-img"
          style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 10, background: "var(--line)" }} />
      )}
      <span className="nc-stack-xs nc-grow" style={{ gap: "var(--space-2xs)", minWidth: 0 }}>
        <span className="nc-row nc-between">
          <span className="nc-eyebrow">Actualités</span>
          {fresh > 0 && (
            <span className="nc-num" style={{ fontSize: "var(--text-xs)", color: "var(--accent)", fontWeight: 600 }}>
              {plural(fresh, "nouvelle", "nouvelles")}
            </span>
          )}
        </span>
        {headline && (
          <span style={{
            fontSize: "var(--text-sm)", fontWeight: 600, lineHeight: 1.3,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>
            {headline.title}
          </span>
        )}
        <span className="nc-caption">Ciel &amp; Espace · Webastro · image du jour</span>
      </span>
      <span aria-hidden="true" className="nc-none" style={{ fontSize: "var(--text-md)", color: "var(--ink3)" }}>›</span>
    </button>
  );
}
