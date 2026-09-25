import { useCallback, useState } from "react";
import { api } from "../api";
import { useFetch } from "../useFetch";
import { fmtLatLon, plural, targetsCacheKey } from "../format";
import { StaleNotice } from "../components/StaleNotice";
import { ErrorNotice } from "../components/ErrorNotice";
import { ScreenHeader } from "../components/ScreenHeader";
import { TabIcon } from "../components/TabIcon";
import { ScoreCard } from "../components/ScoreCard";
import { StatCard } from "../components/StatCard";
import { SectorChips } from "../components/SectorChips";
import { NightStrip } from "../components/NightStrip";
import { NightPlan } from "../components/NightPlan";
import { NightExtras } from "../components/NightExtras";
import { CloudChart } from "../components/CloudChart";
import { WindChart } from "../components/WindChart";
import { TempDewChart } from "../components/TempDewChart";
import type { CloudTrend, Instrument } from "../types";

/** Tendance nuages : un mot et une fleche, dans la couleur de l'echelle de
 * qualite. Les pastilles emoji d'avant (vert, jaune, rouge) s'affichaient en
 * couleur jusque dans le mode vision nocturne, ou tout doit etre rouge. */
const CLOUD_TREND: Record<CloudTrend["direction"], { arrow: string; color: string }> = {
  amelioration: { arrow: "↘", color: "var(--good)" },
  stable: { arrow: "→", color: "var(--mid)" },
  degradation: { arrow: "↗", color: "var(--bad)" },
};

