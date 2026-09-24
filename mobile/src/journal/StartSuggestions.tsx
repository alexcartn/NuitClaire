import { readCache } from "../storage";
import { tap } from "../haptics";
import type { SessionOpBody } from "../sessionQueue";
import type { TargetRow } from "../types";

/** Etat vide du journal : plutot qu'une phrase, les trois premieres cibles
 * de ce soir, a ajouter d'un appui. Lues dans la copie locale de la liste
 * « Cibles » (aucune requete, marche hors ligne) ; rien n'est affiche si
 * elle n'a jamais ete chargee -- on ne propose pas de cibles inventees. */
export function StartSuggestions({ send, onOpenTarget }: {
  send: (body: SessionOpBody) => void;
  onOpenTarget: (designation: string) => void;
}) {
  const rows = (readCache<TargetRow[]>("targets") ?? []).filter((r) => r.start && r.end).slice(0, 3);
  return (
    <div className="nc-card nc-stack">
      <div className="nc-eyebrow">Pas encore de session</div>
      <p className="nc-caption" style={{ margin: 0 }}>
        Elle s'ouvre à la première cible ou note ajoutée.
        {rows.length > 0 && " Pour commencer, les premières cibles de ce soir :"}
      </p>
      {rows.map((r) => (
        <div key={r.designation} className="nc-row">
          <span className="nc-num nc-none" style={{ fontSize: "var(--text-sm)" }}>
            {r.start}–{r.end}
          </span>
          <button onClick={() => onOpenTarget(r.designation)} className="nc-link nc-num nc-none" style={{ fontSize: "var(--text-sm)", color: "var(--ink)", fontWeight: 500 }}>
            {r.designation}
          </button>
          <span className="nc-caption nc-grow nc-ellipsis">{r.commonName || r.type}</span>
          <button
            onClick={() => {
              send({ kind: "addItem", designation: r.designation });
              tap();
            }}
            className="nc-btn nc-btn-sm nc-none"
            aria-label={`Ajouter ${r.designation} à la session`}
          >
            Ajouter
          </button>
        </div>
      ))}
    </div>
  );
}
