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
 * restreint). Sans `horizon`/`windowMode` (ecran appele avant que /api/state
 * ait repondu), on retombe sur les seuls criteres disponibles plutot que de
 * bloquer l'affichage. */
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
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ height: 104, display: "flex", gap: 4, alignItems: "flex-end" }}>
        {series.map((p, i) => {
          const inRange = p.alt >= MIN_ALT && p.alt <= MAX_ALT;
          const sectorOpen = horizon ? !!horizon[p.sector] : true;
          const hour = new Date(p.time).getHours() + new Date(p.time).getMinutes() / 60;
          const inWindow =
            windowMode !== "habituelle" || !viewWindow || (hour >= viewWindow.startHour && hour <= viewWindow.endHour);
          const pointable = inRange && sectorOpen && inWindow;
          return (
            <div key={i} style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end" }} title={`${p.sector} ${Math.round(p.az)}°`}>
              <div
                style={{
                  width: "100%",
                  height: `${Math.max(2, Math.round((Math.max(0, p.alt) / 90) * 100))}%`,
                  borderRadius: 3,
                  background: pointable ? "var(--accent)" : "var(--bar)",
                }}
              />
            </div>
          );
        })}
      </div>
      <div
        className="nc-mono"
        style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--ink3)" }}
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
