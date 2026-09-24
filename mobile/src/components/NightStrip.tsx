import { qualityColor } from "../quality";
import type { NightBrief } from "../types";

const WEEKDAYS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

function dayLabel(isoDate: string, index: number): string {
  if (index === 0) return "Ce soir";
  if (index === 1) return "Demain";
  const d = new Date(isoDate + "T00:00");
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()}`;
}

/** Ce soir et les deux nuits suivantes : « si ce n'est pas ce soir, quand ? ».
 *
 * Le score garde la couleur de l'echelle de qualite, comme sur la grande
 * carte ; une nuit que la prevision ne couvre pas assez affiche un tiret et
 * le dit, plutot qu'un chiffre calcule sur des trous. */
export function NightStrip({ nights }: { nights: NightBrief[] }) {
  if (nights.length < 2) return null;
  return (
    <div className="nc-stack-xs">
      <div className="nc-eyebrow">Prochaines nuits</div>
      <div className="nc-night-strip">
        {nights.map((n, i) => (
          <div key={n.date} className={`nc-night-day ${i === 0 ? "nc-night-day-today" : ""}`}>
            <span className="nc-caption" style={{ margin: 0 }}>{dayLabel(n.date, i)}</span>
            {n.scorePct != null ? (
              <span
                className="nc-num"
                style={{ fontSize: "var(--text-lg)", fontWeight: 500, color: qualityColor(n.scorePct / 100) }}
              >
                {n.scorePct}
              </span>
            ) : (
              <span className="nc-num" style={{ fontSize: "var(--text-lg)", color: "var(--ink3)" }}>–</span>
            )}
            <span className="nc-caption nc-num" style={{ margin: 0 }}>
              {n.scorePct != null
                ? n.bestWindow ?? `lune ${Math.round(n.moonIllum)} %`
                : "pas encore prévue"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
