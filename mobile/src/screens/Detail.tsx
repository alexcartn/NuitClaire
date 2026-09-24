import { useCallback, useState } from "react";
import { api } from "../api";
import { useFetch } from "../useFetch";
import { mutate, useSessions } from "../useSessions";
import { targetHistory } from "../journalRead";
import { newOp } from "../sessionQueue";
import { AltitudeChart } from "../components/AltitudeChart";
import { ErrorNotice } from "../components/ErrorNotice";
import { NightToggle } from "../components/NightToggle";
import { TabIcon } from "../components/TabIcon";
import { fmtH, fmtHM, plural } from "../format";
import { tap } from "../haptics";
import type { ViewWindow } from "../types";

/** '90' -> "1 h 30" ; en-dessous de l'heure, "45 min". */
function fmtMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
}

function fmtNightDate(isoDate: string): string {
  return new Date(isoDate + "T00:00").toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function fmtExposureDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function Detail({
  designation,
  captured,
  horizon,
  windowMode,
  viewWindow,
  onBack,
  onCaptureChange,
}: {
  designation: string;
  captured: Set<string>;
  horizon?: Record<string, boolean>;
  windowMode?: string;
  viewWindow?: ViewWindow;
  onBack: () => void;
  onCaptureChange: () => void;
}) {
  const fetchDetail = useCallback(() => api.targetDetail(designation), [designation]);
  const { data, loading, error, reload } = useFetch(fetchDetail, [designation]);
  const [addedToJournal, setAddedToJournal] = useState(false);
  // Le journal est deja sur l'appareil : l'historique de la cible s'en
  // deduit, sans requete (voir journalRead.targetHistory).
  const sessions = useSessions();
  const history = targetHistory(sessions.data, designation);
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
      tap();
      onCaptureChange();
    } finally {
      setCapturing(false);
    }
  };

  const addToJournal = () => {
    // Passe par la file du journal (voir sessionQueue.ts) plutot que par un
    // appel direct : ce geste se fait aussi dehors, reseau incertain, et il
    // doit etre pris en compte immediatement meme hors ligne.
    mutate(newOp({ kind: "addItem", designation }));
    tap();
    setAddedToJournal(true);
  };

  return (
    <div className="nc-screen">
      <div className="nc-row nc-between">
        {/* Surface tactile de 44 px (voir .nc-link) : ce lien en faisait
            vingt-quatre. Le geste retour du telephone marche aussi, desormais
            (voir App.tsx). */}
        <button onClick={onBack} className="nc-link nc-link-accent">
          <TabIcon name="back" />
          Retour
        </button>
        <NightToggle />
      </div>

      {loading && !data && <p className="nc-caption">Chargement…</p>}
      {error && !data && (
        <ErrorNotice
          message={error.includes("404") || error.startsWith("Aucun") ? "Objet introuvable." : "Impossible de charger cette fiche."}
          onRetry={reload}
        />
      )}

      {data && (
        <>
          <div>
            <div className="nc-num" style={{ fontSize: "var(--text-xl)", fontWeight: 500, letterSpacing: "-.02em" }}>
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
              // Meme repli que les vignettes des listes : l'aplat raye plutot
              // que l'icone d'image cassee quand le CDS ne repond pas.
              onError={(e) => {
                e.currentTarget.style.visibility = "hidden";
              }}
              className="nc-strip"
              style={{ width: "100%", height: 200, borderRadius: 16, border: "1px solid var(--line)", objectFit: "cover", background: "var(--surf2)" }}
            />
          )}

          <div className="nc-card" style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              {/* Bornes lues dans la serie elle-meme : l'intitule annoncait
                  « 19h → 06h » en dur, quelle que soit la serie recue. */}
              <div className="nc-eyebrow">
                Hauteur{" "}
                {data.altitudeSeries.length > 0 &&
                  `${fmtH(data.altitudeSeries[0].time)} → ${fmtH(data.altitudeSeries[data.altitudeSeries.length - 1].time)}`}
              </div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--accent)" }}>
                fenêtre pointable
              </div>
            </div>
            <AltitudeChart series={data.altitudeSeries} horizon={horizon} windowMode={windowMode} viewWindow={viewWindow} minAlt={data.minAltDeg} />
            <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--ink2)" }}>
              Direction à l'altitude max : {data.peakSector} (azimut{" "}
              <span className="nc-num">{Math.round(data.peakAz)}°</span>) vers{" "}
              <span className="nc-num">{fmtHM(data.peakTime)}</span>.
            </p>
          </div>

          <div className="nc-card" style={{ padding: 0, overflow: "hidden" }}>
            {[
              ["Coordonnées", `${data.ra.toFixed(3)}h / ${data.dec.toFixed(3)}°`],
              ["Magnitude", data.mag != null ? data.mag.toFixed(1) : "inconnue"],
              ["Taille", data.sizeW && data.sizeH ? `${data.sizeW.toFixed(1)}' x ${data.sizeH.toFixed(1)}'` : "inconnue"],
              ["Cadrage Seestar", data.cadrage],
              ["Fenêtre exploitable", data.start ? `${data.start}–${data.end} (${data.hours} h)` : "Aucune ce soir"],
              ["Filtre conseillé", data.filter],
              ["Séparation lunaire mini", `${Math.round(data.moonSepDeg)}°`],
              ["Temps de pose", `${data.exposureLowMin}–${data.exposureHighMin} min`],
            ].map(([k, v], i, arr) => (
              <div
                key={k}
                style={{
                  display: "flex", justifyContent: "space-between", gap: 14, padding: "13px 16px",
                  borderBottom: i < arr.length - 1 ? "1px solid var(--line)" : "none",
                }}
              >
                <div style={{ fontSize: "var(--text-sm)", color: "var(--ink2)" }}>{k}</div>
                <div className="nc-num" style={{ fontSize: "var(--text-sm)", textAlign: "right" }}>
                  {v}
                </div>
              </div>
            ))}
          </div>

          <div className="nc-card" style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div className="nc-eyebrow">Temps d'expo</div>
              {data.exposureTotalMin > 0 && (
                <div className="nc-num" style={{ fontSize: "var(--text-sm)", color: "var(--ink)" }}>
                  {fmtMinutes(data.exposureTotalMin)} au total
                </div>
              )}
            </div>

            {/* Le total additionne les deux sources : ce qui est saisi ici et
                ce qui l'est par sortie dans le journal. Afficher la
                repartition evite de chercher d'ou vient l'ecart avec ce qu'on
                a tape ci-dessous. */}
            {data.exposureSessionMin > 0 && (
              <div className="nc-caption" style={{ margin: 0 }}>
                dont {fmtMinutes(data.exposureSessionMin)} saisies dans le journal de session
                {data.exposureFreeMin > 0 && ` et ${fmtMinutes(data.exposureFreeMin)} ici`}.
              </div>
            )}

            <p className="nc-caption" style={{ margin: 0 }}>
              Ajouté directement ici, sans passer par le journal : pratique pour rattraper des prises
              antérieures à l'usage de l'appli.
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
                aria-label="Minutes de pose à ajouter"
                className="nc-input"
              />
              <button
                onClick={addExposure}
                disabled={addingExposure || !exposureDraft.trim()}
                className="nc-btn nc-btn-sm"
              >
                Ajouter
              </button>
            </div>

            {data.exposureLog.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {data.exposureLog.map((e) => (
                  <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="nc-num" style={{ fontSize: "var(--text-xs)", color: "var(--ink3)", width: 56, flex: "none" }}>
                      {fmtExposureDate(e.at)}
                    </span>
                    <span className="nc-num" style={{ fontSize: "var(--text-sm)", flex: 1 }}>
                      {e.minutes} min
                    </span>
                    <button
                      onClick={() => deleteExposure(e.id)}
                      className="nc-icon-btn"
                      title="Supprimer cette entrée"
                      aria-label={`Supprimer ${e.minutes} min du ${fmtExposureDate(e.at)}`}
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
                <p key={r} style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--ink2)" }}>
                  · {r}
                </p>
              ))}
            </div>
          )}

          {data.wiki && (
            <div className="nc-card" style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              <div className="nc-eyebrow">En savoir plus</div>
              <p style={{ margin: 0, fontSize: "var(--text-sm)", lineHeight: 1.55, color: "var(--ink2)" }}>{data.wiki.extract}</p>
              <a href={data.wiki.url} target="_blank" rel="noreferrer" className="nc-caption">
                Source : Wikipedia
              </a>
            </div>
          )}

          {history.nightCount > 0 && (
            <div className="nc-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="nc-eyebrow">Dans ton journal</div>
              <div className="nc-caption" style={{ margin: 0 }}>
                {plural(history.nightCount, "nuit", "nuits")}
                {history.totalExposureMin > 0 && ` · ${fmtMinutes(history.totalExposureMin)} de pose`}
                {history.avgRating != null && ` · satisfaction ${history.avgRating}/5`}
              </div>
              {history.nights.map((n, i) => (
                <div
                  key={n.closedAt ?? `courante-${i}`}
                  style={{ display: "flex", flexDirection: "column", gap: 3 }}
                >
                  <div style={{ fontSize: "var(--text-sm)", color: "var(--ink)" }}>
                    {n.date ? fmtNightDate(n.date) : "Session en cours"}
                    {n.exposureMin ? ` · ${fmtMinutes(n.exposureMin)}` : ""}
                    {n.rating != null ? ` · ${n.rating}/5` : ""}
                    {n.done ? " · capturée" : ""}
                  </div>
                  {n.notes.map((note) => (
                    <div key={note.at} className="nc-caption" style={{ margin: 0 }}>
                      {note.text}
                    </div>
                  ))}
                </div>
              ))}
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
                {captured.has(data.messierId) ? "Capturé ✓" : "Marquer comme capturé"}
              </button>
            )}
            <button onClick={addToJournal} disabled={addedToJournal} className="nc-btn" style={{ flex: "none" }}>
              {addedToJournal ? "Ajoutée ✓" : "Ajouter au journal"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
