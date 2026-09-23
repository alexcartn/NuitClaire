import type { Night } from "../types";

function fmt(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function pct(startIso: string, endIso: string, totalMs: number): number {
  return ((new Date(endIso).getTime() - new Date(startIso).getTime()) / totalMs) * 100;
}

/** Barre de crepuscules : 5 segments (crepuscule civil, nautique, nuit
 * astro, nautique, civil), largeurs proportionnelles aux vraies durees --
 * contrairement a la maquette qui utilisait des largeurs d'exemple fixes. */
export function TwilightBar({ night }: { night: Night }) {
  const total = new Date(night.civilDawn).getTime() - new Date(night.civilDusk).getTime();
  const segments = [
    { from: night.civilDusk, to: night.nauticalDusk, color: "var(--bar)" },
    { from: night.nauticalDusk, to: night.astroDusk, color: "oklch(.5 .09 290)" },
    { from: night.astroDusk, to: night.astroDawn, color: "var(--accent)" },
    { from: night.astroDawn, to: night.nauticalDawn, color: "oklch(.5 .09 290)" },
    { from: night.nauticalDawn, to: night.civilDawn, color: "var(--bar)" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", background: "var(--bar)" }}>
        {segments.map((s, i) => (
          <div key={i} style={{ width: `${pct(s.from, s.to, total)}%`, background: s.color }} />
        ))}
      </div>
      {/* Seules les heures passent en chasse fixe : « crepuscule » et « nuit
          astro » nomment le moment, ils ne le mesurent pas. */}
      <div
        style={{
          display: "flex", justifyContent: "space-between",
          fontSize: "var(--text-xs)", color: "var(--ink2)",
        }}
      >
        <span>
          crepuscule <span className="nc-num">{fmt(night.civilDusk)}</span>
        </span>
        <span style={{ color: "var(--accent)" }}>
          nuit astro <span className="nc-num">{fmt(night.astroDusk)} → {fmt(night.astroDawn)}</span>
        </span>
      </div>
    </div>
  );
}
