import { useState } from "react";
import { NightToggle } from "../components/NightToggle";
import { TabIcon } from "../components/TabIcon";
import { ConstellationFigure } from "../sky/ConstellationFigure";
import { engravingUrl, LEGENDS } from "../sky/legends";
import { CONSTELLATIONS } from "../sky/skyNames";

/** Legende d'une constellation : son trace, le recit (ou l'origine du nom
 * pour une constellation moderne) et une gravure ancienne. Ouvert depuis la
 * fiche d'une constellation sur la carte du ciel. Le trace et le texte sont
 * sur le telephone ; seule la gravure demande le reseau, et son absence se
 * dit au lieu de laisser un trou. */
export default function Legende({ id, onBack }: { id: string; onBack: () => void }) {
  const entry = CONSTELLATIONS.find((c) => c.id === id);
  const legend = LEGENDS[id];
  const [engravingFailed, setEngravingFailed] = useState(false);

  const header = (
    <div className="nc-row nc-between">
      <button onClick={onBack} className="nc-link nc-link-accent">
        <TabIcon name="back" />
        Retour
      </button>
      <NightToggle />
    </div>
  );

  if (!entry || !legend) {
    return (
      <div className="nc-screen">
        {header}
        <p className="nc-caption">Pas encore de légende pour cette constellation.</p>
      </div>
    );
  }

  const { engraving } = legend;
  return (
    <div className="nc-screen">
      {header}
      <div>
        <div className="nc-eyebrow">Constellation {legend.origin === "antique" ? "antique" : "moderne"}</div>
        <div className="nc-title" style={{ marginTop: "var(--space-2xs)" }}>{entry.name}</div>
        <div className="nc-sub">{legend.tagline}</div>
      </div>

      <ConstellationFigure id={id} title={entry.name} />

      <div className="nc-card nc-stack">
        <div className="nc-eyebrow">{legend.origin === "antique" ? "Légende" : "Origine"}</div>
        <div className="nc-legend-text nc-stack-xs">
          {legend.text.map((p) => <p key={p}>{p}</p>)}
        </div>
        <span className="nc-caption">{legend.source}</span>
      </div>

      {engraving && (
        <figure className="nc-legend-figure nc-stack-xs">
          {engravingFailed ? (
            <span className="nc-caption">La gravure se charge en ligne : elle n'est pas disponible pour l'instant.</span>
          ) : (
            <img
              src={engravingUrl(engraving.file)}
              alt={`Gravure ancienne de la constellation ${entry.name}`}
              width={engraving.width}
              height={engraving.height}
              loading="lazy"
              onError={() => setEngravingFailed(true)}
              className="nc-legend-engraving"
              style={{ aspectRatio: `${engraving.width} / ${engraving.height}` }}
            />
          )}
          <figcaption className="nc-caption">{engraving.credit} · Wikimedia Commons, domaine public</figcaption>
        </figure>
      )}
    </div>
  );
}
