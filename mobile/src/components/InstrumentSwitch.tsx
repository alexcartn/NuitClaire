import { useState } from "react";
import { api } from "../api";
import type { Instrument } from "../types";

/** Seestar ou jumelles : change la liste des cibles, le cadrage, le Pokedex
 * Messier et ajoute le chemin d'etoiles aux fiches. Place en tete de
 * « Cibles » et « Messier », la ou le choix change ce qu'on voit. */
export function InstrumentSwitch({ instrument, binocularsLabel, onChanged }: {
  instrument: Instrument;
  binocularsLabel?: string;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const pick = async (next: Instrument) => {
    if (next === instrument || busy) return;
    setBusy(true);
    setError(false);
    try {
      await api.updateSettings({ instrument: next });
      onChanged();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="nc-stack-xs">
      <div className="nc-segmented" role="radiogroup" aria-label="Instrument">
        {(["seestar", "jumelles"] as const).map((k) => (
          <button
            key={k}
            role="radio"
            aria-checked={instrument === k}
            onClick={() => pick(k)}
            disabled={busy}
            className={instrument === k ? "nc-segment nc-segment-active" : "nc-segment"}
          >
            {k === "seestar" ? "Seestar" : `Jumelles${binocularsLabel ? ` ${binocularsLabel}` : ""}`}
          </button>
        ))}
      </div>
      {error && <div className="nc-notice">Changement non enregistré : pas de réseau ?</div>}
    </div>
  );
}
