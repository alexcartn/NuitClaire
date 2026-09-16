import { COMPASS_SECTORS } from "../types";

export function SectorChips({ horizon }: { horizon: Record<string, boolean> }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {COMPASS_SECTORS.map((s) => (
        <div key={s} className={`nc-chip ${horizon[s] ? "nc-chip-active" : ""}`} style={{ cursor: "default" }}>
          {s}
        </div>
      ))}
    </div>
  );
}
