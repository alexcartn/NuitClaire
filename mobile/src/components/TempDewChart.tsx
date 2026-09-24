import type { HourlyPoint } from "../types";

const WIDTH = 300;
const HEIGHT = 70;
const TEMP_COLOR = "var(--accent)";
const DEW_COLOR = "var(--ink2)";

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

function toPolyline(values: number[], min: number, span: number): string {
  return values
    .map((v, i) => {
      const x = values.length > 1 ? (i / (values.length - 1)) * WIDTH : WIDTH / 2;
      const y = HEIGHT - ((v - min) / span) * HEIGHT;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/** Temperature (`temperature_2m`) et point de rosee (`dew_point_2m`), memes
 * colonnes que app.py::_render_time_series(view_df, [...]) -- deux courbes
 * plutot qu'un ecart chiffre, pour voir directement quand elles se
 * rapprochent (risque de buee). */
export function TempDewChart({ hourly, buckets = 24 }: { hourly: HourlyPoint[]; buckets?: number }) {
  const points = downsample(hourly, buckets).filter(
    (p) => p.temperatureC != null && p.dewPointC != null,
  );
  if (points.length === 0) return null;

  const temps = points.map((p) => p.temperatureC as number);
  const dews = points.map((p) => p.dewPointC as number);
  const min = Math.min(...temps, ...dews) - 1;
  const max = Math.max(...temps, ...dews) + 1;
  const span = Math.max(1, max - min);
  const mid = points[Math.floor((points.length - 1) / 2)];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <div style={{ display: "flex", gap: "var(--space-sm)", fontSize: "var(--text-xs)", color: "var(--ink2)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: TEMP_COLOR, display: "inline-block" }} />
          Temperature
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: DEW_COLOR, display: "inline-block" }} />
          Point de rosee
        </span>
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" height={HEIGHT} preserveAspectRatio="none">
        <polyline points={toPolyline(dews, min, span)} fill="none" stroke={DEW_COLOR} strokeWidth={2} />
        <polyline points={toPolyline(temps, min, span)} fill="none" stroke={TEMP_COLOR} strokeWidth={2} />
      </svg>
      <div
        className="nc-num"
        style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)", color: "var(--ink3)" }}
      >
        <span>{formatHour(points[0].time)}</span>
        <span>{formatHour(mid.time)}</span>
        <span>{formatHour(points[points.length - 1].time)}</span>
      </div>
    </div>
  );
}
