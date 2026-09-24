import { plural } from "../format";

/** Bandeau d'etat de la synchronisation. Le journal se remplit dehors, avec
 * un reseau qui va et vient : ce qui compte est de savoir que rien n'est
 * perdu, pas d'etre bloque. Silencieux quand tout est envoye. */
export function SyncBanner({ pendingCount, syncError, loadError }: {
  pendingCount: number; syncError: string | null; loadError: string | null;
}) {
  if (pendingCount === 0 && !syncError && !loadError) return null;
  const message = pendingCount > 0
    ? `${plural(pendingCount, "saisie en attente", "saisies en attente")} d'envoi : conservées sur l'appareil, envoyées dès le retour du réseau.`
    : loadError
      ? `Journal affiché depuis la copie locale (${loadError}).`
      : syncError;
  return <div className="nc-notice" role="status">{message}</div>;
}
