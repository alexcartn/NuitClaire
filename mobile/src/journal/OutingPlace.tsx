import { useState } from "react";
import { siteLine } from "../journalRead";
import type { Site } from "../types";

/** Lieu d'une sortie, corrigeable -- typiquement quand on est parti
 * observer ailleurs sans penser a changer sa position dans les reglages.
 * Sert pour la sortie en cours comme pour une sortie cloturee.
 *
 * On choisit parmi les lieux que le carnet connait deja plutot que de
 * ressaisir des coordonnees : on observe depuis une poignee d'endroits,
 * presque toujours les memes. Un endroit inedit se pose d'abord dans
 * Reglages, puis se retrouve ici. */
export function OutingPlace({ site, choices, onChange }: {
  site: Site | null;
  choices: Site[];
  onChange: (next: Site) => void;
}) {
  const [open, setOpen] = useState(false);
  const others = choices.filter((c) => c.name !== site?.name);
  return (
    <div className="nc-stack-xs" style={{ gap: "var(--space-2xs)" }}>
      {site && <div className="nc-context nc-num">{siteLine(site)}</div>}
      {(others.length > 0 || !site) && (
        <button onClick={() => setOpen((v) => !v)} className="nc-link" aria-expanded={open}>
          {open ? "Masquer les lieux" : site ? "Corriger le lieu" : "Indiquer le lieu"}
        </button>
      )}
      {open && (
        <div className="nc-row nc-wrap">
          {others.map((choice) => (
            <button
              key={choice.name}
              onClick={() => {
                onChange(choice);
                setOpen(false);
              }}
              className="nc-chip"
            >
              {choice.name}
            </button>
          ))}
          {others.length === 0 && (
            <p className="nc-caption" style={{ margin: 0 }}>
              Aucun autre lieu dans le carnet. Posez-le dans Réglages, il apparaîtra ici.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
