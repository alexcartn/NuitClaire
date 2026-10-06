import { useState } from "react";
import { newOp } from "../sessionQueue";
import { mutate } from "../useSessions";
import { tap } from "../haptics";
import type { TargetRow } from "../types";

/** Une cible dans la liste « Cibles », en 72 px : le creneau d'abord (c'est
 * lui qui decide), puis la designation et le nom, puis le type et les deux
 * angles. La vignette n'y figure plus -- elle est dans la fiche, et la liste
 * affichait un aplat vide des qu'elle ne chargeait pas. Le badge « A FAIRE »
 * a disparu aussi : le titre du groupe (« Messier a capturer ») le dit deja
 * sur chaque ligne. L'accent reste pour les vraies actions. */
export function TargetRowCompact({ row, onOpen }: { row: TargetRow; onOpen: () => void }) {
  const [added, setAdded] = useState(false);
  const feasible = Boolean(row.start && row.end);
  const name = row.commonName || (row.ngc && row.ngc !== row.designation ? row.ngc : "");

  const add = () => {
    // Par la file du journal, comme tout ajout : pris en compte tout de
    // suite, meme hors ligne (voir sessionQueue.ts).
    mutate(newOp({ kind: "addItem", designation: row.designation }));
    tap();
    setAdded(true);
  };

  return (
    <div className="nc-trow">
      <div className="nc-trow-time nc-num">
        {feasible ? (
          <>
            <span>{row.start}</span>
            <span style={{ color: "var(--ink2)" }}>{row.end}</span>
          </>
        ) : (
          <span style={{ color: "var(--ink2)" }}>–</span>
        )}
      </div>
      <button onClick={onOpen} className="nc-trow-main">
        <span className="nc-row" style={{ alignItems: "baseline", gap: "var(--space-xs)", minWidth: 0 }}>
          <span className="nc-num nc-none" style={{ fontSize: "var(--text-md)", fontWeight: 600 }}>{row.designation}</span>
          {name && <span className="nc-ellipsis" style={{ fontSize: "var(--text-sm)", color: "var(--ink2)" }}>{name}</span>}
        </span>
        <span className="nc-ellipsis nc-num" style={{ fontSize: "var(--text-xs)", color: "var(--ink2)" }}>
          {feasible
            ? `alt ${Math.round(row.altMaxDeg)}° · lune ${Math.round(row.moonSepDeg)}° · ${row.type}`
            : `infaisable ce soir · ${row.type}`}
        </span>
      </button>
      <button
        onClick={add}
        disabled={added}
        className="nc-trow-add"
        aria-label={added ? `${row.designation} ajoutée au journal` : `Ajouter ${row.designation} au journal`}
      >
        {added ? "✓" : "+"}
      </button>
    </div>
  );
}
