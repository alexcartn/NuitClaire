import { useCallback, useState } from "react";
import { api } from "../api";
import { useFetch } from "../useFetch";
import { useTheme } from "../useTheme";
import { isIOS, promptInstall, usePwa } from "../pwa";
import { COMPASS_SECTORS } from "../types";

const WINDOW_MODES: { key: "complete" | "habituelle"; label: string }[] = [
  { key: "complete", label: "Nuit complete" },
  { key: "habituelle", label: "Habituelle" },
];

/** '20.5' -> "20:30" (les horaires sont stockes en heures decimales, voir
 * settings.view_window). */
function fmtHour(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

const ALERT_LABEL: Record<string, string> = {
  score: "Me prevenir a 18h quand la nuit depasse 70",
  dew: "Alerte buee quand l'ecart tombe sous 1.5 °C",
};

export function Reglages() {
  const { theme, isSystem, setTheme } = useTheme();
  const { canPromptInstall, installed } = usePwa();

  const fetchSettings = useCallback(() => api.settings(), []);
  const { data, reload: reloadSettings } = useFetch(fetchSettings, []);
  const fetchState = useCallback(() => api.state(), []);
  const { data: state, reload: reloadState } = useFetch(fetchState, []);

  const [address, setAddress] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const runGeocode = async () => {
    if (!address.trim()) return;
    setGeocoding(true);
    setGeoError(null);
    try {
      const result = await api.geocode(address.trim());
      await api.updateSettings({
        site: { name: result.displayName.split(",")[0], lat: result.lat, lon: result.lon },
      });
      reloadSettings();
    } catch (e) {
      setGeoError(e instanceof Error ? e.message : "Adresse introuvable.");
    } finally {
      setGeocoding(false);
    }
  };

  const useMyPosition = () => {
    if (!navigator.geolocation) {
      setGeoError("Geolocalisation indisponible sur cet appareil.");
      return;
    }
    setGeocoding(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await api.updateSettings({
            site: { name: "Ma position", lat: pos.coords.latitude, lon: pos.coords.longitude },
          });
          reloadSettings();
        } finally {
          setGeocoding(false);
        }
      },
      () => {
        setGeoError("Position refusee ou indisponible.");
        setGeocoding(false);
      },
    );
  };

  const toggleSector = async (sector: string) => {
    if (!state) return;
    await api.updateHorizon(sector, !state.horizon[sector]);
    reloadState();
  };

  const pickWindowMode = async (mode: "complete" | "habituelle") => {
    await api.updateSettings({ windowMode: mode });
    reloadSettings();
  };

  const [windowDraft, setWindowDraft] = useState<{ start: string; end: string } | null>(null);
  const [windowError, setWindowError] = useState<string | null>(null);

  const saveViewWindow = async (startHour: number, endHour: number) => {
    setWindowError(null);
    if (!(startHour < endHour)) {
      setWindowError("L'heure de debut doit etre avant l'heure de fin.");
      return;
    }
    await api.updateSettings({ viewWindow: { startHour, endHour } });
    setWindowDraft(null);
    reloadSettings();
  };

  const toggleAlert = async (key: string) => {
    if (!data) return;
    await api.updateSettings({ alerts: { [key]: !data.alerts[key] } });
    reloadSettings();
  };

  return (
    <div className="nc-screen">
      <div>
        <div className="nc-eyebrow">Poste d'observation</div>
        <div className="nc-title">Position et horizon</div>
      </div>

      <div className="nc-card" style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        <div className="nc-eyebrow">Adresse</div>
        {data && (
          <div className="nc-mono" style={{ fontSize: 13, color: "var(--ink2)" }}>
            Actuelle : {data.site.name} · {data.site.lat.toFixed(4)}, {data.site.lon.toFixed(4)}
          </div>
        )}
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="7 rue Saint Jean, 51240 Marson"
          style={{
            background: "var(--surf2)", border: "1px solid var(--line)", borderRadius: 11,
            padding: 13, fontSize: 13, color: "var(--ink)",
          }}
        />
        <div style={{ display: "flex", gap: 9 }}>
          <button onClick={runGeocode} disabled={geocoding} className="nc-btn nc-btn-primary" style={{ flex: 1 }}>
            {geocoding ? "..." : "Geocoder"}
          </button>
          <button onClick={useMyPosition} disabled={geocoding} className="nc-btn" style={{ flex: "none" }}>
            Ma position
          </button>
        </div>
        {geoError && <p className="nc-caption" style={{ color: "var(--bad)", margin: 0 }}>{geoError}</p>}
        <p className="nc-caption" style={{ margin: 0 }}>
          Nominatim ne renvoie ni altitude ni fuseau : ceux du site precedent sont conserves.
        </p>
      </div>

      {state && (
        <div className="nc-card" style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          <div className="nc-eyebrow">Horizon degage</div>
          <p className="nc-caption" style={{ margin: 0 }}>
            Touchez les directions ou le ciel est libre depuis votre poste.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
            {COMPASS_SECTORS.map((s) => (
              <button
                key={s}
                onClick={() => toggleSector(s)}
                className="nc-mono"
                style={{
                  textAlign: "center", padding: "14px 0", borderRadius: 11, fontSize: 13, cursor: "pointer",
                  background: state.horizon[s] ? "var(--accent)" : "transparent",
                  color: state.horizon[s] ? "var(--onaccent)" : "var(--ink2)",
                  border: `1px solid ${state.horizon[s] ? "var(--accent)" : "var(--line)"}`,
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {data && (
        <div className="nc-card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="nc-eyebrow">Fenetre d'observation</div>
          {WINDOW_MODES.map((w) => (
            <button
              key={w.key}
              onClick={() => pickWindowMode(w.key)}
              className="nc-btn"
              style={{
                textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center",
                background: data.windowMode === w.key ? "var(--surf2)" : "transparent",
                borderColor: data.windowMode === w.key ? "var(--accent)" : "var(--line)",
              }}
            >
              <span>
                {w.label}
                {w.key === "habituelle" && (
                  <span className="nc-mono" style={{ color: "var(--ink3)", marginLeft: 6, fontSize: 12 }}>
                    ({fmtHour(data.viewWindow.startHour)}–{fmtHour(data.viewWindow.endHour)})
                  </span>
                )}
              </span>
              {data.windowMode === w.key && <span className="nc-mono">●</span>}
            </button>
          ))}

          {data.windowMode === "habituelle" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="time"
                  value={windowDraft?.start ?? fmtHour(data.viewWindow.startHour)}
                  onChange={(e) => setWindowDraft({
                    start: e.target.value,
                    end: windowDraft?.end ?? fmtHour(data.viewWindow.endHour),
                  })}
                  className="nc-mono"
                  style={{
                    flex: 1, background: "var(--surf2)", border: "1px solid var(--line)", borderRadius: 8,
                    padding: "7px 9px", fontSize: 13, color: "var(--ink)",
                  }}
                />
                <span className="nc-caption" style={{ margin: 0 }}>a</span>
                <input
                  type="time"
                  value={windowDraft?.end ?? fmtHour(data.viewWindow.endHour)}
                  onChange={(e) => setWindowDraft({
                    start: windowDraft?.start ?? fmtHour(data.viewWindow.startHour),
                    end: e.target.value,
                  })}
                  className="nc-mono"
                  style={{
                    flex: 1, background: "var(--surf2)", border: "1px solid var(--line)", borderRadius: 8,
                    padding: "7px 9px", fontSize: 13, color: "var(--ink)",
                  }}
                />
              </div>
              {windowError && <p className="nc-caption" style={{ color: "var(--bad)", margin: 0 }}>{windowError}</p>}
              {windowDraft && (
                <button
                  onClick={() => {
                    const [sh, sm] = windowDraft.start.split(":").map(Number);
                    const [eh, em] = windowDraft.end.split(":").map(Number);
                    saveViewWindow(sh + sm / 60, eh + em / 60);
                  }}
                  className="nc-btn nc-btn-primary"
                >
                  Enregistrer les horaires
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {data && (
        <div className="nc-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="nc-eyebrow">Alertes (enregistrees, pas encore envoyees)</div>
          {Object.entries(data.alerts).map(([key, on]) => (
            <button
              key={key}
              onClick={() => toggleAlert(key)}
              style={{
                background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left",
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14,
                minHeight: 40, color: "var(--ink)",
              }}
            >
              <span style={{ fontSize: 13 }}>{ALERT_LABEL[key] ?? key}</span>
              <span
                style={{
                  width: 46, height: 28, borderRadius: 14, flex: "none",
                  background: on ? "var(--accent)" : "var(--bar)",
                  display: "flex", alignItems: "center", justifyContent: on ? "flex-end" : "flex-start",
                  padding: 3, boxSizing: "border-box",
                }}
              >
                <span style={{ width: 22, height: 22, borderRadius: 11, background: "#fff" }} />
              </span>
            </button>
          ))}
        </div>
      )}

      {!installed && (
        <div className="nc-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="nc-eyebrow">Installer l'appli</div>
          <p className="nc-caption" style={{ margin: 0 }}>
            Posee sur l'ecran d'accueil, NuitClaire s'ouvre en plein ecran et demarre meme
            sans reseau : utile en pleine campagne, ou le journal continue de se remplir
            hors ligne.
          </p>
          {canPromptInstall ? (
            <button onClick={() => void promptInstall()} className="nc-btn nc-btn-primary">
              Ajouter a l'ecran d'accueil
            </button>
          ) : (
            // iOS n'expose pas d'API d'installation, et Chrome ne rejoue pas
            // sa proposition une fois ecartee : dans les deux cas il ne
            // reste que la marche a suivre manuelle.
            <p className="nc-caption" style={{ margin: 0 }}>
              {isIOS()
                ? "Sur iPhone et iPad : bouton Partager, puis « Sur l'ecran d'accueil »."
                : "Depuis le menu du navigateur : « Installer l'application » ou « Ajouter a l'ecran d'accueil »."}
            </p>
          )}
        </div>
      )}

      <div className="nc-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="nc-eyebrow">Theme</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(["system", "light", "dark", "night"] as const).map((t) => {
            const active = t === "system" ? isSystem : !isSystem && theme === t;
            const label = { system: "Systeme", light: "Clair", dark: "Sombre", night: "Vision nocturne" }[t];
            return (
              <button key={t} onClick={() => setTheme(t)} className={`nc-chip ${active ? "nc-chip-active" : ""}`}>
                {label}
              </button>
            );
          })}
        </div>
        <p className="nc-caption" style={{ margin: 0 }}>
          Vision nocturne : rouge sur noir et tailles augmentees, pour ne pas reperdre son
          adaptation a l'obscurite en consultant l'appli dehors. Aussi accessible d'un appui
          depuis le Journal.
        </p>
      </div>
    </div>
  );
}
