import { useState } from "react";
import { StatCard } from "../components/StatCard";
import { Section } from "../components/Section";
import { plural } from "../format";
import { lastMonths, localMonthKey, monthInitial, monthLabel } from "../statsView";
import { fmtExposure } from "./format";
import type { Stats } from "../types";

type Measure = "outings" | "captures";

export function JournalStats({ stats, onOpenTarget }: { stats: Stats; onOpenTarget: (designation: string) => void }) {
  if (stats.totalOutings === 0) return null;
  const now = new Date();
  const thisMonth = stats.capturesByMonth.find((m) => m.month === localMonthKey(now))?.count ?? 0;
  return (
    // Repliee par defaut : utile a la relecture, pas pendant la saisie. Rien
    // en resume dans l'en-tete, les chiffres ne s'affichent qu'a la demande.
    <Section id="journal-stats" title="Statistiques" defaultOpen={false}>
      {/* Le chiffre qui compte en tete, le reste en appui. */}
      <div className="nc-stack-xs">
        <div className="nc-row" style={{ alignItems: "baseline", gap: "var(--space-xs)" }}>
          <span className="nc-num" style={{ fontSize: "var(--text-xl)", fontWeight: 500 }}>{stats.totalOutings}</span>
          <span style={{ fontSize: "var(--text-sm)" }}>{stats.totalOutings < 2 ? "sortie" : "sorties"}</span>
        </div>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--ink2)" }}>
          {plural(stats.successfulOutings, "réussie", "réussies")} · {fmtExposure(stats.totalExposureMin)} d'expo
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "var(--space-xs)" }}>
        <StatCard
          label="Ciel moyen"
          value={stats.avgScoreSuccessful != null ? stats.avgScoreSuccessful : "n/d"}
          sub="nuits réussies"
        />
        <StatCard
          label="Note"
          value={stats.avgRating != null ? `${stats.avgRating}/5` : "n/d"}
          sub={plural(stats.ratedOutings, "notée", "notées")}
        />
        <StatCard label="Ce mois" value={thisMonth} sub={thisMonth < 2 ? "capturée" : "capturées"} />
      </div>
      <MonthChart stats={stats} now={now} />
      {stats.outingsBySite.length > 0 && (
        <RankedBars
          title="Lieux d'observation"
          rows={stats.outingsBySite.map((s) => ({
            key: s.name,
            label: s.name,
            sub: `dernière ${shortDate(s.lastDate)}`,
            value: s.count,
            valueText: plural(s.count, "sortie", "sorties"),
          }))}
          limit={5}
        />
      )}
      {stats.exposureByTarget.length > 0 && (
        <RankedBars
          title="Expo cumulée par cible"
          rows={stats.exposureByTarget.map((e) => ({
            key: e.designation,
            label: e.designation,
            value: e.totalMin,
            valueText: fmtExposure(e.totalMin),
            onOpen: () => onOpenTarget(e.designation),
          }))}
          limit={6}
        />
      )}
    </Section>
  );
}

