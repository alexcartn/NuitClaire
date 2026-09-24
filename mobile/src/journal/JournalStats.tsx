import { StatCard } from "../components/StatCard";
import { plural } from "../format";
import { fmtExposure } from "./format";
import type { Stats } from "../types";

export function JournalStats({ stats }: { stats: Stats }) {
  if (stats.totalOutings === 0) return null;
  const thisMonth = stats.capturesByMonth.find((m) => m.month === new Date().toISOString().slice(0, 7))?.count ?? 0;
  return (
    <div className="nc-card nc-stack">
      <div className="nc-eyebrow">Statistiques</div>
      <div className="nc-grid-2">
        <StatCard
          label="Sorties"
          value={stats.totalOutings}
          sub={plural(stats.successfulOutings, "réussie", "réussies")}
        />
        <StatCard
          label="Score moyen"
          value={stats.avgScoreSuccessful != null ? stats.avgScoreSuccessful : "n/d"}
          sub="sorties réussies"
        />
        <StatCard label="Expo totale" value={fmtExposure(stats.totalExposureMin)} />
        <StatCard
          label="Satisfaction"
          value={stats.avgRating != null ? `${stats.avgRating}/5` : "n/d"}
          sub={plural(stats.ratedOutings, "sortie notée", "sorties notées")}
        />
        <StatCard
          label="Ce mois"
          value={thisMonth}
          sub={thisMonth < 2 ? "cible capturée" : "cibles capturées"}
        />
      </div>
      {stats.outingsBySite.length > 0 && (
        <div className="nc-stack-xs">
          <div className="nc-caption">Lieux d'observation</div>
          {stats.outingsBySite.slice(0, 5).map((s) => (
            <div key={s.name} className="nc-row nc-between" style={{ fontSize: "var(--text-sm)" }}>
              <span className="nc-ellipsis">{s.name}</span>
              <span className="nc-num nc-none" style={{ color: "var(--ink2)" }}>
                {plural(s.count, "sortie", "sorties")}
              </span>
            </div>
          ))}
        </div>
      )}
      {stats.exposureByTarget.length > 0 && (
        <div className="nc-stack-xs">
          <div className="nc-caption">Expo cumulée par cible</div>
          {stats.exposureByTarget.slice(0, 6).map((e) => (
            <div key={e.designation} className="nc-row nc-between" style={{ fontSize: "var(--text-sm)" }}>
              <span className="nc-num">{e.designation}</span>
              <span className="nc-num" style={{ color: "var(--ink2)" }}>{fmtExposure(e.totalMin)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
