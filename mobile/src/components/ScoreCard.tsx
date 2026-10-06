import type { ReactNode } from "react";
import type { Night } from "../types";
import { qualityColor } from "../quality";
import { MiniScoreBars } from "./MiniScoreBars";
import { TwilightBar } from "./TwilightBar";

/** Une des quatre mesures de la nuit, en colonne : intitule, valeur, precision.
 * Elles tiennent sur une ligne dans la carte de decision, au lieu de quatre
 * tuiles de meme poids entre la note et le plan de la nuit. */
function Condition({ label, value, sub, valueIsWord }: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  valueIsWord?: boolean;
}) {
  return (
    <div className="nc-stack-xs" style={{ gap: "var(--space-2xs)", minWidth: 0 }}>
      <div className="nc-eyebrow">{label}</div>
      <div className={valueIsWord ? undefined : "nc-num"} style={{ fontSize: "var(--text-md)", fontWeight: 500, lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && <div className="nc-caption nc-num" style={{ margin: 0, fontFamily: valueIsWord ? "var(--font-text)" : undefined }}>{sub}</div>}
    </div>
  );
}

export function ScoreCard({ night }: { night: Night }) {
  const temp = night.tempNowC != null ? `${Math.round(night.tempNowC)}°` : "n/d";
  const tempRange =
    night.tempMinC != null && night.tempMaxC != null
      ? `${Math.round(night.tempMinC)}° → ${Math.round(night.tempMaxC)}°`
      : undefined;
  return (
    <div className="nc-card nc-card-lg" style={{ display: "flex", flexDirection: "column", gap: 17 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
        <div
          className="nc-num"
          style={{ fontSize: "var(--text-display)", lineHeight: 0.82, letterSpacing: "-.045em", fontWeight: 500, color: qualityColor(night.score) }}
        >
          {night.scorePct}
        </div>
        <div className="nc-num" style={{ fontSize: "var(--text-sm)", color: "var(--ink2)", marginBottom: 6 }}>
          /100
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ textAlign: "right", marginBottom: 4 }}>
          <div style={{ fontSize: "var(--text-md)" }}>{night.scoreLabel}</div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--ink2)", marginTop: 4 }}>score de la nuit, cibles sans filtre</div>
        </div>
      </div>
      <MiniScoreBars hourly={night.hourly} />
      <div style={{ height: 1, background: "var(--line)" }} />
      <TwilightBar night={night} />
      <div style={{ height: 1, background: "var(--line)" }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", columnGap: "var(--space-xs)" }}>
        <Condition label="Temp." value={temp} sub={tempRange} />
        <Condition label="Lune" value={`${Math.round(night.moonIllum)} %`} sub={night.moonWaxing ? "croissante" : "en déclin"} />
        <Condition label="Buée" valueIsWord value={night.dewRisk} sub={`anti-buée : ${night.dewAdvice.toLowerCase()}`} />
        <Condition
          label="Rafales"
          value={night.windGustsKmh != null ? Math.round(night.windGustsKmh) : "n/d"}
          sub={night.windGustsKmh != null ? "km/h" : undefined}
        />
      </div>
    </div>
  );
}
