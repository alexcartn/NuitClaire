import type { ReactNode } from "react";
import { NightToggle } from "./NightToggle";

/** En-tete commun des ecrans : intitule, titre, sous-titre, et a droite de
 * l'intitule la bascule vision nocturne (plus d'eventuelles actions propres
 * a l'ecran). */
export function ScreenHeader({
  eyebrow,
  title,
  sub,
  actions,
}: {
  eyebrow: string;
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  // Actions sur la ligne de l'intitule, pas a cote du titre : trois
  // boutons de 44 px mangeaient la moitie de la largeur et faisaient casser
  // le titre et les coordonnees sur trois lignes.
  return (
    <div>
      <div className="nc-row nc-between">
        <div className="nc-eyebrow">{eyebrow}</div>
        <div className="nc-row nc-none">
          {actions}
          <NightToggle />
        </div>
      </div>
      <div className="nc-title" style={{ marginTop: "var(--space-2xs)" }}>{title}</div>
      {sub && <div className="nc-sub">{sub}</div>}
    </div>
  );
}
