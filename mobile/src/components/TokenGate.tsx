import { useState } from "react";
import { setApiToken } from "../api";

/** Demande du code d'acces, quand le serveur l'exige (voir api/auth.py) et
 * que l'appareil n'a pas le bon. Garde sur l'appareil une fois saisi ; les
 * saisies du journal faites entre-temps restent dans la file et partent
 * apres le rechargement (voir sessionStore.isPermanentFailure). */
export function TokenGate() {
  const [draft, setDraft] = useState("");
  const save = () => {
    if (!draft.trim()) return;
    setApiToken(draft);
    window.location.reload();
  };
  return (
    <div className="nc-token-gate" role="dialog" aria-modal="true" aria-labelledby="nc-token-title">
      <div className="nc-card nc-stack">
        <div className="nc-eyebrow">Accès</div>
        <div id="nc-token-title" className="nc-title">Code d'accès</div>
        <p className="nc-caption" style={{ margin: 0 }}>
          Le serveur demande un code (la valeur de NUITCLAIRE_API_TOKEN). Il est gardé sur ce
          téléphone, à saisir une seule fois.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="nc-row"
        >
          <input
            type="password"
            autoComplete="current-password"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Code d'accès"
            className="nc-input"
            aria-label="Code d'accès"
          />
          <button type="submit" className="nc-btn nc-btn-primary nc-none" disabled={!draft.trim()}>
            Valider
          </button>
        </form>
      </div>
    </div>
  );
}
