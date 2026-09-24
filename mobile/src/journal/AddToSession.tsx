import { useState } from "react";
import { api } from "../api";
import { tap } from "../haptics";
import { localNoteId, parseTargetPrefix } from "../sessionQueue";
import type { SessionOpBody } from "../sessionQueue";
import type { SessionItem, TargetRow } from "../types";

/** Evenements frequents d'une nuit, poses en un appui plutot que tapes.
 * C'est la meme note libre horodatee qu'une saisie au clavier -- juste le
 * texte le plus courant, pre-ecrit : dehors, a 23h, on ne tape pas une
 * phrase, on appuie. Rien n'est mesure ni deduit par l'appli (voir
 * l'en-tete de sessions.py), c'est bien l'utilisateur qui constate. */
const QUICK_NOTES = ["Buée", "Nuage", "Mise au point", "Avion", "Satellite", "Vent"] as const;

/** Ajouter une cible, une note, ou un evenement en un appui. */
export function AddToSession({ items, send }: {
  items: SessionItem[];
  send: (body: SessionOpBody) => void;
}) {
  const [targetQuery, setTargetQuery] = useState("");
  const [targetResults, setTargetResults] = useState<TargetRow[] | null>(null);
  const [searchingTarget, setSearchingTarget] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [freeNoteDraft, setFreeNoteDraft] = useState("");
  const [lastQuick, setLastQuick] = useState<string | null>(null);

  const searchTargets = async () => {
    if (!targetQuery.trim()) return;
    setSearchingTarget(true);
    setSearchError(false);
    try {
      setTargetResults(await api.search(targetQuery.trim()));
    } catch {
      setSearchError(true);
    } finally {
      setSearchingTarget(false);
    }
  };

  const addTarget = (designation: string) => {
    send({ kind: "addItem", designation });
    tap();
    setTargetResults(null);
    setTargetQuery("");
  };

  /** Ce que deviendra la note libre en cours de frappe : rattachee a une
   * cible si elle commence par une designation, libre sinon. Calcule a
   * chaque frappe pour l'afficher avant l'envoi -- une detection qui se
   * declenche en silence serait une mauvaise surprise sur une note qui
   * commence par hasard par "M31". */
  const prefix = parseTargetPrefix(freeNoteDraft);
  const prefixIsNew = prefix !== null && !items.some((i) => i.designation === prefix.designation);

  const addQuickNote = (text: string) => {
    send({ kind: "addFreeNote", noteId: localNoteId(), text });
    // Avec des gants, dans le noir : une vibration et la puce qui s'allume
    // un instant disent que l'appui a ete pris.
    tap();
    setLastQuick(text);
    window.setTimeout(() => setLastQuick((cur) => (cur === text ? null : cur)), 1200);
  };

  const submitFreeNote = () => {
    const text = freeNoteDraft.trim();
    if (!text) return;
    if (prefix) {
      // La cible d'abord : le serveur refuse une note sur une cible absente
      // de la session. Les deux operations partent dans cet ordre (voir
      // sessionQueue.ts), y compris hors ligne.
      if (prefixIsNew) send({ kind: "addItem", designation: prefix.designation });
      send({ kind: "addItemNote", designation: prefix.designation, noteId: localNoteId(), text: prefix.text });
    } else {
      send({ kind: "addFreeNote", noteId: localNoteId(), text });
    }
    tap();
    setFreeNoteDraft("");
  };

  return (
    <div className="nc-card nc-stack">
      <div className="nc-eyebrow">Ajouter à la session</div>
      <form onSubmit={(e) => { e.preventDefault(); searchTargets(); }} className="nc-row">
        <input
          value={targetQuery}
          onChange={(e) => setTargetQuery(e.target.value)}
          placeholder="Cible : M31, NGC7380…"
          aria-label="Désignation de la cible à ajouter"
          className="nc-input nc-num"
        />
        <button type="submit" className="nc-btn nc-none" disabled={searchingTarget}>
          {searchingTarget ? "…" : "Chercher"}
        </button>
      </form>
      {searchError && <div className="nc-notice">Recherche impossible pour l'instant (pas de réseau ?).</div>}
      {targetResults && (
        <div className="nc-stack-xs">
          {targetResults.length === 0 && (
            <p className="nc-caption" style={{ margin: 0 }}>Aucun objet trouvé pour « {targetQuery} ».</p>
          )}
          {targetResults.map((r) => (
            <div key={r.designation} className="nc-row">
              <span className="nc-num nc-none" style={{ fontSize: "var(--text-sm)", width: 80 }}>{r.designation}</span>
              <span className="nc-caption nc-grow nc-ellipsis">{r.commonName || r.type}</span>
              <button onClick={() => addTarget(r.designation)} className="nc-btn nc-btn-sm nc-none">
                Ajouter
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="nc-divider" />

      <div className="nc-stack-xs">
        <div className="nc-row">
          <input
            value={freeNoteDraft}
            onChange={(e) => setFreeNoteDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitFreeNote()}
            placeholder="Note : « M31 très contrasté », conditions…"
            aria-label="Note"
            className="nc-input"
          />
          <button onClick={submitFreeNote} disabled={!freeNoteDraft.trim()} className="nc-btn nc-none">
            Ajouter
          </button>
        </div>
        {prefix && (
          <p className="nc-caption" style={{ margin: 0 }}>
            Sera rattachée à <span className="nc-num" style={{ color: "var(--accent)" }}>{prefix.designation}</span>
            {prefixIsNew ? ", ajoutée à la session." : "."}
          </p>
        )}
      </div>

      <div className="nc-row nc-wrap" style={{ gap: "var(--space-xs)" }}>
        {QUICK_NOTES.map((label) => (
          <button
            key={label}
            onClick={() => addQuickNote(label)}
            className={`nc-chip ${lastQuick === label ? "nc-chip-active" : ""}`}
            aria-label={`Noter : ${label}`}
          >
            {lastQuick === label ? `${label} ✓` : label}
          </button>
        ))}
      </div>
    </div>
  );
}
