import type { AltitudePoint } from "../types";

const MIN_ALT = 20; // SEESTAR.min_alt_deg
const MAX_ALT = 85; // SEESTAR.max_alt_deg

function fmtHour(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}h`;
}

/** Barres d'altitude 19h-6h (voir rows.day_frame) : teintees en accent quand
 * la cible est dans la plage utilisable du Seestar S50 (20-85deg), sans
 * recroiser l'horizon degage choisi par l'utilisateur -- simplification
 * deliberee par rapport au graphe Streamlit (bande verte + horizon), pour
 * garder cet ecran independant d'un appel /api/state supplementaire. */
export function AltitudeChart({ series }: { series: AltitudePoint[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ height: 104, display: "flex", gap: 4, alignItems: "flex-end" }}>
        {series.map((p, i) => {
          const pointable = p.alt >= MIN_ALT && p.alt <= MAX_ALT;
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
