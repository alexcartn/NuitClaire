import { useEffect, useState } from "react";
import { NightToggle } from "../components/NightToggle";
import { TabIcon } from "../components/TabIcon";
import { NewsRow, PictureOfTheDay, useNews, useTonight } from "../components/NewsParts";
import { markNewsSeen, newsSeenAt } from "../newsView";

type Filter = "tout" | "observer" | "espace";

/** Actualites astro en pleine page : Ciel & Espace, le forum Webastro
 * « L'actualite du ciel » et l'image du jour de la NASA (voir news.py).
 * Ouvert depuis l'apercu de « Ce soir », comme la carte du ciel. */
export function Actus({ onOpenTarget, onBack }: {
  onOpenTarget: (designation: string) => void;
  onBack: () => void;
}) {
  const { data, error } = useNews();
  const tonight = useTonight();
  const [filter, setFilter] = useState<Filter>("tout");
  // Derniere lecture, lue avant d'etre remplacee : les points « nouveau »
  // restent pendant qu'on lit, et s'effacent a la prochaine visite.
  const [since] = useState(newsSeenAt);
  useEffect(() => markNewsSeen(), []);

  const items = data?.items ?? [];
  const picture = items.find((i) => i.kind === "image");
  const articles = items.filter((i) => i.kind !== "image");
  // A observer en tete ; l'ordre des dates est garde dans chaque groupe.
  const shown =
    filter === "tout"
      ? [...articles.filter((i) => i.kind === "observer"), ...articles.filter((i) => i.kind !== "observer")]
      : articles.filter((i) => i.kind === filter);
  const count = (f: Filter) => (f === "tout" ? articles.length : articles.filter((i) => i.kind === f).length);

  return (
    <div className="nc-screen">
      <div className="nc-row nc-between">
        <button onClick={onBack} className="nc-link nc-link-accent">
          <TabIcon name="back" />
          Retour
        </button>
        <NightToggle />
      </div>
      <div>
        <div className="nc-eyebrow">Ciel &amp; Espace · Webastro · NASA</div>
        <div className="nc-title" style={{ marginTop: "var(--space-2xs)" }}>Actualités</div>
      </div>

      {!data && <p className="nc-caption">{error ? "Actualités injoignables." : "Chargement…"}</p>}
      {data && (
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
          <div className="nc-stack">
            {shown.map((n) => (
              <NewsRow key={n.link} item={n} since={since} tonight={tonight} onOpenTarget={onOpenTarget} />
            ))}
          </div>
          {shown.length === 0 && <p className="nc-caption" style={{ margin: 0 }}>Rien dans cette rubrique pour l'instant.</p>}
          {data.missing.length > 0 && (
            <p className="nc-caption" style={{ margin: 0 }}>Injoignable pour l'instant : {data.missing.join(", ")}.</p>
          )}
        </>
      )}
    </div>
  );
}
