import { useState } from "react";
import { planNight } from "../nightPlan";
import { mutate } from "../useSessions";
import { newOp } from "../sessionQueue";
import { tap } from "../haptics";
import type { TargetRow } from "../types";

/** Enchainement suggere pour la nuit (voir nightPlan.ts), avec un geste
 * pour tout poser dans le journal avant de partir. */
export function NightPlan({ rows, onOpenTarget }: { rows: TargetRow[]; onOpenTarget: (d: string) => void }) {
  const plan = planNight(rows);
  const [added, setAdded] = useState(false);
  if (plan.length === 0) return null;
  const byDesignation = new Map(rows.map((r) => [r.designation, r]));

  const addAll = () => {
    // Par la file du journal, comme tout ajout : pris en compte tout de
    // suite, meme hors ligne (voir sessionQueue.ts).
    plan.forEach((b) => mutate(newOp({ kind: "addItem", designation: b.designation })));
    tap();
    setAdded(true);
  };

  return (
    <div className="nc-card nc-stack">
      <div className="nc-row nc-between nc-baseline">
        <div className="nc-eyebrow">Plan de la nuit</div>
        <span className="nc-caption">suggestion, d'après les créneaux</span>
      </div>
      <div className="nc-stack-xs">
        {plan.map((b) => {
          const row = byDesignation.get(b.designation);
          return (
            <button key={b.designation} onClick={() => onOpenTarget(b.designation)} className="nc-plan-row">
              <span className="nc-num nc-none" style={{ fontSize: "var(--text-sm)" }}>
                {b.start}–{b.end}
              </span>
              <span className="nc-num nc-none" style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>
                {b.designation}
              </span>
              <span className="nc-grow nc-ellipsis nc-caption" style={{ margin: 0 }}>
                {row?.commonName || row?.type}
              </span>
            </button>
          );
        })}
      </div>
      <button onClick={addAll} disabled={added} className="nc-btn">
        {added ? "Ajoutées au journal ✓" : "Tout ajouter au journal"}
      </button>
    </div>
  );
}
