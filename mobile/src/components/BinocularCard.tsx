import { useCallback } from "react";
import { api } from "../api";
import { useFetch } from "../useFetch";
import { ErrorNotice } from "./ErrorNotice";

/** « En attendant le Seestar » : quelques cibles faciles aux jumelles, bien
 * placees maintenant (voir binocular_now.py). Pas de suivi, pas de « vu » :
 * de quoi patienter a cote du Seestar. Un appui ouvre la fiche vue aux
 * jumelles, avec son chemin d'etoiles et le viseur. */
export function BinocularCard({ binocularsLabel, seestarTarget, onOpenTarget }: {
  /** « 10x50 » : change quand on modifie les jumelles dans Reglages, et
   * la liste avec. */
  binocularsLabel: string | undefined;
  /** La cible sur laquelle le Seestar pose, si une sortie est en cours. */
  seestarTarget: string | null;
  onOpenTarget: (designation: string) => void;
}) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchNow = useCallback(() => api.binocularsNow(), [binocularsLabel]);
  const { data, error, reload } = useFetch(fetchNow, [binocularsLabel], `binoculars-now:${binocularsLabel ?? ""}`);

  const label = data?.binoculars.label ?? binocularsLabel;
  return (
    <div className="nc-card nc-stack">
      <div className="nc-row nc-between nc-baseline">
        <div className="nc-eyebrow">En attendant le Seestar</div>
        {label && <span className="nc-caption">jumelles {label}</span>}
      </div>
      <p className="nc-caption" style={{ margin: 0 }}>
        {seestarTarget
          ? `Le Seestar pose sur ${seestarTarget}. Aux jumelles, pendant ce temps :`
          : data?.at === "à la nuit tombée"
            ? "À la nuit tombée, faciles aux jumelles :"
            : "Faciles aux jumelles, en ce moment :"}
      </p>
      {error && !data && <ErrorNotice message="Suggestions indisponibles pour l'instant." onRetry={reload} />}
      {data && data.picks.length === 0 && (
        <p className="nc-caption" style={{ margin: 0 }}>
          Rien de facile dans les secteurs dégagés pour l'instant. La Lune et les planètes, plus bas, restent à voir.
        </p>
      )}
      {data && data.picks.length > 0 && (
        <div className="nc-stack-xs">
          {data.picks.map((p) => (
            <button key={p.designation} onClick={() => onOpenTarget(p.designation)} className="nc-plan-row">
              <span className="nc-stack-xs nc-grow" style={{ gap: 0, minWidth: 0, textAlign: "left" }}>
                <span className="nc-ellipsis" style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>
                  <span className="nc-num">{p.designation}</span>
                  {p.name ? ` · ${p.name}` : ""}
                </span>
                <span className="nc-caption nc-ellipsis" style={{ margin: 0 }}>
                  {p.look}
                  {!p.fitsField && ", plus grand que le champ"}
                </span>
              </span>
              <span className="nc-num nc-caption nc-none" style={{ margin: 0, textAlign: "right" }}>
                {p.sector} {p.altDeg}° {p.rising ? "↑" : "↓"}
                <br />
                mag {String(p.mag).replace(".", ",")}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
