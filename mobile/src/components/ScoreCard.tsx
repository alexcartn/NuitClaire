import type { Night } from "../types";
import { qualityColor } from "../quality";
import { MiniScoreBars } from "./MiniScoreBars";
import { TwilightBar } from "./TwilightBar";

export function ScoreCard({ night }: { night: Night }) {
  return (
    <div className="nc-card nc-card-lg" style={{ display: "flex", flexDirection: "column", gap: 17 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
        <div
          className="nc-mono"
          style={{ fontSize: 62, lineHeight: 0.82, letterSpacing: "-.045em", fontWeight: 500, color: qualityColor(night.score) }}
        >
          {night.scorePct}
        </div>
        <div className="nc-mono" style={{ fontSize: 14, color: "var(--ink3)", marginBottom: 6 }}>
          /100
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ textAlign: "right", marginBottom: 4 }}>
          <div style={{ fontSize: 17 }}>{night.scoreLabel}</div>
          <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 4 }}>score astro de la nuit</div>
        </div>
      </div>
      <MiniScoreBars hourly={night.hourly} />
      <div style={{ height: 1, background: "var(--line)" }} />
      <TwilightBar night={night} />
    </div>
  );
}
