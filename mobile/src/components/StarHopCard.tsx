import { useCallback } from "react";
import { api } from "../api";
import { useFetch } from "../useFetch";
import { fmtHM } from "../format";
import { StarHopChart } from "./StarHopChart";
import { ErrorNotice } from "./ErrorNotice";

/** « Comment le trouver aux jumelles » : la carte du chemin et les etapes en
 * clair. Chargee a part de la fiche, et gardee sur l'appareil : on la
 * consulte dehors, souvent sans reseau. */
export function StarHopCard({ designation }: { designation: string }) {
  const fetchHop = useCallback(() => api.starHop(designation), [designation]);
  const { data, loading, error, reload } = useFetch(fetchHop, [designation], `starhop:${designation}`);

  return (
    <div className="nc-card nc-stack">
      <div className="nc-row nc-between nc-baseline">
        <div className="nc-eyebrow">Chemin d'étoiles</div>
        {data && <span className="nc-caption">champ de {String(data.fovDeg).replace(".", ",")}°</span>}
      </div>
      {loading && !data && <p className="nc-caption" style={{ margin: 0 }}>Calcul du chemin…</p>}
      {error && !data && <ErrorNotice message="Chemin indisponible pour l'instant." onRetry={reload} />}
      {data && (
        <>
          <StarHopChart hop={data} />
          <p className="nc-caption" style={{ margin: 0 }}>
            Orientée comme le ciel vers {fmtHM(data.time)}, zénith en haut. Un cercle = ce que montrent vos
            jumelles.
          </p>
          <ol className="nc-starhop-steps">
            {data.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          {data.nakedEye && (
            <p className="nc-caption" style={{ margin: 0 }}>
              Assez brillant pour se deviner à l'œil nu sous un ciel noir.
            </p>
          )}
        </>
      )}
    </div>
  );
}
