import { useCallback, useState } from "react";
import { api, getApiToken, setApiToken } from "../api";
import { useFetch } from "../useFetch";
import { useTheme } from "../useTheme";
import { isIOS, promptInstall, usePwa } from "../pwa";
import { useCompass } from "../useCompass";
import { sectorFor } from "../compass";
import { Compass } from "../components/Compass";
import { ScreenHeader } from "../components/ScreenHeader";
import { Section } from "../components/Section";
import { AlertsCard } from "../components/AlertsCard";
import { HorizonEditor, horizonSummary } from "../components/HorizonEditor";
import { COMPASS_SECTORS, type Settings, type Site } from "../types";
import { fmtDecimalHour, fmtLatLon, plural } from "../format";

const WINDOW_MODES: { key: "complete" | "habituelle"; label: string }[] = [
  { key: "complete", label: "Nuit complète" },
  { key: "habituelle", label: "Habituelle" },
];

const THEME_LABEL = { system: "Système", light: "Clair", dark: "Sombre", night: "Vision nocturne" } as const;

/** Reglages, ranges comme les autres pages : une section par sujet, chacune
 * avec son reglage en place dans l'en-tete, pour voir l'essentiel sans rien
 * ouvrir.
 *
 * Chaque changement s'affiche tout de suite (optimiste), revient en arriere
 * en le disant si le serveur ne l'a pas pris, et previent l'appli
 * (`onChange`) pour que les autres ecrans ne gardent pas l'ancien reglage. */
