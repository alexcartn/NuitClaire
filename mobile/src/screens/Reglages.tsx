import { useCallback, useState } from "react";
import { api, getApiToken, setApiToken } from "../api";
import { useFetch } from "../useFetch";
import { useTheme } from "../useTheme";
import { isIOS, promptInstall, usePwa } from "../pwa";
import { useCompass } from "../useCompass";
import { sectorFor } from "../compass";
import { Compass } from "../components/Compass";
import { ScreenHeader } from "../components/ScreenHeader";
import { AlertsCard } from "../components/AlertsCard";
import { COMPASS_SECTORS } from "../types";
import { fmtDecimalHour } from "../format";

const WINDOW_MODES: { key: "complete" | "habituelle"; label: string }[] = [
  { key: "complete", label: "Nuit complète" },
  { key: "habituelle", label: "Habituelle" },
];

const fmtHour = fmtDecimalHour;


export function Reglages() {
  const { theme, isSystem, setTheme, auto, setAutoNight } = useTheme();
  const [tokenSaved, setTokenSaved] = useState(() => getApiToken() !== null);
  const [tokenDraft, setTokenDraft] = useState("");
  const { canPromptInstall, installed } = usePwa();
  const compass = useCompass();
  // Secteur vise, pour le designer dans la grille d'horizon juste en dessous.
  const facing = compass.heading != null ? sectorFor(compass.heading) : null;

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
      setGeoError("Géolocalisation indisponible sur cet appareil.");
      return;
    }
    setGeocoding(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        // Un vrai nom de commune plutot que « Ma position » : c'est ce nom
        // que le journal retient pour chaque sortie, et « Ma position »
        // repete d'une nuit a l'autre ne disait plus ou l'on etait. Sans
        // reseau ou sans nom connu, on retombe sur l'ancien intitule.
        let name = "Ma position";
        try {
          name = (await api.reverseGeocode(lat, lon)).name;
        } catch {
          /* nom generique conserve */
        }
        try {
          await api.updateSettings({ site: { name, lat, lon } });
          reloadSettings();
        } catch {
          setGeoError("Position trouvée, mais non enregistrée : pas de réseau ?");
        } finally {
          setGeocoding(false);
        }
      },
      () => {
        setGeoError("Position refusée ou indisponible.");
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
      setWindowError("L'heure de début doit être avant l'heure de fin.");
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
      <ScreenHeader eyebrow="Poste d'observation" title="Position et horizon" />

      <div className="nc-card" style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        <div className="nc-eyebrow">Adresse</div>
        {data && (
          <div style={{ fontSize: "var(--text-sm)", color: "var(--ink2)" }}>
            {/* Un nom de commune n'est pas une coordonnee : seuls les deux
                nombres passent en chasse fixe. */}
            Actuelle : {data.site.name} ·{" "}
            <span className="nc-num">
              {data.site.lat.toFixed(4)}, {data.site.lon.toFixed(4)}
            </span>
          </div>
        )}
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runGeocode()}
          placeholder="7 rue Saint Jean, 51240 Marson"
          aria-label="Adresse du poste d'observation"
          className="nc-input"
          style={{ background: "var(--surf2)", borderRadius: 11, padding: 13 }}
        />
        <div style={{ display: "flex", gap: 9 }}>
          <button onClick={runGeocode} disabled={geocoding} className="nc-btn nc-btn-primary" style={{ flex: 1 }}>
            {geocoding ? "…" : "Trouver l'adresse"}
          </button>
          <button onClick={useMyPosition} disabled={geocoding} className="nc-btn" style={{ flex: "none" }}>
            Ma position
          </button>
        </div>
        {geoError && <p className="nc-caption" style={{ color: "var(--bad)", margin: 0 }}>{geoError}</p>}
        <p className="nc-caption" style={{ margin: 0 }}>
          Le service d'adresses (Nominatim) ne donne ni altitude ni fuseau : ceux du lieu précédent sont conservés.
        </p>
      </div>

      {/* Au-dessus de l'horizon degage, et pas ailleurs : c'est en tournant
          sur soi-meme, dehors, qu'on coche ces secteurs. */}
      <div className="nc-card" style={{ display: "flex", flexDirection: "column", gap: 11, alignItems: "center" }}>
        <div className="nc-eyebrow" style={{ alignSelf: "flex-start" }}>Boussole</div>
        {compass.heading != null && facing ? (
          <>
            <Compass heading={compass.heading} facing={facing} />
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span className="nc-num" style={{ fontSize: "var(--text-xl)", color: "var(--accent)" }}>{facing}</span>
              <span className="nc-num" style={{ fontSize: "var(--text-sm)", color: "var(--ink2)" }}>
                {Math.round(compass.heading)}°
              </span>
            </div>
            <p className="nc-caption" style={{ margin: 0, textAlign: "center" }}>
              Direction regardée, d'après la boussole du téléphone.
            </p>
          </>
        ) : compass.state === "unsupported" || compass.state === "denied" ? (
          <p className="nc-caption" style={{ margin: 0, textAlign: "center" }}>
            {compass.state === "denied"
              ? "Accès à la boussole refusé. Vous pouvez l'autoriser dans les réglages du navigateur."
              : "Ce navigateur ne donne pas accès à la boussole du téléphone."}
          </p>
        ) : compass.needsPermission ? (
          <>
            <button
              onClick={() => void compass.start()}
              disabled={compass.state === "asking"}
              className="nc-btn"
            >
              {compass.state === "asking" ? "…" : "Activer la boussole"}
            </button>
            <p className="nc-caption" style={{ margin: 0, textAlign: "center" }}>
              Pour savoir quelles directions vous cochez ci-dessous, sans repère dans le noir.
            </p>
          </>
        ) : (
          <p className="nc-caption" style={{ margin: 0, textAlign: "center" }}>
            En attente d'une mesure…
          </p>
        )}
      </div>

      {state && (
        <div className="nc-card" style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          <div className="nc-eyebrow">Horizon dégagé</div>
          <p className="nc-caption" style={{ margin: 0 }}>
            Touchez les directions où le ciel est libre depuis votre poste.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
            {COMPASS_SECTORS.map((s) => (
              <button
                key={s}
                onClick={() => toggleSector(s)}
                className="nc-num"
                aria-pressed={!!state.horizon[s]}
                style={{
                  textAlign: "center", padding: "14px 0", borderRadius: 11, fontSize: "var(--text-sm)", cursor: "pointer",
                  background: state.horizon[s] ? "var(--accent)" : "transparent",
                  color: state.horizon[s] ? "var(--onaccent)" : "var(--ink2)",
                  border: `1px solid ${state.horizon[s] ? "var(--accent)" : "var(--line)"}`,
                  // Secteur vise par la boussole : on pointe le telephone, on
                  // voit quelle case cocher.
                  outline: s === facing ? "2px solid var(--accent)" : "none",
                  outlineOffset: 2,
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
          <div className="nc-eyebrow">Fenêtre d'observation</div>
          {WINDOW_MODES.map((w) => (
            <button
              key={w.key}
              onClick={() => pickWindowMode(w.key)}
              className="nc-btn"
              aria-pressed={data.windowMode === w.key}
              style={{
                textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center",
                background: data.windowMode === w.key ? "var(--surf2)" : "transparent",
                borderColor: data.windowMode === w.key ? "var(--accent)" : "var(--line)",
              }}
            >
              <span>
                {w.label}
                {w.key === "habituelle" && (
                  <span className="nc-num" style={{ color: "var(--ink3)", marginLeft: 6, fontSize: "var(--text-xs)" }}>
                    ({fmtHour(data.viewWindow.startHour)}–{fmtHour(data.viewWindow.endHour)})
                  </span>
                )}
              </span>
              {data.windowMode === w.key && <span style={{ color: "var(--accent)" }} aria-hidden="true">●</span>}
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
                  className="nc-input nc-num"
                />
                <span className="nc-caption" style={{ margin: 0 }}>à</span>
                <input
                  type="time"
                  value={windowDraft?.end ?? fmtHour(data.viewWindow.endHour)}
                  onChange={(e) => setWindowDraft({
                    start: windowDraft?.start ?? fmtHour(data.viewWindow.startHour),
                    end: e.target.value,
                  })}
                  className="nc-input nc-num"
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

      {data && <AlertsCard alerts={data.alerts} onToggle={toggleAlert} />}

      {!installed && (
        <div className="nc-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="nc-eyebrow">Installer l'appli</div>
          <p className="nc-caption" style={{ margin: 0 }}>
            Posée sur l'écran d'accueil, NuitClaire s'ouvre en plein écran et démarre même
            sans réseau : utile en pleine campagne, où le journal continue de se remplir
            hors ligne.
          </p>
          {canPromptInstall ? (
            <button onClick={() => void promptInstall()} className="nc-btn nc-btn-primary">
              Ajouter à l'écran d'accueil
            </button>
          ) : (
            // iOS n'expose pas d'API d'installation, et Chrome ne rejoue pas
            // sa proposition une fois ecartee : dans les deux cas il ne
            // reste que la marche a suivre manuelle.
            <p className="nc-caption" style={{ margin: 0 }}>
              {isIOS()
                ? "Sur iPhone et iPad : bouton Partager, puis « Sur l'écran d'accueil »."
                : "Depuis le menu du navigateur : « Installer l'application » ou « Ajouter à l'écran d'accueil »."}
            </p>
          )}
        </div>
      )}

      <div className="nc-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="nc-eyebrow">Thème</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(["system", "light", "dark", "night"] as const).map((t) => {
            const active = t === "system" ? isSystem : !isSystem && theme === t;
            const label = { system: "Système", light: "Clair", dark: "Sombre", night: "Vision nocturne" }[t];
            return (
              <button key={t} onClick={() => setTheme(t)} className={`nc-chip ${active ? "nc-chip-active" : ""}`} aria-pressed={active}>
                {label}
              </button>
            );
          })}
        </div>
        <p className="nc-caption" style={{ margin: 0 }}>
          Vision nocturne : rouge sur noir et tailles augmentées, pour ne pas reperdre son
          adaptation à l'obscurité en consultant l'appli dehors. Accessible d'un appui en haut
          de chaque écran (bouton « Nuit »).
        </p>
        <button
          onClick={() => setAutoNight(!auto)}
          role="switch"
          aria-checked={auto}
          className="nc-row nc-between"
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", minHeight: 44, color: "var(--ink)", textAlign: "left", gap: "var(--space-md)" }}
        >
          <span style={{ fontSize: "var(--text-sm)" }}>Passer seul en vision nocturne à la nuit tombée</span>
          <span className={`nc-switch ${auto ? "nc-switch-on" : ""}`} aria-hidden="true"><span /></span>
        </button>
        <p className="nc-caption" style={{ margin: 0 }}>
          Entre les crépuscules nautiques de la nuit chargée, une fois par nuit ; retour au thème
          d'avant au matin. Si vous en sortez à la main, l'appli ne vous y renvoie pas.
        </p>
      </div>

      <div className="nc-card nc-stack">
        <div className="nc-eyebrow">Code d'accès</div>
        <p className="nc-caption" style={{ margin: 0 }}>
          {tokenSaved
            ? "Un code est enregistré sur ce téléphone."
            : "Aucun code enregistré. Nécessaire seulement si le serveur en exige un (NUITCLAIRE_API_TOKEN)."}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!tokenDraft.trim()) return;
            setApiToken(tokenDraft);
            setTokenDraft("");
            setTokenSaved(true);
          }}
          className="nc-row"
        >
          <input
            type="password"
            autoComplete="current-password"
            value={tokenDraft}
            onChange={(e) => setTokenDraft(e.target.value)}
            placeholder={tokenSaved ? "Nouveau code" : "Code d'accès"}
            aria-label="Code d'accès"
            className="nc-input"
          />
          <button type="submit" className="nc-btn nc-none" disabled={!tokenDraft.trim()}>
            Enregistrer
          </button>
        </form>
        {tokenSaved && (
          <button
            onClick={() => {
              setApiToken(null);
              setTokenSaved(false);
            }}
            className="nc-link"
          >
            Oublier le code
          </button>
        )}
      </div>
    </div>
  );
}
