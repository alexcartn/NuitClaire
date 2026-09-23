import type { HourlyPoint } from "../types";
import { qualityColor, windQuality } from "../quality";

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

/** Rafales (`wind_gusts_10m`, meme colonne que app.py::_wind_chart) heure par
 * heure -- colorees par scoring.wind_quality (rouge >= 40 km/h). Domaine Y
 * auto (comme le graphe Streamlit), plancher a 20 km/h pour eviter des
 * barres ecrasees par grand calme. */
export function WindChart({ hourly, buckets = 13 }: { hourly: HourlyPoint[]; buckets?: number }) {
  const points = downsample(hourly, buckets).filter((p) => p.windGustsKmh != null);
  if (points.length === 0) return null;
  const mid = points[Math.floor((points.length - 1) / 2)];
  const domainMax = Math.max(20, ...points.map((p) => p.windGustsKmh as number));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <div style={{ display: "flex", gap: 3, height: 60, alignItems: "flex-end" }}>
        {points.map((p, i) => {
          const kmh = p.windGustsKmh as number;
          return (
            <div
              key={i}
              title={`${formatHour(p.time)} : rafales ${Math.round(kmh)} km/h`}
              style={{
                flex: 1,
                height: `${Math.max(4, Math.round((kmh / domainMax) * 100))}%`,
                borderRadius: 3,
                background: qualityColor(windQuality(kmh)),
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
