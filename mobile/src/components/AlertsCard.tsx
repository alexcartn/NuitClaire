import { useEffect, useState } from "react";
import { api } from "../api";
import { disablePush, enablePush, pushState, type PushState } from "../push";

const ALERT_LABEL: Record<string, string> = {
  score: "Me prévenir quand la nuit dépasse 70",
  dew: "Me prévenir d'un risque de buée (écart sous 1,5 °C)",
  iss: "Me prévenir d'un passage visible de l'ISS",
};

const STATE_TEXT: Record<PushState, string> = {
  unsupported: "Ce navigateur ne reçoit pas de notifications (ou l'appli n'est pas installée).",
  "needs-install": "Sur iPhone et iPad, les notifications n'arrivent qu'à l'appli posée sur l'écran d'accueil (voir « Installer l'appli »).",
  denied: "Notifications refusées pour cette appli. Autorisez-les dans les réglages du téléphone, puis revenez ici.",
  off: "Ce téléphone ne reçoit pas encore les alertes.",
  on: "Ce téléphone reçoit les alertes.",
};

/** Alertes : ce qui declenche une notification (reglage du serveur, commun a
 * tous les appareils) et si ce telephone-ci la recoit (abonnement propre a
 * l'appareil). Evaluees une fois par jour vers 18 h (17 h l'hiver, la tache
 * planifiee tourne en heure UTC), pour la nuit qui vient. */
export function AlertsCard({ alerts, onToggle, bare = false }: {
  alerts: Record<string, boolean>;
  onToggle: (key: string) => void;
  /** Sans carte ni intitule, pour prendre place dans une Section. */
  bare?: boolean;
}) {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    pushState().then(setState).catch(() => setState("unsupported"));
  }, []);

  const run = async (action: () => Promise<PushState | string>) => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await action();
      if (result === "on" || result === "off" || result === "denied" || result === "unsupported") setState(result);
      else setMessage(result);
    } catch (e) {
      // Les erreurs du navigateur arrivent en anglais ("Registration failed
      // - permission denied") : on dit ce qui s'est passe, le detail suit.
      const detail = e instanceof Error ? e.message : "";
      setMessage(
        e instanceof DOMException
          ? `Le navigateur n'a pas pu s'abonner aux notifications (${detail}).`
          : detail || "Échec, réessayez.",
      );
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    const r = await api.pushTest();
    return r.sent > 0 ? "Notification de test envoyée." : "Aucun appareil n'a pu être joint.";
  };

  return (
    <div className={bare ? "nc-stack" : "nc-card nc-stack"}>
      {!bare && <div className="nc-eyebrow">Alertes</div>}
      {Object.entries(alerts).map(([key, on]) => (
        <button
          key={key}
          onClick={() => onToggle(key)}
          role="switch"
          aria-checked={on}
          className="nc-row nc-between"
          style={{
            background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left",
            gap: "var(--space-md)", minHeight: 44, color: "var(--ink)",
          }}
        >
          <span style={{ fontSize: "var(--text-sm)" }}>{ALERT_LABEL[key] ?? key}</span>
          <span className={`nc-switch ${on ? "nc-switch-on" : ""}`} aria-hidden="true"><span /></span>
        </button>
      ))}
      <p className="nc-caption" style={{ margin: 0 }}>
        Vérifiées chaque jour vers 18 h (17 h l'hiver) pour la nuit qui vient, une seule fois par nuit.
      </p>

      <div className="nc-divider" />

      {state && <p className="nc-caption" style={{ margin: 0, color: "var(--ink2)" }}>{STATE_TEXT[state]}</p>}
      {state === "off" && (
        <button onClick={() => run(enablePush)} disabled={busy} className="nc-btn nc-btn-primary">
          {busy ? "…" : "Recevoir les alertes sur ce téléphone"}
        </button>
      )}
      {state === "on" && (
        <div className="nc-row">
          <button onClick={() => run(test)} disabled={busy} className="nc-btn nc-grow">
            Envoyer un test
          </button>
          <button onClick={() => run(disablePush)} disabled={busy} className="nc-btn nc-none">
            Désactiver
          </button>
        </div>
      )}
      {message && <div className="nc-notice" role="status">{message}</div>}
    </div>
  );
}
