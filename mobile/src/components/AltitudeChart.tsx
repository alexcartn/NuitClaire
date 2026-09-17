import type { AltitudePoint } from "../types";

const MIN_ALT = 20; // SEESTAR.min_alt_deg
const MAX_ALT = 85; // SEESTAR.max_alt_deg

function fmtHour(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}h`;
}

/** Barres d'altitude 19h-6h (voir rows.day_frame) : teintees en accent quand
 * la cible est a la fois dans la plage utilisable du Seestar S50 (20-85deg)
 * ET dans un secteur d'horizon degage choisi par l'utilisateur -- meme regle
 * que la bande verte du graphe Streamlit (app.py::_clear_horizon_runs). Sans
 * `horizon` (ecran appele avant que /api/state ait repondu), on retombe sur
 * le seul critere d'altitude plutot que de bloquer l'affichage. */
export function AltitudeChart({ series, horizon }: { series: AltitudePoint[]; horizon?: Record<string, boolean> }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ height: 104, display: "flex", gap: 4, alignItems: "flex-end" }}>
        {series.map((p, i) => {
          const inRange = p.alt >= MIN_ALT && p.alt <= MAX_ALT;
          const sectorOpen = horizon ? !!horizon[p.sector] : true;
          const pointable = inRange && sectorOpen;
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
