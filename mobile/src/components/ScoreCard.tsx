import type { Night } from "../types";
import { qualityColor } from "../quality";
import { MiniScoreBars } from "./MiniScoreBars";
import { TwilightBar } from "./TwilightBar";

export function ScoreCard({ night }: { night: Night }) {
  return (
    <div className="nc-card nc-card-lg" style={{ display: "flex", flexDirection: "column", gap: 17 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
        <div
          className="nc-num"
          style={{ fontSize: "var(--text-display)", lineHeight: 0.82, letterSpacing: "-.045em", fontWeight: 500, color: qualityColor(night.score) }}
        >
          {night.scorePct}
        </div>
        <div className="nc-num" style={{ fontSize: "var(--text-sm)", color: "var(--ink3)", marginBottom: 6 }}>
          /100
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ textAlign: "right", marginBottom: 4 }}>
          <div style={{ fontSize: "var(--text-md)" }}>{night.scoreLabel}</div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--ink3)", marginTop: 4 }}>score de la nuit, cibles sans filtre</div>
        </div>
      </div>
      <MiniScoreBars hourly={night.hourly} />
      <div style={{ height: 1, background: "var(--line)" }} />
      <TwilightBar night={night} />
    </div>
  );
}
