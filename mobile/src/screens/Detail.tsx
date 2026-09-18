import { useCallback, useState } from "react";
import { api } from "../api";
import { useFetch } from "../useFetch";
import { AltitudeChart } from "../components/AltitudeChart";

function fmtExposureDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function Detail({
  designation,
  captured,
  horizon,
  onBack,
  onCaptureChange,
}: {
  designation: string;
  captured: Set<string>;
  horizon?: Record<string, boolean>;
  onBack: () => void;
  onCaptureChange: () => void;
}) {
  const fetchDetail = useCallback(() => api.targetDetail(designation), [designation]);
  const { data, loading, error, reload } = useFetch(fetchDetail, [designation]);
  const [addedToJournal, setAddedToJournal] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [exposureDraft, setExposureDraft] = useState("");
  const [addingExposure, setAddingExposure] = useState(false);

  const addExposure = async () => {
    const minutes = Math.round(Number(exposureDraft));
    if (!Number.isFinite(minutes) || minutes <= 0) return;
    setAddingExposure(true);
    try {
      await api.addTargetExposure(designation, minutes);
      setExposureDraft("");
      reload();
    } finally {
      setAddingExposure(false);
    }
  };

  const deleteExposure = async (entryId: string) => {
    await api.deleteTargetExposure(designation, entryId);
    reload();
  };

  const toggleCapture = async () => {
    if (!data?.messierId) return;
    setCapturing(true);
    try {
      await api.updateMessierCapture(data.messierId, !captured.has(data.messierId));
      onCaptureChange();
    } finally {
      setCapturing(false);
    }
  };

  const addToJournal = async () => {
    await api.addSessionItem(designation);
    setAddedToJournal(true);
  };

  return (
    <div className="nc-screen">
      <button onClick={onBack} className="nc-caption" style={{ alignSelf: "flex-start", background: "none", border: "none", color: "var(--accent)", cursor: "pointer", padding: "4px 0" }}>
        ← Retour
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
            <AltitudeChart series={data.altitudeSeries} horizon={horizon} />
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

          <div className="nc-card" style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div className="nc-eyebrow">Temps d'expo</div>
              {data.exposureTotalMin > 0 && (
                <div className="nc-mono" style={{ fontSize: 13, color: "var(--ink)" }}>
                  {Math.floor(data.exposureTotalMin / 60) > 0
                    ? `${Math.floor(data.exposureTotalMin / 60)} h ${String(data.exposureTotalMin % 60).padStart(2, "0")}`
                    : `${data.exposureTotalMin} min`}{" "}
                  au total
                </div>
              )}
            </div>

            <p className="nc-caption" style={{ margin: 0 }}>
              Ajoute directement ici, sans passer par le journal -- pratique pour rattraper des prises
              anterieures a l'usage de l'appli.
            </p>

            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={exposureDraft}
                onChange={(e) => setExposureDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addExposure()}
                placeholder="Minutes"
                style={{
                  flex: 1, background: "var(--surf2)", border: "1px solid var(--line)", borderRadius: 8,
                  padding: "7px 9px", fontSize: 12, color: "var(--ink)",
                }}
              />
              <button
                onClick={addExposure}
                disabled={addingExposure || !exposureDraft.trim()}
                className="nc-btn"
                style={{ flex: "none", padding: "5px 14px", fontSize: 12 }}
              >
                Ajouter
              </button>
            </div>

            {data.exposureLog.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {data.exposureLog.map((e) => (
                  <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="nc-mono" style={{ fontSize: 11, color: "var(--ink3)", width: 48, flex: "none" }}>
                      {fmtExposureDate(e.at)}
                    </span>
                    <span className="nc-mono" style={{ fontSize: 12, flex: 1 }}>
                      {e.minutes} min
                    </span>
                    <button
                      onClick={() => deleteExposure(e.id)}
                      style={{ background: "none", border: "none", color: "var(--ink3)", cursor: "pointer", fontSize: 15, padding: "0 4px" }}
                      title="Supprimer cette entree"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
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

          <div style={{ display: "flex", gap: 9 }}>
            {data.messierId && (
              <button
                onClick={toggleCapture}
                disabled={capturing}
                className="nc-btn"
                style={{
                  flex: 1,
                  background: captured.has(data.messierId) ? "var(--accent)" : "var(--surf)",
                  color: captured.has(data.messierId) ? "var(--onaccent)" : "var(--ink)",
                }}
              >
                {captured.has(data.messierId) ? "Capturee ✓" : "Marquer comme capturee"}
              </button>
            )}
            <button onClick={addToJournal} disabled={addedToJournal} className="nc-btn" style={{ flex: "none" }}>
              {addedToJournal ? "Ajoutee ✓" : "Journal"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
