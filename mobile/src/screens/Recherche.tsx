import { useEffect, useState } from "react";
import { api } from "../api";
import type { TargetSuggestion } from "../types";

const RECENT_KEY = "nc-recent-searches";
const RECENT_MAX = 6;
const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function pushRecent(designation: string) {
  const next = [designation, ...loadRecent().filter((d) => d !== designation)].slice(0, RECENT_MAX);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  return next;
}

export function Recherche({
  onOpenTarget,
  onCancel,
}: {
  onOpenTarget: (designation: string) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<TargetSuggestion[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    setRecent(loadRecent());
  }, []);

  // Auto-detection : pas de bouton "Rechercher" a presser -- un debounce de
  // 300ms attend une pause dans la frappe avant d'interroger l'API, pour ne
  // pas envoyer une requete a chaque touche. Sous MIN_QUERY_LENGTH, aucune
  // requete (une seule lettre matcherait des centaines d'objets, cf.
  // catalog.search_prefix cote backend, qui applique le meme seuil).
  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      setSuggestions(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      api
        .searchSuggest(q)
        .then(setSuggestions)
        .finally(() => setSearching(false));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const selectTarget = (designation: string) => {
    setRecent(pushRecent(designation));
    onOpenTarget(designation);
  };

  return (
    <div className="nc-screen">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="M31, NGC7380, IC434..."
          className="nc-num"
          style={{
            flex: 1, boxSizing: "border-box", background: "var(--surf)",
            border: "1px solid var(--accent)", borderRadius: 13, padding: "13px 14px",
            fontSize: 15, color: "var(--ink)",
          }}
        />
        <button onClick={onCancel} className="nc-btn" style={{ border: "none", background: "none", color: "var(--accent)" }}>
          Annuler
        </button>
      </div>

      <p className="nc-caption">
        Les resultats s'affichent au fur et a mesure de la frappe -- designation uniquement (M31,
        NGC7380, IC434), pas de recherche par nom courant.
      </p>

      {searching && <p className="nc-caption">Recherche...</p>}

      {suggestions && (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <div className="nc-eyebrow">Resultats</div>
          {suggestions.length === 0 && <p className="nc-caption">Aucun objet trouve pour « {query.trim()} ».</p>}
          {suggestions.map((s) => (
            <button
              key={s.designation}
              onClick={() => selectTarget(s.designation)}
              className="nc-card"
              style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left", cursor: "pointer", color: "var(--ink)" }}
            >
              <span className="nc-num" style={{ fontSize: 15, width: 70, flex: "none" }}>
                {s.designation}
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: "var(--ink2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {s.commonName || s.type}
              </span>
            </button>
          ))}
        </div>
      )}

      {!suggestions && recent.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 4 }}>
          <div className="nc-eyebrow">Recemment cherche</div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {recent.map((d) => (
              <button key={d} onClick={() => selectTarget(d)} className="nc-chip">
                {d}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