const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function todayLabel(): string {
  const d = new Date();
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function CeSoir({
  instrument,
  onGoTargets,
  onSearch,
  onOpenSky,
  onOpenTarget,
}: {
  instrument: Instrument;
  onGoTargets: () => void;
  onSearch: () => void;
  onOpenSky: () => void;
  onOpenTarget: (designation: string) => void;
}) {
  const [meteoOpen, setMeteoOpen] = useState(false);

  const fetchNight = useCallback(() => api.night(), []);
  const fetchNights = useCallback(() => api.nights(), []);
  const fetchState = useCallback(() => api.state(), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchTargets = useCallback(() => api.targets(), [instrument]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchMessier = useCallback(() => api.messier(true), [instrument]);

  // Cles de cache : la derniere reponse reussie est reaffichee au demarrage,
  // avant meme la requete, pour que l'appli installee montre quelque chose
  // sans reseau (voir useFetch).
  const night = useFetch(fetchNight, [], "night");
  const nights = useFetch(fetchNights, [], "nights");
  const state = useFetch(fetchState, [], "state");
  const targets = useFetch(fetchTargets, [instrument], targetsCacheKey(instrument));
  const messier = useFetch(fetchMessier, [instrument], `messier:true:${instrument}`);
  const stale = (night.error || state.error) && night.data && state.data;

  const reloadAll = () => {
    night.reload();
    nights.reload();
    state.reload();
    targets.reload();
    messier.reload();
  };
  const refreshing = night.loading || targets.loading;

  if ((night.loading && !night.data) || (state.loading && !state.data)) {
    return (
      <div className="nc-screen">
        <p className="nc-caption">Chargement météo et éphémérides…</p>
      </div>
    );
  }
  if (!night.data || !state.data) {
    return (
      <div className="nc-screen">
        <ErrorNotice message="Impossible de récupérer la prévision de la nuit." onRetry={reloadAll} />
      </div>
    );
  }

  const n = night.data;
  const site = state.data.site;
  const binoculars = instrument === "jumelles";
  const captured = new Set((binoculars ? state.data.messierSeen : state.data.messierCaptured) ?? []);
  const uncapturedMessier =
    messier.data?.filter((r) => r.messierId && !captured.has(r.messierId)).length ?? 0;
  // Rien tant que la liste n'est pas la : « 0 cible » pendant le
  // chargement affirmait une nuit vide.
  const targetCount = targets.data?.length ?? null;
  const trend = n.cloudTrend ? CLOUD_TREND[n.cloudTrend.direction] : null;

  return (
    <div className="nc-screen">
      {stale && <StaleNotice when={night.fetchedAt} />}
      <ScreenHeader
        eyebrow="Ce soir"
        title={todayLabel()}
        sub={
          <>
            {site.name} · <span className="nc-num">{fmtLatLon(site.lat, site.lon)}</span>
          </>
        }
        actions={
          <>
            <button
              onClick={reloadAll}
              disabled={refreshing}
              className="nc-round-btn"
              aria-label="Actualiser la prévision"
              title="Actualiser la prévision"
            >
              <TabIcon name="refresh" />
            </button>
            <button onClick={onOpenSky} className="nc-round-btn" aria-label="Carte du ciel" title="Carte du ciel">
              <TabIcon name="sky" />
            </button>
            <button onClick={onSearch} className="nc-round-btn" aria-label="Rechercher un objet" title="Rechercher un objet">
              <TabIcon name="search" />
            </button>
          </>
        }
      />

      <ScoreCard night={n} />

      {nights.data && <NightStrip nights={nights.data} />}

      <div className="nc-grid-2">
        <StatCard
          label="Température"
          value={
            n.tempNowC != null ? (
              <>
                {Math.round(n.tempNowC)}
                <span className="nc-unit">°C</span>
              </>
            ) : (
              "n/d"
            )
          }
          sub={
            n.tempMinC != null && n.tempMaxC != null
              ? `${Math.round(n.tempMinC)}° → ${Math.round(n.tempMaxC)}° cette nuit`
              : undefined
          }
        />
        <StatCard
          label="Lune"
          value={
            <>
              {Math.round(n.moonIllum)}
              <span className="nc-unit">%</span>
            </>
          }
          sub={`${n.moonWaxing ? "Croissante" : "Décroissante"} · ${n.moonSizeArcmin.toFixed(1)}'`}
        />
        <StatCard label="Buée" valueIsWord value={n.dewRisk} sub={`Anti-buée : ${n.dewAdvice}`} />
        <StatCard
          label="Rafales"
          value={
            n.windGustsKmh != null ? (
              <>
                {Math.round(n.windGustsKmh)}
                <span className="nc-unit"> km/h</span>
              </>
            ) : (
              "n/d"
            )
          }
        />
      </div>

      <button onClick={onGoTargets} className="nc-btn nc-btn-primary nc-cta">
        <span className="nc-stack-xs" style={{ gap: "var(--space-2xs)" }}>
          <span style={{ fontSize: "var(--text-md)" }}>
            {targetCount != null
              ? `${plural(targetCount, "cible pointable", "cibles pointables")} ce soir`
              : "Cibles de ce soir"}
          </span>
          <span style={{ fontSize: "var(--text-xs)", opacity: 0.75 }}>
            {targetCount != null && messier.data
              ? `${binoculars ? "aux jumelles, " : ""}dont ${plural(uncapturedMessier, `Messier pas encore ${binoculars ? "vu" : "capturé"}`, `Messier pas encore ${binoculars ? "vus" : "capturés"}`)}`
              : "calcul des créneaux…"}
          </span>
        </span>
        <span style={{ fontSize: "var(--text-md)" }} aria-hidden="true">→</span>
      </button>

      {targets.data && <NightPlan rows={targets.data} binoculars={binoculars} onOpenTarget={onOpenTarget} />}

      <NightExtras />

      <div className="nc-card nc-stack">
        <div className="nc-eyebrow">Horizon dégagé</div>
        <SectorChips horizon={state.data.horizon} horizonAlt={state.data.horizonAlt} />
      </div>

      <button onClick={() => setMeteoOpen((v) => !v)} className="nc-btn nc-row nc-between" aria-expanded={meteoOpen}>
        <span>Détails météo</span>
        <span className="nc-caption">{meteoOpen ? "masquer" : "nuages · rosée · vent"}</span>
      </button>

      {meteoOpen && (
        <div className="nc-card nc-stack" style={{ gap: "var(--space-md)" }}>
          <div className="nc-stack-xs">
            <div className="nc-eyebrow">Nuages</div>
            {n.cloudTrend && trend ? (
              <p style={{ margin: 0, fontSize: "var(--text-sm)" }}>
                <span style={{ color: trend.color }} aria-hidden="true">{trend.arrow}</span>{" "}
                {n.cloudTrend.label} attendue : nuages{" "}
                <span className="nc-num">
                  {Math.round(n.cloudTrend.nowPct)} % → {Math.round(n.cloudTrend.futurePct)} %
                </span>{" "}
                dans les prochaines heures.
              </p>
            ) : (
              <p className="nc-caption" style={{ margin: 0 }}>
                Tendance nuages indisponible (nuit différente d'aujourd'hui, ou pas assez d'heures à venir).
              </p>
            )}
            <CloudChart hourly={n.hourly} />
          </div>

          <div className="nc-stack-xs">
            <div className="nc-eyebrow">Point de rosée</div>
            <p style={{ margin: 0, fontSize: "var(--text-sm)" }}>
              Écart température/point de rosée :{" "}
              <span className="nc-num">{n.dewSpread != null ? `${n.dewSpread.toFixed(1)}°` : "n/d"}</span> (
              {n.dewRisk.toLowerCase()}).
            </p>
            <TempDewChart hourly={n.hourly} />
          </div>

          <div className="nc-stack-xs">
            <div className="nc-eyebrow">Vent</div>
            <WindChart hourly={n.hourly} />
          </div>

          <p className="nc-caption" style={{ margin: 0 }}>
            Open-Meteo AROME 1,3 km · seeing et transparence 7Timer ASTRO.
          </p>
        </div>
      )}
    </div>
  );
}
