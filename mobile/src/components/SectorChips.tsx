import { COMPASS_SECTORS } from "../types";

/** Apercu de l'horizon sur « Ce soir » : secteurs degages pleins, avec leur
 * hauteur libre quand il y en a une (« S 20° »). */
export function SectorChips({ horizon, horizonAlt }: {
  horizon: Record<string, boolean>;
  horizonAlt?: Record<string, number>;
}) {
  return (
    <div className="nc-row nc-wrap" style={{ gap: "var(--space-xs)" }}>
      {COMPASS_SECTORS.map((s) => {
        const alt = horizonAlt?.[s] ?? 0;
        return (
          <div
            key={s}
            className={`nc-chip nc-num ${horizon[s] ? "nc-horizon-open" : ""}`}
            style={{ cursor: "default" }}
            aria-label={horizon[s] ? `${s} dégagé${alt ? ` à partir de ${alt}°` : ""}` : `${s} bouché`}
          >
            {s}
            {horizon[s] && alt > 0 ? ` ${alt}°` : ""}
          </div>
        );
      })}
    </div>
  );
}
