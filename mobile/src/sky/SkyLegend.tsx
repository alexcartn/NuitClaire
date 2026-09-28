import { TargetMark } from "./SkyDome";

const ITEMS = [
  ["galaxy", "galaxie"],
  ["open", "amas ouvert"],
  ["globular", "amas globulaire"],
  ["nebula", "nébuleuse"],
  ["planetary", "néb. planétaire"],
] as const;

/** Legende des symboles de cibles, sous la carte. */
export function SkyLegend() {
  return (
    <div className="nc-row nc-wrap nc-caption" style={{ gap: "var(--space-xs) var(--space-sm)" }}>
      {ITEMS.map(([symbol, label]) => (
        <span key={symbol} className="nc-row" style={{ gap: 5 }}>
          <svg viewBox="-1.6 -1.6 3.2 3.2" width={16} height={16} aria-hidden="true" className="nc-sky-legend">
            <TargetMark x={0} y={0} s={1} symbol={symbol} className="nc-sky-target" />
          </svg>
          {label}
        </span>
      ))}
    </div>
  );
}
