import { useCallback } from "react";
import { api } from "../api";
import { useFetch } from "../useFetch";
import { AltitudeChart } from "../components/AltitudeChart";

export function Detail({
  designation,
  captured,
  onBack,
}: {
  designation: string;
  captured: Set<string>;
  onBack: () => void;
}) {
  const fetchDetail = useCallback(() => api.targetDetail(designation), [designation]);
  const { data, loading, error } = useFetch(fetchDetail, [designation]);

  return (
    <div className="nc-screen">
      <button onClick={onBack} className="nc-caption" style={{ alignSelf: "flex-start", background: "none", border: "none", color: "var(--accent)", cursor: "pointer", padding: "4px 0" }}>
        ← Cibles
      </button>

      {loading && <p className="nc-caption">Chargement...</p>}
      {error && <p className="nc-caption">Objet introuvable.</p>}

      {data && (
        <>
          <div>
            <div className="nc-mono" style={{ fontSize: 30, fontWeight: 500, letterSpacing: "-.02em" }}>
              {data.designation}
            </div>
            {(data.commonName || (data.ngc && data.ngc !== data.designation)) && (
              <div className="nc-sub">
                {[data.commonName, data.ngc !== data.designation ? data.ngc : null].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>

          {data.imageUrl && (
            <img
              src={data.imageUrl}
              alt=""
              className="nc-strip"
              style={{ width: "100%", height: 200, borderRadius: 16, border: "1px solid var(--line)", objectFit: "cover", background: "var(--surf2)" }}
            />
          )}

          <div className="nc-card" style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div className="nc-eyebrow">Hauteur 19h → 06h</div>
              <div className="nc-mono" style={{ fontSize: 11, color: "var(--accent)" }}>
                fenetre pointable
              </div>
            </div>
            <AltitudeChart series={data.altitudeSeries} />
            <p style={{ margin: 0, fontSize: 11, color: "var(--ink2)" }}>
              Direction a l'altitude max : {data.peakSector} (azimut {Math.round(data.peakAz)}°) vers{" "}
              {new Date(data.peakTime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}.
            </p>
          </div>

          <div className="nc-card" style={{ padding: 0, overflow: "hidden" }}>
            {[
              ["Coordonnees", `${data.ra.toFixed(3)}h / ${data.dec.toFixed(3)}°`],
              ["Magnitude", data.mag != null ? data.mag.toFixed(1) : "inconnue"],
              ["Taille", data.sizeW && data.sizeH ? `${data.sizeW.toFixed(1)}' x ${data.sizeH.toFixed(1)}'` : "inconnue"],
              ["Cadrage Seestar", data.cadrage],
              ["Fenetre exploitable", data.start ? `${data.start}–${data.end} (${data.hours} h)` : "Aucune ce soir"],
              ["Filtre conseille", data.filter],
              ["Separation lunaire mini", `${Math.round(data.moonSepDeg)}°`],
              ["Temps de pose", `${data.exposureLowMin}–${data.exposureHighMin} min`],
            ].map(([k, v], i, arr) => (
              <div
                key={k}
                style={{
                  display: "flex", justifyContent: "space-between", gap: 14, padding: "13px 16px",
                  borderBottom: i < arr.length - 1 ? "1px solid var(--line)" : "none",
                }}
              >
                <div style={{ fontSize: 13, color: "var(--ink2)" }}>{k}</div>
                <div className="nc-mono" style={{ fontSize: 12, textAlign: "right" }}>
                  {v}
                </div>
              </div>
            ))}
          </div>

          {data.reasons.length > 0 && (
            <div className="nc-card" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div className="nc-eyebrow">Pourquoi infaisable ce soir</div>
              {data.reasons.map((r) => (
                <p key={r} style={{ margin: 0, fontSize: 13, color: "var(--ink2)" }}>
                  · {r}
                </p>
              ))}
            </div>
          )}

          {data.wiki && (
            <div className="nc-card" style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              <div className="nc-eyebrow">En savoir plus</div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "var(--ink2)" }}>{data.wiki.extract}</p>
              <a href={data.wiki.url} target="_blank" rel="noreferrer" className="nc-caption">
                Source : Wikipedia
              </a>
            </div>
          )}

          {data.messierId && (
            <div className="nc-caption">
              {captured.has(data.messierId) ? "Deja marquee comme capturee." : "Pas encore capturee."}
            </div>
          )}
        </>
      )}
    </div>
  );
}
