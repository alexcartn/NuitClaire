import type { TargetRow as TargetRowT } from "../types";

export function TargetRowCard({
  row,
  isNew,
  onOpen,
}: {
  row: TargetRowT;
  isNew?: boolean;
  onOpen: () => void;
}) {
  const subtitleParts = [row.commonName, row.ngc && row.ngc !== row.designation ? row.ngc : null].filter(
    Boolean,
  );
  return (
    <button
      onClick={onOpen}
      className="nc-card"
      style={{ width: "100%", textAlign: "left", display: "flex", gap: 13, cursor: "pointer", color: "var(--ink)" }}
    >
      <div
        className="nc-strip"
        style={{ width: 78, height: 78, flex: "none", borderRadius: 11, background: "var(--surf2)", overflow: "hidden" }}
      >
        {row.imageUrl && (
          <img src={row.imageUrl} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span className="nc-mono" style={{ fontSize: 16, fontWeight: 500 }}>
            {row.designation}
          </span>
          {isNew && (
            <span
              className="nc-mono"
              style={{
                fontSize: 9,
                letterSpacing: ".06em",
                padding: "4px 6px",
                borderRadius: 5,
                background: "var(--accent)",
                color: "var(--onaccent)",
              }}
            >
              À FAIRE
            </span>
          )}
        </div>
        {subtitleParts.length > 0 && (
          <div
            style={{
              fontSize: 12,
              color: "var(--ink2)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {subtitleParts.join(" · ")}
          </div>
        )}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, color: "var(--ink2)", padding: "4px 7px", border: "1px solid var(--line)", borderRadius: 5 }}>
            {row.type}
          </span>
          <span style={{ fontSize: 10, color: "var(--ink2)", padding: "4px 7px", border: "1px solid var(--line)", borderRadius: 5 }}>
            {row.cadrage}
          </span>
        </div>
        <div className="nc-mono" style={{ fontSize: 11, color: "var(--ink3)" }}>
          {row.start && row.end ? `${row.start}–${row.end}` : "infaisable ce soir"} · alt{" "}
          {Math.round(row.altMaxDeg)}° · lune {Math.round(row.moonSepDeg)}°
        </div>
      </div>
    </button>
  );
}