export function Reglages({ onChange }: { onChange: () => void }) {
  const { theme, isSystem, setTheme, auto, setAutoNight } = useTheme();
  const [tokenSaved, setTokenSaved] = useState(() => getApiToken() !== null);
  const [tokenDraft, setTokenDraft] = useState("");
  const { canPromptInstall, installed } = usePwa();
  const compass = useCompass();
  // Secteur vise, designe dans l'editeur d'horizon juste en dessous.
  const facing = compass.heading != null ? sectorFor(compass.heading) : null;

  const fetchSettings = useCallback(() => api.settings(), []);
  const { data: serverSettings, reload: reloadSettings } = useFetch(fetchSettings, [], "settings");
  const fetchState = useCallback(() => api.state(), []);
  const { data: state, reload: reloadState } = useFetch(fetchState, [], "state");

  // Reglages affiches = ceux du serveur, plus ce qui vient d'etre touche et
  // n'est pas encore confirme.
  const [pending, setPending] = useState<Partial<Settings>>({});
  const data = serverSettings ? { ...serverSettings, ...pending } : null;
  const [saveError, setSaveError] = useState<string | null>(null);

  const saveSettings = async (patch: Partial<Settings>, update: Parameters<typeof api.updateSettings>[0], what: string) => {
    setPending((p) => ({ ...p, ...patch }));
    setSaveError(null);
    try {
      await api.updateSettings(update);
      reloadSettings();
      onChange();
    } catch {
      setSaveError(`${what} non enregistré : pas de réseau ? Réessayez.`);
    } finally {
      setPending((p) => {
        const next = { ...p };
        for (const k of Object.keys(patch)) delete next[k as keyof Settings];
        return next;
      });
    }
  };

  const [address, setAddress] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [managePlaces, setManagePlaces] = useState(false);

  const moveTo = async (site: { name: string; lat: number; lon: number }) => {
    await api.updateSettings({ site });
    reloadSettings();
    reloadState();
    onChange();
  };

  const runGeocode = async () => {
    if (!address.trim()) return;
    setGeocoding(true);
    setGeoError(null);
    try {
      const result = await api.geocode(address.trim());
      await moveTo({ name: result.displayName.split(",")[0], lat: result.lat, lon: result.lon });
      setAddress("");
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
        // que le journal retient pour chaque sortie. Sans reseau ou sans nom
        // connu, on retombe sur l'intitule generique.
        let name = "Ma position";
        try {
          name = (await api.reverseGeocode(lat, lon)).name;
        } catch {
          /* nom generique conserve */
        }
        try {
          await moveTo({ name, lat, lon });
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

  const switchPlace = async (place: Site) => {
    setGeoError(null);
    setGeocoding(true);
    try {
      await moveTo({ name: place.name, lat: place.lat, lon: place.lon });
    } catch {
      setGeoError(`Impossible de passer à ${place.name} : pas de réseau ?`);
    } finally {
      setGeocoding(false);
    }
  };

  const forgetPlace = async (place: Site) => {
    try {
      await api.deletePlace(place.name);
      reloadSettings();
    } catch (e) {
      setGeoError(e instanceof Error ? e.message : "Impossible de retirer ce lieu.");
    }
  };

  const [windowDraft, setWindowDraft] = useState<{ start: string; end: string } | null>(null);
  const [windowError, setWindowError] = useState<string | null>(null);

  const saveViewWindow = async (startHour: number, endHour: number) => {
    setWindowError(null);
    if (!(startHour < endHour)) {
      setWindowError("L'heure de début doit être avant l'heure de fin.");
      return;
    }
    await saveSettings({ viewWindow: { startHour, endHour } }, { viewWindow: { startHour, endHour } }, "Horaires");
    setWindowDraft(null);
  };

  const toggleAlert = (key: string) => {
    if (!data) return;
    const alerts = { ...data.alerts, [key]: !data.alerts[key] };
    void saveSettings({ alerts }, { alerts: { [key]: alerts[key] } }, "Alerte");
  };

  const places = data?.places ?? [];
  const profile = state
    ? Object.fromEntries(COMPASS_SECTORS.map((s) => [s, { open: !!state.horizon[s], alt: state.horizonAlt?.[s] ?? 0 }]))
    : null;
  const windowSummary = data
    ? data.windowMode === "habituelle"
      ? `${fmtDecimalHour(data.viewWindow.startHour)}–${fmtDecimalHour(data.viewWindow.endHour)}`
      : "nuit complète"
    : undefined;
  const activeAlerts = data ? Object.values(data.alerts).filter(Boolean).length : 0;
  const themeSummary = `${isSystem ? THEME_LABEL.system : THEME_LABEL[theme]}${auto ? " · nuit auto" : ""}`;

  return (
    <div className="nc-screen">
      <ScreenHeader eyebrow="Réglages" title="Poste et appli" />
      {saveError && <div className="nc-notice" role="alert">{saveError}</div>}

      <Section id="reglages-lieu" title="Lieu" summary={data?.site.name}>
        {data && (
          <div className="nc-caption" style={{ margin: 0, color: "var(--ink2)" }}>
            {data.site.name} · <span className="nc-num">{fmtLatLon(data.site.lat, data.site.lon, 3)}</span>
          </div>
        )}
        {places.length > 1 && (
          <div className="nc-stack-xs">
            <div className="nc-row nc-between">
              <span className="nc-caption">Mes lieux</span>
              <button onClick={() => setManagePlaces((v) => !v)} className="nc-link" aria-pressed={managePlaces}>
                {managePlaces ? "Terminé" : "Gérer"}
              </button>
            </div>
            <div className="nc-row nc-wrap" style={{ gap: "var(--space-xs)" }}>
              {places.map((p) => {
                const active = p.name === data?.site.name;
                return (
                  <span key={p.name} className="nc-row" style={{ gap: 0 }}>
                    <button
                      onClick={() => !active && switchPlace(p)}
                      disabled={geocoding}
                      className={`nc-chip ${active ? "nc-chip-active" : ""}`}
                      aria-pressed={active}
                    >
                      {p.name}
                    </button>
                    {managePlaces && !active && (
                      <button onClick={() => forgetPlace(p)} className="nc-icon-btn" style={{ margin: 0 }} aria-label={`Oublier ${p.name}`}>
                        ×
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        )}
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runGeocode()}
          placeholder="Nouvelle adresse : 7 rue Saint Jean, 51240 Marson"
          aria-label="Adresse d'un nouveau lieu"
          className="nc-input"
          style={{ background: "var(--surf2)", borderRadius: 11, padding: 13 }}
        />
        <div className="nc-row">
          <button onClick={runGeocode} disabled={geocoding || !address.trim()} className="nc-btn nc-btn-primary nc-grow">
            {geocoding ? "…" : "Trouver l'adresse"}
          </button>
          <button onClick={useMyPosition} disabled={geocoding} className="nc-btn nc-none">
            Ma position
          </button>
        </div>
        {geoError && <p className="nc-caption" style={{ color: "var(--bad)", margin: 0 }}>{geoError}</p>}
        <p className="nc-caption" style={{ margin: 0 }}>
          Chaque lieu utilisé reste dans « Mes lieux ». Le service d'adresses ne donne ni altitude ni fuseau :
          ceux du lieu précédent sont conservés.
        </p>
      </Section>

      <Section id="reglages-horizon" title="Horizon" summary={profile ? horizonSummary(profile) : undefined}>
        {/* La boussole au-dessus de l'editeur : c'est en tournant sur
            soi-meme, dehors, qu'on regle ces secteurs. */}
        {compass.heading != null && facing ? (
          <div className="nc-stack-xs" style={{ alignItems: "center" }}>
            <Compass heading={compass.heading} facing={facing} />
            <div className="nc-row nc-baseline">
              <span className="nc-num" style={{ fontSize: "var(--text-xl)", color: "var(--accent)" }}>{facing}</span>
              <span className="nc-num" style={{ fontSize: "var(--text-sm)", color: "var(--ink2)" }}>
                {Math.round(compass.heading)}°
              </span>
            </div>
          </div>
        ) : compass.state === "unsupported" || compass.state === "denied" ? (
          <p className="nc-caption" style={{ margin: 0 }}>
            {compass.state === "denied"
              ? "Accès à la boussole refusé. Vous pouvez l'autoriser dans les réglages du navigateur."
              : "Pas de boussole sur ce navigateur : choisissez les directions à la main."}
          </p>
        ) : compass.needsPermission ? (
          <button onClick={() => void compass.start()} disabled={compass.state === "asking"} className="nc-btn">
            {compass.state === "asking" ? "…" : "Activer la boussole"}
          </button>
        ) : (
          <p className="nc-caption" style={{ margin: 0 }}>En attente de la boussole…</p>
        )}
        {state && (
          <HorizonEditor
            horizon={state.horizon}
            horizonAlt={state.horizonAlt ?? {}}
            facing={facing}
            onSaved={() => {
              reloadState();
              onChange();
            }}
          />
        )}
      </Section>

      {data && (
        <Section
          id="reglages-instrument"
          title="Jumelles"
          summary={data.binoculars.label}
          defaultOpen={false}
        >
          <p className="nc-caption" style={{ margin: 0 }}>
            Pour patienter pendant que le Seestar pose : elles choisissent les cibles de « En attendant le Seestar »,
            sur Ce soir. Le diamètre fixe ce qu'elles montrent (magnitude{" "}
            {String(data.binoculars.limitMag).replace(".", ",")} au plus pour un objet étendu), le champ règle le
            cadrage et le chemin d'étoiles. Le grossissement n'est qu'une étiquette.
          </p>
          <div className="nc-grid-2" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
            {([
              ["magnification", "Grossissement", Number(data.binoculars.label.split("x")[0]), "x"],
              ["aperture_mm", "Diamètre", data.binoculars.apertureMm, "mm"],
              ["fov_deg", "Champ", data.binoculars.fovDeg, "°"],
            ] as const).map(([key, label, value, unit]) => (
              <label key={key} className="nc-stack-xs" style={{ gap: "var(--space-2xs)" }}>
                <span className="nc-caption">{label} ({unit})</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step={key === "fov_deg" ? 0.1 : 1}
                  defaultValue={value}
                  onBlur={(e) => {
                    const v = Number(e.target.value.replace(",", "."));
                    if (!Number.isFinite(v) || v <= 0 || v === value) return;
                    void saveSettings({}, { binoculars: { [key]: v } }, "Jumelles");
                  }}
                  className="nc-input nc-num"
                />
              </label>
            ))}
          </div>
          <p className="nc-caption" style={{ margin: 0 }}>
            Le champ réel est gravé sur les jumelles (« 6,5° » ou « 114 m à 1000 m » : divisez par 17,5).
          </p>
        </Section>
      )}

      {data && (
        <Section id="reglages-nuit" title="Fenêtre d'observation" summary={windowSummary} defaultOpen={false}>
          {WINDOW_MODES.map((w) => (
            <button
              key={w.key}
              onClick={() => saveSettings({ windowMode: w.key }, { windowMode: w.key }, "Fenêtre")}
              className="nc-btn nc-row nc-between"
              aria-pressed={data.windowMode === w.key}
              style={{
                textAlign: "left",
                background: data.windowMode === w.key ? "var(--surf2)" : "transparent",
                borderColor: data.windowMode === w.key ? "var(--accent)" : "var(--line)",
              }}
            >
              <span>
                {w.label}
                {w.key === "habituelle" && (
                  <span className="nc-num" style={{ color: "var(--ink3)", marginLeft: 6, fontSize: "var(--text-xs)" }}>
                    ({fmtDecimalHour(data.viewWindow.startHour)}–{fmtDecimalHour(data.viewWindow.endHour)})
                  </span>
                )}
              </span>
              {data.windowMode === w.key && <span style={{ color: "var(--accent)" }} aria-hidden="true">●</span>}
            </button>
          ))}
          {data.windowMode === "habituelle" && (
            <div className="nc-stack-xs">
              <div className="nc-row">
                <input
                  type="time"
                  aria-label="Début de la fenêtre"
                  value={windowDraft?.start ?? fmtDecimalHour(data.viewWindow.startHour)}
                  onChange={(e) => setWindowDraft({
                    start: e.target.value,
                    end: windowDraft?.end ?? fmtDecimalHour(data.viewWindow.endHour),
                  })}
                  className="nc-input nc-num"
                />
                <span className="nc-caption">à</span>
                <input
                  type="time"
                  aria-label="Fin de la fenêtre"
                  value={windowDraft?.end ?? fmtDecimalHour(data.viewWindow.endHour)}
                  onChange={(e) => setWindowDraft({
                    start: windowDraft?.start ?? fmtDecimalHour(data.viewWindow.startHour),
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
                    void saveViewWindow(sh + sm / 60, eh + em / 60);
                  }}
                  className="nc-btn nc-btn-primary"
                >
                  Enregistrer les horaires
                </button>
              )}
            </div>
          )}
          <p className="nc-caption" style={{ margin: 0 }}>
            Nuit complète : toute la nuit noire compte. Habituelle : seulement vos horaires, pour les cibles,
            le score et le catalogue Messier.
          </p>
        </Section>
      )}

      {data && (
        <Section
          id="reglages-alertes"
          title="Alertes"
          summary={activeAlerts ? plural(activeAlerts, "active", "actives") : "aucune"}
          defaultOpen={false}
        >
          <AlertsCard alerts={data.alerts} onToggle={toggleAlert} bare />
        </Section>
      )}

      <Section id="reglages-affichage" title="Affichage" summary={themeSummary} defaultOpen={false}>
        <div className="nc-row nc-wrap" style={{ gap: "var(--space-xs)" }}>
          {(["system", "light", "dark", "night"] as const).map((t) => {
            const active = t === "system" ? isSystem : !isSystem && theme === t;
            return (
              <button key={t} onClick={() => setTheme(t)} className={`nc-chip ${active ? "nc-chip-active" : ""}`} aria-pressed={active}>
                {THEME_LABEL[t]}
              </button>
            );
          })}
        </div>
        <p className="nc-caption" style={{ margin: 0 }}>
          Vision nocturne : rouge sur noir et tailles augmentées, pour ne pas reperdre son adaptation à
          l'obscurité. Le thème se change aussi en haut de chaque écran.
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
          Entre les crépuscules nautiques de la nuit chargée, une fois par nuit ; retour au thème d'avant au
          matin. Si vous en sortez à la main, l'appli ne vous y renvoie pas.
        </p>
      </Section>

      <Section
        id="reglages-appli"
        title="Appli"
        summary={[installed ? "installée" : null, tokenSaved ? "code enregistré" : null].filter(Boolean).join(" · ") || undefined}
        defaultOpen={false}
      >
        {!installed && (
          <div className="nc-stack-xs">
            <span className="nc-caption" style={{ color: "var(--ink2)" }}>Installer l'appli</span>
            <p className="nc-caption" style={{ margin: 0 }}>
              Posée sur l'écran d'accueil, NuitClaire s'ouvre en plein écran, démarre sans réseau et peut
              recevoir les alertes.
            </p>
            {canPromptInstall ? (
              <button onClick={() => void promptInstall()} className="nc-btn nc-btn-primary">
                Ajouter à l'écran d'accueil
              </button>
            ) : (
              // iOS n'expose pas d'API d'installation, et Chrome ne rejoue pas
              // sa proposition une fois ecartee : il reste la marche a suivre.
              <p className="nc-caption" style={{ margin: 0 }}>
                {isIOS()
                  ? "Sur iPhone et iPad : bouton Partager, puis « Sur l'écran d'accueil »."
                  : "Depuis le menu du navigateur : « Installer l'application » ou « Ajouter à l'écran d'accueil »."}
              </p>
            )}
            <div className="nc-divider" />
          </div>
        )}
        <span className="nc-caption" style={{ color: "var(--ink2)" }}>Code d'accès</span>
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
      </Section>
    </div>
  );
}
