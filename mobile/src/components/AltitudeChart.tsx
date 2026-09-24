import type { AltitudePoint, ViewWindow } from "../types";

const MIN_ALT = 20; // SEESTAR.min_alt_deg
const MAX_ALT = 85; // SEESTAR.max_alt_deg

function fmtHour(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}h`;
}

/** Barres d'altitude 19h-6h (voir rows.day_frame) : teintees en accent quand
 * la cible est a la fois dans la plage utilisable du Seestar S50 (20-85deg),
 * dans un secteur d'horizon degage choisi par l'utilisateur, ET dans la
 * fenetre d'observation configuree si le mode "habituelle" est actif (meme
 * regle que la bande verte du graphe Streamlit, voir
 * app.py::_clear_horizon_runs et scoring.in_observation_window -- toute la
 * nuit reste affichee pour le contexte, seule la bande "pointable" se
 * restreint). Le secteur cardinal (N/NE/E/...) de chaque heure est affiche
 * au-dessus de sa barre -- avant, seulement visible au survol/appui long via
 * `title`, peu utilisable au doigt sur mobile. Sans `horizon`/`windowMode`
 * (ecran appele avant que /api/state ait repondu), on retombe sur les seuls
 * criteres disponibles plutot que de bloquer l'affichage. */
export function AltitudeChart({
  series,
  horizon,
  windowMode,
  viewWindow,
}: {
  series: AltitudePoint[];
  horizon?: Record<string, boolean>;
  windowMode?: string;
  viewWindow?: ViewWindow;
}) {
  // Calcule une fois (reutilise pour la ligne de secteurs et pour les barres,
  // pour ne pas dupliquer la regle "pointable" a deux endroits).
  const points = series.map((p) => {
    const inRange = p.alt >= MIN_ALT && p.alt <= MAX_ALT;
    const sectorOpen = horizon ? !!horizon[p.sector] : true;
    const hour = new Date(p.time).getHours() + new Date(p.time).getMinutes() / 60;
    const inWindow =
      windowMode !== "habituelle" || !viewWindow || (hour >= viewWindow.startHour && hour <= viewWindow.endHour);
    return { ...p, pointable: inRange && sectorOpen && inWindow };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div className="nc-num" style={{ display: "flex", gap: 4 }}>
        {points.map((p, i) => (
          <span
            key={i}
            style={{
              flex: 1, textAlign: "center", fontSize: "var(--text-xs)",
              color: p.pointable ? "var(--accent)" : "var(--ink3)",
            }}
          >
            {p.sector}
          </span>
        ))}
      </div>
      <div style={{ height: 104, display: "flex", gap: 4, alignItems: "flex-end" }}>
        {points.map((p, i) => (
          <div key={i} style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end" }} title={`${p.sector} ${Math.round(p.az)}°`}>
            <div
              style={{
                width: "100%",
                height: `${Math.max(2, Math.round((Math.max(0, p.alt) / 90) * 100))}%`,
                borderRadius: 3,
                background: p.pointable ? "var(--accent)" : "var(--bar)",
              }}
            />
          </div>
        ))}
      </div>
      <div
        className="nc-num"
        style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)", color: "var(--ink3)" }}
      >
        {series
          .filter((_, i) => i % 3 === 0 || i === series.length - 1)
          .map((p, i) => (
            <span key={i}>{fmtHour(p.time)}</span>
          ))}
      </div>
    </div>
  );
}
