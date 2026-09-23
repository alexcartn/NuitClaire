import type { HourlyPoint } from "../types";
import { qualityColor } from "../quality";

function downsample(hourly: HourlyPoint[], buckets: number): HourlyPoint[] {
  if (hourly.length <= buckets) return hourly;
  const out: HourlyPoint[] = [];
  for (let i = 0; i < buckets; i++) {
    out.push(hourly[Math.round((i * (hourly.length - 1)) / (buckets - 1))]);
  }
  return out;
}

function formatHour(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}h`;
}

export function MiniScoreBars({ hourly, buckets = 11 }: { hourly: HourlyPoint[]; buckets?: number }) {
  const points = downsample(hourly, buckets);
  if (points.length === 0) return null;
  const mid = points[Math.floor((points.length - 1) / 2)];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <div style={{ display: "flex", gap: 3, height: 46, alignItems: "flex-end" }}>
        {points.map((p, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${Math.max(4, Math.round(p.score * 100))}%`,
              borderRadius: 3,
              background: qualityColor(p.score),
            }}
          />
        ))}
      </div>
      <div
        className="nc-num"
        style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--ink3)" }}
      >
        <span>{formatHour(points[0].time)}</span>
        <span>{formatHour(mid.time)}</span>
        <span>{formatHour(points[points.length - 1].time)}</span>
      </div>
    </div>
  );
}
