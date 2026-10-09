import { useEffect, useState } from "react";
import { NightToggle } from "../components/NightToggle";
import { TabIcon } from "../components/TabIcon";
import { NewsRow, PictureOfTheDay, useNews, useTonight } from "../components/NewsParts";
import { SkyAgenda } from "../components/SkyAgenda";
import { api } from "../api";
import { markNewsSeen, newsSeenAt, orderForTonight, sinceLabel, visibleTonight } from "../newsView";

type Filter = "tout" | "ce-soir" | "observer" | "espace";

/** Actualites astro en pleine page : Ciel & Espace, le forum Webastro
 * « L'actualite du ciel », Sky & Telescope, Astronomy et l'image du jour
 * de la NASA (voir news.py).
 * Ouvert depuis l'apercu de « Ce soir », comme la carte du ciel. */
export function Actus({ onOpenTarget, onBack }: {
  onOpenTarget: (designation: string) => void;
  onBack: () => void;
}) {
  const { data, error, reload } = useNews();
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    try {
      // Le serveur relit les flux (au plus une fois par 10 min), puis
      // l'ecran recharge sa copie.
      await api.news(true);
      reload();
    } finally {
      setRefreshing(false);
    }
  };
  const tonight = useTonight();
  const [filter, setFilter] = useState<Filter>("tout");
  // Derniere lecture, lue avant d'etre remplacee : les points « nouveau »
  // restent pendant qu'on lit, et s'effacent a la prochaine visite.
  const [since] = useState(newsSeenAt);
  useEffect(() => markNewsSeen(), []);

  const items = data?.items ?? [];
  const picture = items.find((i) => i.kind === "image");
  const articles = items.filter((i) => i.kind !== "image");
  // Ce qui se voit ce soir d'abord, puis le reste a observer, puis la
  // science ; par date dans chaque groupe.
  const ordered = orderForTonight(articles, tonight);
  const pick = (f: Filter) =>
    f === "tout" ? ordered
      : f === "ce-soir" ? ordered.filter((i) => visibleTonight(i, tonight))
        : ordered.filter((i) => i.kind === f);
  const shown = pick(filter);
  const count = (f: Filter) => pick(f).length;

  return (
    <div className="nc-screen nc-screen-narrow">
      <div className="nc-row nc-between">
        <button onClick={onBack} className="nc-link nc-link-accent">
          <TabIcon name="back" />
          Retour
        </button>
        <NightToggle />
      </div>
      <div>
        <div className="nc-eyebrow">Ciel &amp; Espace · Webastro · Sky &amp; Telescope · Astronomy</div>
        <div className="nc-title" style={{ marginTop: "var(--space-2xs)" }}>Actualités</div>
        {data?.fetchedAt && (
          <div className="nc-row" style={{ gap: "var(--space-xs)" }}>
            <span className="nc-caption">Mis à jour {sinceLabel(data.fetchedAt, new Date())}</span>
            <button onClick={() => void refresh()} disabled={refreshing} className="nc-link nc-link-accent" style={{ minHeight: 36 }}>
              {refreshing ? "Actualisation…" : "Actualiser"}
            </button>
          </div>
        )}
      </div>

      <SkyAgenda />

      {!data && <p className="nc-caption">{error ? "Actualités injoignables." : "Chargement…"}</p>}
      {data && (
        <>
          <div className="nc-row nc-hscroll" style={{ gap: "var(--space-xs)" }} role="radiogroup" aria-label="Filtre">
            {([["tout", "Tout"], ["ce-soir", "Visible ce soir"], ["observer", "À observer"], ["espace", "Science & espace"]] as const).map(([f, label]) => (
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
