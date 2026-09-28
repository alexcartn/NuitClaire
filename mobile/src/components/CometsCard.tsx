import { useCallback } from "react";
import { api } from "../api";
import { useFetch } from "../useFetch";
import { fmtHM, plural } from "../format";
import { Section } from "./Section";
import type { Comet } from "../types";

function fmtMag(mag: number): string {
  return String(mag.toFixed(1)).replace(".", ",");
}

function fmtDay(isoDate: string): string {
  return new Date(isoDate + "T00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/** Hauteur de la comete sur la nuit : la courbe entiere en trait fin, et en
 * accent les moments ou elle est assez haute dans un secteur degage. */
function CometCurve({ comet }: { comet: Comet }) {
  const W = 300;
  const H = 56;
  const pts = comet.curve;
  if (pts.length < 2) return null;
  const x = (i: number) => (i / (pts.length - 1)) * W;
  const y = (alt: number) => H - (Math.max(0, Math.min(90, alt)) / 90) * H;
  const line = (keep: (i: number) => boolean) =>
    pts.map((p, i) => (keep(i) ? `${i && keep(i - 1) ? "L" : "M"} ${x(i).toFixed(1)} ${y(p.alt).toFixed(1)}` : "")).join(" ");
  return (
    <div className="nc-stack-xs" style={{ gap: "var(--space-2xs)" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img"
        aria-label={`Hauteur de ${comet.name} pendant la nuit, au plus haut ${comet.bestAlt}°`}>
        <line x1={0} x2={W} y1={y(20)} y2={y(20)} stroke="var(--line)" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
        <line x1={0} x2={W} y1={H} y2={H} stroke="var(--line)" vectorEffect="non-scaling-stroke" />
        <path d={line(() => true)} fill="none" stroke="var(--ink3)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <path d={line((i) => pts[i].clear)} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round"
          vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="nc-num" style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)", color: "var(--ink3)" }}>
        <span>{fmtHM(pts[0].time)}</span>
        <span>20° en pointillé</span>
        <span>{fmtHM(pts[pts.length - 1].time)}</span>
      </div>
    </div>
  );
}

/** Cometes a portee du Seestar ce soir. N'apparait que s'il y en a une :
 * la plupart des nuits, il n'y a rien, et une carte vide serait du bruit. */
export function CometsCard() {
  const fetchComets = useCallback(() => api.comets(), []);
  const { data } = useFetch(fetchComets, [], "comets");
  if (!data?.available || data.comets.length === 0) return null;
  return (
    <Section
      id="soir-cometes"
      title="Comètes"
      summary={`${plural(data.comets.length, "visible", "visibles")} · mag ≤ ${fmtMag(data.magMax)}`}
    >
      {data.comets.map((c) => (
        <div key={c.designation} className="nc-stack-xs">
          <div className="nc-row nc-between" style={{ alignItems: "baseline" }}>
            <span style={{ fontSize: "var(--text-md)", fontWeight: 600 }}>{c.name}</span>
            <span className="nc-num nc-none" style={{ fontSize: "var(--text-sm)" }}>mag. {fmtMag(c.mag)}</span>
          </div>
          <span className="nc-caption nc-num" style={{ color: "var(--ink2)" }}>
            visible {fmtHM(c.from)}–{fmtHM(c.to)} · au plus haut {c.bestAlt}° vers {fmtHM(c.bestTime)} ({c.sector}) ·{" "}
            {c.constellation}
          </span>
          <CometCurve comet={c} />
          <span className="nc-caption">
            Magnitude {c.magSource}
            {c.magSource === "observée" && ` (prévision du MPC : ${fmtMag(c.predictedMag)})`}
            {c.peakMag != null && c.peakDate && ` · pic attendu ${fmtMag(c.peakMag)} le ${fmtDay(c.peakDate)}`}.
          </span>
        </div>
      ))}
      <p className="nc-caption" style={{ margin: 0 }}>
        Au Seestar : pointez par la désignation dans l'appli Seestar, en poses courtes, la comète bouge
        devant les étoiles. Orbites : Minor Planet Center
        {data.observedAvailable ? ", magnitudes observées : COBS (cobs.si)." : ". Observations COBS indisponibles, magnitudes prévues seulement."}
      </p>
    </Section>
  );
}
