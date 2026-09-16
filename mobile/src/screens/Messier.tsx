import { useCallback, useState } from "react";
import { api } from "../api";
import { useFetch } from "../useFetch";

const MESSIER_TOTAL = 110;

export function Messier({
  captured,
  onOpenTarget,
}: {
  captured: Set<string>;
  onOpenTarget: (designation: string) => void;
}) {
  const [onlyFeasible, setOnlyFeasible] = useState(false);

  const fetchMessier = useCallback(() => api.messier(onlyFeasible), [onlyFeasible]);
  const { data: rows, loading } = useFetch(fetchMessier, [onlyFeasible]);

  const capturedPct = Math.round((captured.size / MESSIER_TOTAL) * 100);

  return (
    <div className="nc-screen">
      <div>
        <div className="nc-eyebrow">Catalogue Messier</div>
        <div className="nc-title">
          {captured.size} sur {MESSIER_TOTAL} captures
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ height: 8, borderRadius: 4, background: "var(--bar)", overflow: "hidden" }}>
          <div style={{ width: `${capturedPct}%`, height: "100%", background: "var(--accent)" }} />
        </div>
        <div className="nc-mono" style={{ fontSize: 11, color: "var(--ink3)" }}>
          {capturedPct}% du catalogue
        </div>
      </div>

      <button
        onClick={() => setOnlyFeasible((v) => !v)}
        className={`nc-chip ${onlyFeasible ? "nc-chip-active" : ""}`}
        style={{ alignSelf: "flex-start" }}
      >
        Faisable ce soir uniquement
      </button>

      {loading && <p className="nc-caption">Chargement...</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        {(rows ?? []).map((row) => {
          const isCaptured = !!row.messierId && captured.has(row.messierId);
          return (
            <div key={row.designation} className="nc-card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <button
                onClick={() => onOpenTarget(row.designation)}
                className="nc-strip"
                style={{
                  height: 84, background: "var(--surf2)", border: "none",
                  borderBottom: "1px solid var(--line)", cursor: "pointer",
                  display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: 8,
                  backgroundImage: row.imageUrl ? `url(${row.imageUrl})` : undefined,
                  backgroundSize: "cover", backgroundPosition: "center",
                }}
              >
                <span className="nc-mono" style={{ fontSize: 13, color: "var(--ink)", background: "var(--surf)", padding: "2px 5px", borderRadius: 4 }}>
                  {row.designation}
                </span>
                <span
                  className="nc-mono"
                  style={{ fontSize: 9, color: row.feasibleTonight ? "var(--good)" : "var(--ink3)", background: "var(--surf)", padding: "2px 5px", borderRadius: 4 }}
                >
                  {row.feasibleTonight ? "CE SOIR" : "—"}
                </span>
              </button>
              <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 11, color: "var(--ink2)", minHeight: 30 }}>
                  {row.commonName || row.type}
                </div>
                <span
                  style={{
                    background: isCaptured ? "var(--accent)" : "var(--surf2)",
                    color: isCaptured ? "var(--onaccent)" : "var(--ink2)",
                    border: "1px solid var(--line)", borderRadius: 9,
                    padding: 9, fontSize: 12, textAlign: "center", cursor: "default",
                  }}
                >
                  {isCaptured ? "Capturee ✓" : "Non capturee"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
