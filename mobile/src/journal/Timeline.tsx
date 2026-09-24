import { fmtHM } from "../format";
import { ContextLine } from "./Conditions";
import type { TimelineEntry } from "../types";

/** Fil chronologique d'une nuit : notes par cible et notes libres deja
 * fusionnees/triees (par le backend, ou localement tant qu'une saisie n'est
 * pas partie -- voir sessionQueue.applyOp) ; on se contente de les rendre
 * comme un carnet, sans reconstituer le tri ici. */
export function Timeline({ entries, pendingNotes, onDelete }: {
  entries: TimelineEntry[];
  pendingNotes?: Set<string>;
  onDelete?: (entry: TimelineEntry) => void;
}) {
  if (entries.length === 0) {
    return <p className="nc-caption" style={{ margin: 0 }}>Aucune note pour l'instant.</p>;
  }
  return (
    <div className="nc-stack-xs" style={{ gap: "var(--space-2xs)" }}>
      {entries.map((e) => (
        <div key={e.id} className="nc-row nc-baseline">
          <span className="nc-log-entry">
            <span className="nc-num">{fmtHM(e.at)}</span>
            {" · "}
            {e.target ? <span style={{ color: "var(--ink)", fontWeight: 500 }}>{e.target}</span> : "Note libre"}
            {" : "}
            {e.text}
            {pendingNotes?.has(e.id) && (
              <span style={{ color: "var(--ink3)", fontSize: "var(--text-xs)" }}> · en attente</span>
            )}
            <ContextLine context={e.context} />
          </span>
          {onDelete && (
            <button
              onClick={() => onDelete(e)}
              className="nc-icon-btn"
              title="Supprimer cette note"
              aria-label={`Supprimer la note de ${fmtHM(e.at)}`}
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
