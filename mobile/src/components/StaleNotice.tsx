/** "Hors ligne : donnees du 21/09 a 21:04".
 *
 * Affiche des qu'une requete a echoue mais qu'une copie locale reste a
 * l'ecran (voir useFetch). Ce n'est pas une politesse : une prevision
 * horaire et des fenetres de visibilite sont datees par nature, et montrer
 * celles d'hier sans le dire ferait pointer une cible qui n'est plus la. */
import { staleLabel } from "../useFetch";

export function StaleNotice({ when }: { when: string | null }) {
  return (
    <div className="nc-notice">{staleLabel(when)}</div>
  );
}