function shortDate(isoDate: string): string {
  return new Date(isoDate + "T00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/** Douze mois glissants en barres. Un appui sur un mois l'affiche en toutes
 * lettres sous le graphique : c'est l'infobulle, lisible au doigt. */
function MonthChart({ stats, now }: { stats: Stats; now: Date }) {
  const [measure, setMeasure] = useState<Measure>("outings");
  const bars = lastMonths(stats.outingsByMonth, stats.capturesByMonth, now);
  const [selected, setSelected] = useState(bars.length - 1);
  const max = Math.max(1, ...bars.map((b) => b[measure]));
  const picked = bars[selected];
  return (
    <div className="nc-stack-xs">
      <div className="nc-row nc-between">
        <span className="nc-caption">12 derniers mois</span>
        <div className="nc-segmented" role="radiogroup" aria-label="Mesure" style={{ width: 190 }}>
          {(["outings", "captures"] as const).map((m) => (
            <button
              key={m}
              role="radio"
              aria-checked={measure === m}
              onClick={() => setMeasure(m)}
              className={measure === m ? "nc-segment nc-segment-active" : "nc-segment"}
              style={{ minHeight: 32 }}
            >
              {m === "outings" ? "Sorties" : "Captures"}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 2, height: 96, alignItems: "stretch" }}>
        {bars.map((b, i) => (
          <button
            key={b.month}
            onClick={() => setSelected(i)}
            aria-label={`${monthLabel(b.month)} : ${b[measure]}`}
            aria-pressed={i === selected}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              alignItems: "stretch",
              padding: 0,
              border: "none",
              background: "none",
              cursor: "pointer",
            }}
          >
            {b[measure] > 0 && (
              <span className="nc-num" style={{ fontSize: "var(--text-xs)", color: i === selected ? "var(--ink)" : "transparent", marginBottom: 2 }}>
                {b[measure]}
              </span>
            )}
            <span
              style={{
                height: b[measure] > 0 ? `${Math.max(4, (b[measure] / max) * 72)}px` : 2,
                borderRadius: b[measure] > 0 ? "4px 4px 0 0" : 0,
                background: b[measure] > 0 ? "var(--accent)" : "var(--line)",
                opacity: i === selected || b[measure] === 0 ? 1 : 0.55,
              }}
            />
          </button>
        ))}
      </div>
      <div className="nc-num" style={{ display: "flex", gap: 2, fontSize: "var(--text-xs)", color: "var(--ink3)" }}>
        {bars.map((b, i) => (
          <span key={b.month} style={{ flex: 1, textAlign: "center", color: i === selected ? "var(--ink)" : undefined }}>
            {monthInitial(b.month)}
          </span>
        ))}
      </div>
      <div style={{ fontSize: "var(--text-sm)", color: "var(--ink2)" }}>
        {monthLabel(picked.month)} : {plural(picked.outings, "sortie", "sorties")} ·{" "}
        {plural(picked.captures, "cible capturée", "cibles capturées")}
      </div>
    </div>
  );
}

interface RankedRow {
  key: string;
  label: string;
  sub?: string;
  value: number;
  valueText: string;
  onOpen?: () => void;
}

/** Classement en barres fines, a l'echelle du premier. Au-dela de `limit`,
 * « Tout voir » deplie le reste plutot que de le taire. */
function RankedBars({ title, rows, limit }: { title: string; rows: RankedRow[]; limit: number }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, limit);
  const max = Math.max(1, ...rows.map((r) => r.value));
  const hidden = rows.length - limit;
  return (
    <div className="nc-stack-xs">
      <div className="nc-caption">{title}</div>
      {shown.map((r) => (
        <div key={r.key} className="nc-stack-xs" style={{ gap: "var(--space-2xs)" }}>
          <div className="nc-row nc-between" style={{ fontSize: "var(--text-sm)" }}>
            {r.onOpen ? (
              <button
                onClick={r.onOpen}
                className="nc-link nc-num nc-ellipsis"
                style={{ minHeight: 0, fontSize: "var(--text-sm)", color: "var(--ink)", fontWeight: 500 }}
              >
                {r.label}
              </button>
            ) : (
              <span className="nc-ellipsis">
                {r.label}
                {r.sub && <span style={{ color: "var(--ink3)", fontSize: "var(--text-xs)" }}> · {r.sub}</span>}
              </span>
            )}
            <span className="nc-num nc-none" style={{ color: "var(--ink2)" }}>{r.valueText}</span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: "var(--line)" }}>
            <div
              style={{ width: `${(r.value / max) * 100}%`, height: "100%", borderRadius: 2, background: "var(--accent)" }}
            />
          </div>
        </div>
      ))}
      {hidden > 0 && (
        <button onClick={() => setAll((v) => !v)} className="nc-link nc-link-accent">
          {all ? "Réduire" : `Tout voir (+${hidden})`}
        </button>
      )}
    </div>
  );
}
