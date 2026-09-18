import { useCallback, useMemo, useState } from "react";
import { api } from "../api";
import { useFetch } from "../useFetch";
import { RangeSlider } from "../components/RangeSlider";

const MESSIER_TOTAL = 110;

export function Messier({
  captured,
  onOpenTarget,
  onCaptureChange,
}: {
  captured: Set<string>;
  onOpenTarget: (designation: string) => void;
  onCaptureChange: () => void;
}) {
  const [onlyFeasible, setOnlyFeasible] = useState(false);
  const [types, setTypes] = useState<string[]>([]);
  const [magRange, setMagRange] = useState<[number, number] | null>(null);

  const fetchMessier = useCallback(() => api.messier(onlyFeasible), [onlyFeasible]);
  const { data: rows, loading } = useFetch(fetchMessier, [onlyFeasible]);

  const allTypes = useMemo(() => {
    const seen = new Set<string>();
    (rows ?? []).forEach((r) => seen.add(r.type));
    return [...seen].sort();
  }, [rows]);

  const magBounds = useMemo(() => {
    const values = (rows ?? []).map((r) => r.mag).filter((m): m is number => m != null);
    if (!values.length) return null;
    return { min: Math.floor(Math.min(...values)), max: Math.ceil(Math.max(...values)) };
  }, [rows]);

  const toggleType = (t: string) =>
    setTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  const filtered = useMemo(() => {
    const [lo, hi] = magRange ?? [-Infinity, Infinity];
    return (rows ?? []).filter(
      (r) => (types.length === 0 || types.includes(r.type)) && (r.mag == null || (r.mag >= lo && r.mag <= hi)),
    );
  }, [rows, types, magRange]);

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

      {allTypes.length > 0 && (
        <div style={{ display: "flex", gap: 7, overflow: "auto", margin: "0 -18px", padding: "0 18px 2px" }}>
          {allTypes.map((t) => (
            <button
              key={t}
              onClick={() => toggleType(t)}
              className={`nc-chip ${types.includes(t) ? "nc-chip-active" : ""}`}
              style={{ flex: "none" }}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {magBounds && magBounds.max > magBounds.min && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="nc-caption" style={{ margin: 0 }}>
            Magnitude {(magRange ?? [magBounds.min, magBounds.max])[0].toFixed(1)} →{" "}
            {(magRange ?? [magBounds.min, magBounds.max])[1].toFixed(1)}
          </span>
          <RangeSlider
            min={magBounds.min}
            max={magBounds.max}
            step={0.5}
            value={magRange ?? [magBounds.min, magBounds.max]}
            onChange={setMagRange}
          />
        </div>
      )}

      {loading && <p className="nc-caption">Chargement...</p>}
      {rows && filtered.length === 0 && (
        <p className="nc-caption">Aucun objet ne correspond a ces filtres.</p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        {filtered.map((row) => {
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
                <button
                  onClick={async () => {
                    if (!row.messierId) return;
                    await api.updateMessierCapture(row.messierId, !isCaptured);
                    onCaptureChange();
                  }}
                  className="nc-btn"
                  style={{
                    background: isCaptured ? "var(--accent)" : "var(--surf2)",
                    color: isCaptured ? "var(--onaccent)" : "var(--ink2)",
                    borderRadius: 9, padding: 9, fontSize: 12, textAlign: "center", minHeight: 0,
                  }}
                >
                  {isCaptured ? "Capturee ✓" : "Marquer capturee"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
