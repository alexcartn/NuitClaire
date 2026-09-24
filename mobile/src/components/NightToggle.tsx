import { useTheme } from "../useTheme";
import { TabIcon } from "./TabIcon";

/** Bascule vision nocturne, dans l'en-tete de chaque ecran. Elle n'existait
 * que dans le Journal : sur « Ce soir » ou une fiche cible, il fallait
 * passer par Reglages, ecran clair compris.
 *
 * Le nom accessible reprend le texte visible ("Nuit") avant de le
 * completer : une aide vocale doit pouvoir designer le bouton par ce qui est
 * ecrit dessus. */
export function NightToggle() {
  const { isNight, toggleNight } = useTheme();
  return (
    <button
      onClick={toggleNight}
      className={`nc-chip nc-night-toggle ${isNight ? "nc-chip-active" : ""}`}
      aria-pressed={isNight}
      aria-label="Nuit : vision nocturne"
      title={isNight ? "Revenir au thème précédent" : "Vision nocturne : rouge sur noir, tailles augmentées"}
    >
      <TabIcon name="moon" />
      Nuit
    </button>
  );
}
