import type { ReactNode } from "react";

export function StatCard({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="nc-card" style={{ padding: "13px 12px", borderRadius: 15 }}>
      <div
        className="nc-mono"
        style={{ fontSize: 9, letterSpacing: ".12em", color: "var(--ink3)", textTransform: "uppercase" }}
      >
        {label}
      </div>
      <div className="nc-mono" style={{ fontSize: 23, fontWeight: 500, marginTop: 10 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: "var(--ink2)", marginTop: 6 }}>{sub}</div>}
    </div>
  );
}
