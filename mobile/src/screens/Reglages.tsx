import { useCallback } from "react";
import { api } from "../api";
import { useFetch } from "../useFetch";
import { useTheme } from "../useTheme";
import { COMPASS_SECTORS } from "../types";

const WINDOW_MODE_LABEL: Record<string, string> = {
  complete: "Nuit complete",
  habituelle: "Habituelle (20:00–22:30)",
};

const ALERT_LABEL: Record<string, string> = {
  score: "Me prevenir a 18h quand la nuit depasse 70",
  dew: "Alerte buee quand l'ecart tombe sous 1.5 °C",
};

/** Ecran en lecture seule pour la Phase 1 : geocodage, edition de l'horizon,
 * du mode de fenetre et des alertes arrivent avec `PUT /api/settings`
 * (Phase 2). Les preferences d'alerte, meme une fois editables, resteront
 * de simples valeurs enregistrees -- il n'existe aucune infrastructure de
 * notification reelle derriere (voir le plan d'implementation mobile) ;
 * mieux vaut le dire explicitement que de laisser un interrupteur qui n'a
 * jamais aucun effet. */
export function Reglages() {
  const { theme, isSystem, setTheme } = useTheme();
  const fetchSettings = useCallback(() => api.settings(), []);
  const { data, loading } = useFetch(fetchSettings, []);
  const fetchState = useCallback(() => api.state(), []);
  const { data: state } = useFetch(fetchState, []);

  return (
    <div className="nc-screen">
      <div>
        <div className="nc-eyebrow">Poste d'observation</div>
        <div className="nc-title">Position et horizon</div>
        <div className="nc-sub">Lecture seule pour l'instant -- l'edition arrive dans une prochaine version.</div>
      </div>

      {loading && <p className="nc-caption">Chargement...</p>}

      {data && (
        <div className="nc-card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="nc-eyebrow">Adresse</div>
          <div className="nc-mono" style={{ fontSize: 13 }}>
            {data.site.name} · {data.site.lat.toFixed(4)}, {data.site.lon.toFixed(4)}
          </div>
          <p className="nc-caption" style={{ margin: 0 }}>Fuseau : {data.site.tz}</p>
        </div>
      )}

      {state && (
        <div className="nc-card" style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          <div className="nc-eyebrow">Horizon degage</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
            {COMPASS_SECTORS.map((s) => (
              <div
                key={s}
                className="nc-mono"
                style={{
                  textAlign: "center", padding: "14px 0", borderRadius: 11, fontSize: 13,
                  background: state.horizon[s] ? "var(--accent)" : "transparent",
                  color: state.horizon[s] ? "var(--onaccent)" : "var(--ink2)",
                  border: `1px solid ${state.horizon[s] ? "var(--accent)" : "var(--line)"}`,
                }}
              >
                {s}
              </div>
            ))}
          </div>
        </div>
      )}

      {data && (
        <div className="nc-card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="nc-eyebrow">Fenetre d'observation</div>
          <div>{WINDOW_MODE_LABEL[data.windowMode] ?? data.windowMode}</div>
        </div>
      )}

      {data && (
        <div className="nc-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="nc-eyebrow">Alertes (enregistrees, pas encore envoyees)</div>
          {Object.entries(data.alerts).map(([key, on]) => (
            <div key={key} style={{ display: "flex", justifyContent: "space-between", gap: 14, fontSize: 13 }}>
              <span>{ALERT_LABEL[key] ?? key}</span>
              <span className="nc-mono" style={{ color: on ? "var(--good)" : "var(--ink3)" }}>
                {on ? "on" : "off"}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="nc-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="nc-eyebrow">Theme</div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["system", "light", "dark"] as const).map((t) => {
            const active = t === "system" ? isSystem : !isSystem && theme === t;
            return (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`nc-chip ${active ? "nc-chip-active" : ""}`}
              >
                {t === "system" ? "Systeme" : t === "light" ? "Clair" : "Sombre"}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
