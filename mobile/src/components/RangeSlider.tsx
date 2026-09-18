/** Curseur a deux poignees (technique classique : deux <input type="range">
 * superposes, seule la poignee est cliquable -- voir `.nc-range-thumb` dans
 * theme.css). `value` est toujours [lo, hi] avec lo <= hi ; chaque poignee
 * est bornee par l'autre (onChange ne peut jamais inverser l'ordre). */
export function RangeSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
}: {
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
}) {
  const [lo, hi] = value;
  const pct = (v: number) => ((v - min) / (max - min || 1)) * 100;

  return (
    <div style={{ position: "relative", height: 24, display: "flex", alignItems: "center" }}>
      <div
        style={{
          position: "absolute", left: 0, right: 0, height: 3, borderRadius: 2, background: "var(--line)",
        }}
      />
      <div
        style={{
          position: "absolute", height: 3, borderRadius: 2, background: "var(--accent)",
          left: `${pct(lo)}%`, right: `${100 - pct(hi)}%`,
        }}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={lo}
        onChange={(e) => onChange([Math.min(Number(e.target.value), hi), hi])}
        className="nc-range-thumb"
        style={{ zIndex: lo >= hi ? 5 : 3 }}
        aria-label="Minimum"
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={hi}
        onChange={(e) => onChange([lo, Math.max(Number(e.target.value), lo)])}
        className="nc-range-thumb"
        style={{ zIndex: 4 }}
        aria-label="Maximum"
      />
    </div>
  );
}
