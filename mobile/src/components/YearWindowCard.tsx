import { describeYear, MIN_NIGHT_HOURS, yearBar } from "../yearWindowView";
import type { TargetYear } from "../types";

/** La saison de la cible sur les 12 mois qui viennent : de quelle date a quelle
 * date elle est atteignable depuis la position, ou pourquoi elle ne l'est
 * jamais. Sans meteo ni Lune, qu'on ne connait pas a l'avance. */
export function YearWindowCard({ year }: { year: TargetYear }) {
  const today = new Date();
  const view = describeYear(year, today);
  const bar = view.hasBar ? yearBar(year, today) : null;

  return (
    <div className="nc-card nc-stack-xs">
      <div className="nc-eyebrow">Dans l'année</div>
      <div style={{ fontSize: "var(--text-md)", color: "var(--ink)" }}>{view.headline}</div>
      {view.detail && <span className="nc-caption" style={{ fontSize: "var(--text-sm)", color: "var(--ink2)" }}>{view.detail}</span>}

      {bar && (
        <div role="img" aria-label={`${view.headline}. ${view.rows.map((r) => r.join(", ")).join(" ; ")}`}
          style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: "var(--space-xs)" }}>
          {/* Le trait d'aujourd'hui depasse de la barre : en mode nuit tout est
              rouge et une barre pleine l'avalerait, c'est la forme qui le
              distingue, pas la teinte. */}
          <div style={{ position: "relative", height: 16, display: "flex", alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1, height: 10, borderRadius: 5, overflow: "hidden", background: "var(--bar)" }}>
              {bar.segments.map((s, i) => (
                <div key={i} style={{ position: "absolute", top: 0, bottom: 0, left: `${s.left}%`, width: `${s.width}%`, background: "var(--accent)" }} />
              ))}
            </div>
            <div style={{ position: "absolute", top: 0, bottom: 0, left: `calc(${bar.today}% - 1px)`, width: 2, background: "var(--ink)", boxShadow: "0 0 0 1px var(--surf)" }} />
          </div>
          <div style={{ position: "relative", height: 14 }}>
            {bar.months.map((m, i) => (
              <span key={i} className="nc-caption nc-num" style={{ position: "absolute", left: `${m.left}%`, width: `${m.width}%`, textAlign: "center" }}>
                {m.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {view.rows.length > 0 && (
        <>
          <div className="nc-divider" />
          {view.rows.map(([dates, gain]) => (
            <div key={dates} style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
              <span className="nc-num" style={{ fontSize: "var(--text-sm)" }}>{dates}</span>
              <span className="nc-caption nc-num">{gain}</span>
            </div>
          ))}
        </>
      )}

      {view.hasBar && (
        <span className="nc-caption">
          Nuits noires où la cible reste au moins {MIN_NIGHT_HOURS} h pointable, horizon compris. Météo et Lune non comptées.
        </span>
      )}
    </div>
  );
}
