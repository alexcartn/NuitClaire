import { useCallback } from "react";
import { api } from "../api";
import { useFetch } from "../useFetch";
import { useWatchMode } from "../useWatchMode";
import { ErrorNotice } from "./ErrorNotice";

/** « En attendant le Seestar » : quelques cibles faciles aux jumelles, ou a
 * l'oeil nu (le switch), bien placees maintenant (voir binocular_now.py).
 * Pas de suivi, pas de « vu » : de quoi patienter a cote du Seestar. Un
 * appui ouvre la fiche vue aux jumelles, avec son chemin d'etoiles et le
 * viseur. */
export function BinocularCard({ binocularsLabel, seestarTarget, onOpenTarget }: {
  /** « 10x50 » : change quand on modifie les jumelles dans Reglages, et
   * la liste avec. */
  binocularsLabel: string | undefined;
  /** La cible sur laquelle le Seestar pose, si une sortie est en cours. */
  seestarTarget: string | null;
  onOpenTarget: (designation: string) => void;
}) {
  const [mode, setMode] = useWatchMode();
  const eye = mode === "oeil";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchNow = useCallback(() => api.binocularsNow(mode), [binocularsLabel, mode]);
  const { data, error, reload } = useFetch(
    fetchNow,
    [binocularsLabel, mode],
    eye ? "binoculars-now:oeil" : `binoculars-now:${binocularsLabel ?? ""}`,
  );
  // Tant que la liste de l'autre mode n'est pas arrivee, ne pas montrer
  // des cibles de jumelles sous « a l'oeil nu ».
  const current = data && (data.binoculars.label === "œil nu") === eye ? data : null;

  const label = eye ? null : current?.binoculars.label ?? binocularsLabel;
  const how = eye ? "à l'œil nu" : "aux jumelles";
  return (
    <div className="nc-card nc-stack">
      <div className="nc-row nc-between nc-baseline">
        <div className="nc-eyebrow">En attendant le Seestar</div>
        {label && <span className="nc-caption">jumelles {label}</span>}
      </div>
      <div className="nc-segmented" role="radiogroup" aria-label="Regarder">
        {(["jumelles", "oeil"] as const).map((m) => (
          <button
            key={m}
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={mode === m ? "nc-segment nc-segment-active" : "nc-segment"}
          >
            {m === "jumelles" ? "Jumelles" : "Œil nu"}
          </button>
        ))}
      </div>
      <p className="nc-caption" style={{ margin: 0 }}>
        {seestarTarget
          ? `Le Seestar pose sur ${seestarTarget}. ${eye ? "À l'œil nu" : "Aux jumelles"}, pendant ce temps :`
          : current?.at === "à la nuit tombée"
            ? `À la nuit tombée, faciles ${how} :`
            : `Faciles ${how}, en ce moment :`}
      </p>
      {error && !current && <ErrorNotice message="Suggestions indisponibles pour l'instant." onRetry={reload} />}
      {current && current.picks.length === 0 && (
        <p className="nc-caption" style={{ margin: 0 }}>
          Rien de facile dans les secteurs dégagés pour l'instant. La Lune et les planètes, plus bas, restent à voir.
        </p>
      )}
      {eye && current && current.picks.length > 0 && (
        <p className="nc-caption" style={{ margin: 0 }}>
          Loin des lumières, après vingt minutes dans le noir : les plus pâles ne se devinent qu'en regardant à côté.
        </p>
      )}
      {current && current.picks.length > 0 && (
        <div className="nc-stack-xs">
          {current.picks.map((p) => (
            <button key={p.designation} onClick={() => onOpenTarget(p.designation)} className="nc-plan-row">
              <span className="nc-stack-xs nc-grow" style={{ gap: 0, minWidth: 0, textAlign: "left" }}>
                <span className="nc-ellipsis" style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>
                  <span className="nc-num">{p.designation}</span>
                  {p.name ? ` · ${p.name}` : ""}
                </span>
                <span className="nc-caption nc-ellipsis" style={{ margin: 0 }}>
                  {p.look}
                  {!eye && !p.fitsField && ", plus grand que le champ"}
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
