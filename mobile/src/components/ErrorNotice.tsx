/** Echec de chargement sans rien a afficher a la place : le dire, et
 * proposer de reessayer. Les ecrans en erreur n'offraient aucune autre issue
 * que de changer d'onglet et revenir. */
export function ErrorNotice({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="nc-notice nc-row nc-between">
      <span>{message}</span>
      <button onClick={onRetry} className="nc-chip">
        Réessayer
      </button>
    </div>
  );
}
