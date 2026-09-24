import { useEffect, useState } from "react";
import { api } from "../api";
import { COMPASS_SECTORS } from "../types";

/** Ce que l'on peut dire d'un secteur : bouche, ou degage a partir d'une
 * hauteur. Des paliers plutot qu'un curseur : dehors, de nuit, on estime
 * « les arbres montent a 20-30 deg », pas 23. */
const LEVELS: { label: string; open: boolean; alt: number }[] = [
  { label: "Bouché", open: false, alt: 0 },
  { label: "Libre", open: true, alt: 0 },
  { label: "10°", open: true, alt: 10 },
  { label: "20°", open: true, alt: 20 },
  { label: "30°", open: true, alt: 30 },
  { label: "45°", open: true, alt: 45 },
];

export interface SectorState {
  open: boolean;
  alt: number;
}

export function sectorLabel(s: SectorState): string {
  if (!s.open) return "bouché";
  return s.alt > 0 ? `dès ${s.alt}°` : "libre";
}

/** « N · NE · S dès 20° » : les secteurs ouverts, pour un resume. */
export function horizonSummary(profile: Record<string, SectorState>): string {
  const open = COMPASS_SECTORS.filter((s) => profile[s]?.open);
  if (open.length === 0) return "tout bouché";
  if (open.length === COMPASS_SECTORS.length && open.every((s) => !profile[s].alt)) return "tout libre";
  return open.map((s) => (profile[s].alt ? `${s} ${profile[s].alt}°` : s)).join(" · ");
}

/** Horizon avec hauteurs : chaque secteur est bouche, ou degage a partir
 * d'une hauteur (arbres, toits, colline). On touche un secteur, puis son
 * palier. Le changement s'affiche tout de suite et revient en arriere, en le
 * disant, si le serveur ne l'a pas pris. */
export function HorizonEditor({ horizon, horizonAlt, facing, onSaved }: {
  horizon: Record<string, boolean>;
  horizonAlt: Record<string, number>;
  /** Secteur vise par la boussole, s'il y en a une. */
  facing: string | null;
  onSaved: () => void;
}) {
  const fromServer = () =>
    Object.fromEntries(COMPASS_SECTORS.map((s) => [s, { open: !!horizon[s], alt: horizonAlt[s] ?? 0 }]));
  const [profile, setProfile] = useState<Record<string, SectorState>>(fromServer);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setProfile(fromServer()), [horizon, horizonAlt]);

  // Sans choix explicite, le secteur vise par la boussole est celui qu'on regle.
  const current = selected ?? facing;

  const setLevel = async (sector: string, level: SectorState) => {
    const before = profile[sector];
    setProfile((p) => ({ ...p, [sector]: level }));
    setError(null);
    try {
      await api.updateHorizon(sector, level.open, level.alt);
      onSaved();
    } catch {
      setProfile((p) => ({ ...p, [sector]: before }));
      setError(`${sector} non enregistré : pas de réseau ? Réessayez.`);
    }
  };

  return (
    <div className="nc-stack">
      <p className="nc-caption" style={{ margin: 0 }}>
        Touchez une direction, puis dites à partir de quelle hauteur le ciel y est libre (arbres, toits).
      </p>
      <div className="nc-horizon-grid">
        {COMPASS_SECTORS.map((s) => {
          const st = profile[s];
          return (
            <button
              key={s}
              onClick={() => setSelected(s === selected ? null : s)}
              className={[
                "nc-horizon-cell",
                st.open ? "nc-horizon-open" : "",
                s === current ? "nc-horizon-current" : "",
              ].join(" ")}
              aria-pressed={s === current}
              aria-label={`${s} : ${sectorLabel(st)}`}
            >
              <span className="nc-num" style={{ fontSize: "var(--text-sm)" }}>{s}</span>
              <span style={{ fontSize: "var(--text-xs)" }}>{sectorLabel(st)}</span>
            </button>
          );
        })}
      </div>

      {current && (
        <div className="nc-stack-xs">
          <span className="nc-caption" style={{ color: "var(--ink2)" }}>
            {current}
            {current === facing && !selected ? " (direction visée)" : ""} :
          </span>
          <div className="nc-row nc-wrap" style={{ gap: "var(--space-xs)" }} role="radiogroup" aria-label={`Hauteur libre au ${current}`}>
            {LEVELS.map((l) => {
              const st = profile[current];
              const active = st.open === l.open && (!l.open || st.alt === l.alt);
              return (
                <button
                  key={l.label}
                  role="radio"
                  aria-checked={active}
                  onClick={() => setLevel(current, { open: l.open, alt: l.alt })}
                  className={`nc-chip ${active ? "nc-chip-active" : ""}`}
                >
                  {l.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {error && <div className="nc-notice" role="alert">{error}</div>}
    </div>
  );
}
