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

/** Couverture nuageuse totale (`cloud_cover`, meme colonne que
 * app.py::_cloud_chart) heure par heure -- coloree par clarte (100 - nuages),
 * memes seuils rouge/jaune/vert que le score astro. */
export function CloudChart({ hourly, buckets = 13 }: { hourly: HourlyPoint[]; buckets?: number }) {
  const points = downsample(hourly, buckets).filter((p) => p.cloudCoverPct != null);
  if (points.length === 0) return null;
  const mid = points[Math.floor((points.length - 1) / 2)];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <div style={{ display: "flex", gap: 3, height: 60, alignItems: "flex-end" }}>
        {points.map((p, i) => {
          const pct = p.cloudCoverPct as number;
          const clarity = 100 - pct;
          return (
            <div
              key={i}
              title={`${formatHour(p.time)} : ${Math.round(pct)}% de nuages`}
              style={{
                flex: 1,
                height: `${Math.max(4, Math.round(pct))}%`,
                borderRadius: 3,
                background: qualityColor(clarity / 100),
              }}
            />
          );
        })}
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
