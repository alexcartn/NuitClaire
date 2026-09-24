import { useState } from "react";
import { Rating } from "./Rating";
import type { Feeling } from "../types";

/** Ressenti d'une sortie cloturee, modifiable. On rentre rarement remplir
 * « ce que je retiens » avant d'avoir range le materiel : sans cela, la case
 * resterait vide pour toujours. Les deux champs libres n'apparaissent en
 * saisie qu'une fois la carte depliee, pour ne pas alourdir la liste. */
export function PastFeeling({ feeling, onChange }: {
  feeling: Feeling;
  onChange: (patch: Partial<Feeling>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Record<keyof Feeling, string>>>({});
  const scores = [
    feeling.rating != null ? `satisfaction ${feeling.rating}/5` : null,
    feeling.skyQuality != null ? `ciel perçu ${feeling.skyQuality}/5` : null,
  ].filter(Boolean);

  return (
    <div className="nc-stack-xs" style={{ gap: "var(--space-2xs)" }}>
      {scores.length > 0 && (
        <div className="nc-num" style={{ fontSize: "var(--text-xs)", color: "var(--ink2)" }}>{scores.join(" · ")}</div>
      )}
      {feeling.highlight && (
        <div className="nc-caption">Je retiens : {feeling.highlight}</div>
      )}
      {feeling.nextTime && (
        <div className="nc-caption">À refaire autrement : {feeling.nextTime}</div>
      )}
      <button onClick={() => setOpen((v) => !v)} className="nc-link" aria-expanded={open}>
        {open ? "Masquer le ressenti" : scores.length || feeling.highlight || feeling.nextTime
          ? "Modifier le ressenti"
          : "Ajouter un ressenti"}
      </button>
      {open && (
        <div className="nc-stack-xs">
          <Rating
            label="Satisfaction"
            scope="de cette sortie"
            value={feeling.rating}
            onChange={(rating) => onChange({ rating })}
          />
          <Rating
            label="Ciel perçu"
            scope="cette nuit-là"
            value={feeling.skyQuality}
            onChange={(skyQuality) => onChange({ skyQuality })}
          />
          <input
            value={draft.highlight ?? feeling.highlight}
            onChange={(e) => setDraft((d) => ({ ...d, highlight: e.target.value }))}
            onBlur={(e) => e.target.value !== feeling.highlight && onChange({ highlight: e.target.value })}
            placeholder="Ce que je retiens"
            aria-label="Ce que je retiens"
            className="nc-input"
          />
          <input
            value={draft.nextTime ?? feeling.nextTime}
            onChange={(e) => setDraft((d) => ({ ...d, nextTime: e.target.value }))}
            onBlur={(e) => e.target.value !== feeling.nextTime && onChange({ nextTime: e.target.value })}
            placeholder="À refaire autrement"
            aria-label="À refaire autrement"
            className="nc-input"
          />
        </div>
      )}
    </div>
  );
}
