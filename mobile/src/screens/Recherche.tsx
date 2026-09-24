import { useEffect, useState } from "react";
import { api } from "../api";
import { readJson, writeJson } from "../storage";
import type { TargetSuggestion } from "../types";

const RECENT_KEY = "nc-recent-searches";
const RECENT_MAX = 6;
const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

function loadRecent(): string[] {
  return readJson<string[]>(RECENT_KEY) ?? [];
}

function pushRecent(designation: string) {
  const next = [designation, ...loadRecent().filter((d) => d !== designation)].slice(0, RECENT_MAX);
  writeJson(RECENT_KEY, next);
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
  const [searchError, setSearchError] = useState(false);
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
      setSearchError(false);
      api
        .searchSuggest(q)
        .then(setSuggestions)
        // Hors ligne, la requete echouait sans rien dire : « Recherche… »
        // disparaissait et l'ecran restait vide.
        .catch(() => setSearchError(true))
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
          placeholder="M31, NGC7380, IC434…"
          aria-label="Désignation de l'objet"
          className="nc-input nc-num"
          style={{ borderColor: "var(--accent)", borderRadius: 13, padding: "13px 14px", fontSize: "var(--text-md)" }}
        />
        <button onClick={onCancel} className="nc-link nc-link-accent" style={{ alignSelf: "center", padding: "0 var(--space-xs)" }}>
          Annuler
        </button>
      </div>

      <p className="nc-caption">
        Les résultats s'affichent au fil de la frappe. Désignation uniquement (M31, NGC7380, IC434) :
        pas de recherche par nom courant.
      </p>

      {searching && <p className="nc-caption">Recherche…</p>}
      {searchError && !searching && (
        <div className="nc-notice">Recherche impossible pour l'instant (pas de réseau ?).</div>
      )}

      {suggestions && (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <div className="nc-eyebrow">Résultats</div>
          {suggestions.length === 0 && <p className="nc-caption">Aucun objet trouvé pour « {query.trim()} ».</p>}
          {suggestions.map((s) => (
            <button
              key={s.designation}
              onClick={() => selectTarget(s.designation)}
              className="nc-card"
              style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left", cursor: "pointer", color: "var(--ink)" }}
            >
              <span className="nc-num" style={{ fontSize: "var(--text-md)", width: 80, flex: "none" }}>
                {s.designation}
              </span>
              <span className="nc-grow nc-ellipsis" style={{ fontSize: "var(--text-sm)", color: "var(--ink2)" }}>
                {s.commonName || s.type}
              </span>
            </button>
          ))}
        </div>
      )}

      {!suggestions && recent.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 4 }}>
          <div className="nc-eyebrow">Récemment cherché</div>
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
