import { useCallback, useState } from "react";
import { api } from "../api";
import { useFetch } from "../useFetch";
import { ScoreCard } from "../components/ScoreCard";
import { StatCard } from "../components/StatCard";
import { SectorChips } from "../components/SectorChips";
import { CloudChart } from "../components/CloudChart";
import { WindChart } from "../components/WindChart";
import { TempDewChart } from "../components/TempDewChart";

const CLOUD_TREND_ICON: Record<string, string> = {
  amelioration: "🟢",
  stable: "🟡",
  degradation: "🔴",
};

function todayLabel(): string {
  const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const MONTHS = [
    "janvier", "fevrier", "mars", "avril", "mai", "juin",
    "juillet", "aout", "septembre", "octobre", "novembre", "decembre",
  ];
  const d = new Date();
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function CeSoir({
  onGoTargets,
  onSearch,
}: {
  onGoTargets: () => void;
  onSearch: () => void;
}) {
  const [meteoOpen, setMeteoOpen] = useState(false);

  const fetchNight = useCallback(() => api.night(), []);
  const fetchState = useCallback(() => api.state(), []);
  const fetchTargets = useCallback(() => api.targets(), []);
  const fetchMessier = useCallback(() => api.messier(true), []);

  const night = useFetch(fetchNight, []);
  const state = useFetch(fetchState, []);
  const targets = useFetch(fetchTargets, []);
  const messier = useFetch(fetchMessier, []);

  if (night.loading || state.loading) {
    return (
      <div className="nc-screen">
        <p className="nc-caption">Chargement meteo + ephemerides...</p>
      </div>
    );
  }
  if (night.error || !night.data || state.error || !state.data) {
    return (
      <div className="nc-screen">
        <p className="nc-caption">Impossible de recuperer les donnees. Reessayez dans quelques instants.</p>
      </div>
    );
  }

  const n = night.data;
  const captured = new Set(state.data.messierCaptured);
  const uncapturedMessier =
    messier.data?.filter((r) => r.messierId && !captured.has(r.messierId)).length ?? 0;
  const targetCount = targets.data?.length ?? 0;

  return (
    <div className="nc-screen">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div className="nc-eyebrow">Ce soir</div>
          <div className="nc-title">{todayLabel()}</div>
          <div className="nc-sub">
            {state.data.site.name} · {state.data.site.lat.toFixed(2)}°N {state.data.site.lon.toFixed(2)}°E
          </div>
        </div>
        <button
          onClick={onSearch}
          className="nc-btn"
          style={{ width: 40, height: 40, flex: "none", borderRadius: 20, padding: 0, fontSize: 17 }}
        >
          ⌕
        </button>
      </div>

      <ScoreCard night={n} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 9 }}>
        <StatCard
          label="Lune"
          value={
            <>
              {Math.round(n.moonIllum)}
              <span style={{ fontSize: 13, color: "var(--ink3)" }}>%</span>
            </>
          }
          sub={`${n.moonWaxing ? "Croissante" : "Decroissante"} · ${n.moonSizeArcmin.toFixed(1)}'`}
        />
        <StatCard
          label="Buee"
          value={<span style={{ fontSize: 20 }}>{n.dewRisk}</span>}
          sub={`Anti-buee : ${n.dewAdvice}`}
        />
        <StatCard
          label="Rafales"
          value={
            n.windGustsKmh != null ? (
              <>
                {Math.round(n.windGustsKmh)}
                <span style={{ fontSize: 11, color: "var(--ink3)" }}> km/h</span>
              </>
            ) : (
              "n/d"
            )
          }
        />
      </div>

      <button
        onClick={onGoTargets}
        className="nc-btn nc-btn-primary"
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "left", padding: "17px 18px", borderRadius: 16 }}
      >
        <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 16 }}>{targetCount} cibles pointables ce soir</span>
          <span style={{ fontSize: 12, opacity: 0.7 }}>dont {uncapturedMessier} Messier pas encore captures</span>
        </span>
        <span className="nc-mono" style={{ fontSize: 16 }}>
          →
        </span>
      </button>

      <div className="nc-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div className="nc-eyebrow">Horizon degage</div>
        </div>
        <SectorChips horizon={state.data.horizon} />
      </div>

      <button onClick={() => setMeteoOpen((v) => !v)} className="nc-btn" style={{ display: "flex", justifyContent: "space-between" }}>
        <span>Details meteo</span>
        <span style={{ fontSize: 12, color: "var(--ink3)" }}>{meteoOpen ? "masquer" : "nuages · rosee · vent"}</span>
      </button>

      {meteoOpen && (
        <div className="nc-card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="nc-eyebrow">Nuages</div>
            {n.cloudTrend ? (
              <p style={{ margin: 0, fontSize: 13 }}>
                {CLOUD_TREND_ICON[n.cloudTrend.direction]} {n.cloudTrend.label} attendue : nuages{" "}
                {Math.round(n.cloudTrend.nowPct)}% → {Math.round(n.cloudTrend.futurePct)}% dans les prochaines
                heures.
              </p>
            ) : (
              <p className="nc-caption" style={{ margin: 0 }}>
                Tendance nuages indisponible (nuit differente d'aujourd'hui, ou pas assez d'heures a venir).
              </p>
            )}
            <CloudChart hourly={n.hourly} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="nc-eyebrow">Point de rosee</div>
            <p style={{ margin: 0, fontSize: 13 }}>
              Ecart temperature/point de rosee : {n.dewSpread != null ? `${n.dewSpread.toFixed(1)}°` : "n/d"} (
              {n.dewRisk.toLowerCase()}).
            </p>
            <TempDewChart hourly={n.hourly} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="nc-eyebrow">Vent</div>
            <WindChart hourly={n.hourly} />
          </div>

          <p className="nc-caption" style={{ margin: 0 }}>
            Open-Meteo AROME 1.3 km · seeing et transparence 7Timer ASTRO.
          </p>
        </div>
      )}
    </div>
  );
}
