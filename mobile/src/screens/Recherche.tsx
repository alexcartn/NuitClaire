import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import type { TargetRow } from "../types";

const RECENT_KEY = "nc-recent-searches";
const RECENT_MAX = 6;

function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function pushRecent(query: string) {
  const next = [query, ...loadRecent().filter((q) => q !== query)].slice(0, RECENT_MAX);
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
  const [results, setResults] = useState<TargetRow[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    setRecent(loadRecent());
  }, []);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setSearching(true);
    try {
      const found = await api.search(q.trim());
      setResults(found);
      setRecent(pushRecent(q.trim()));
    } finally {
      setSearching(false);
    }
  }, []);

  return (
    <div className="nc-screen">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runSearch(query);
          }}
          style={{ flex: 1 }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="M31, NGC7380, IC434..."
            className="nc-mono"
            style={{
              width: "100%", boxSizing: "border-box", background: "var(--surf)",
              border: "1px solid var(--accent)", borderRadius: 13, padding: "13px 14px",
              fontSize: 15, color: "var(--ink)",
            }}
          />
        </form>
        <button onClick={onCancel} className="nc-btn" style={{ border: "none", background: "none", color: "var(--accent)" }}>
          Annuler
        </button>
      </div>

      <p className="nc-caption">
        Recherche par designation : M31, NGC7380, IC434. Fonctionne aussi pour une cible infaisable ce soir
        -- la fiche indique alors pourquoi.
      </p>

      {searching && <p className="nc-caption">Recherche...</p>}

      {results && (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <div className="nc-eyebrow">Resultats</div>
          {results.length === 0 && <p className="nc-caption">Aucun objet trouve pour « {query} ».</p>}
          {results.map((r) => (
            <button
              key={r.designation}
              onClick={() => onOpenTarget(r.designation)}
              className="nc-card"
              style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left", cursor: "pointer", color: "var(--ink)" }}
            >
              <span className="nc-mono" style={{ fontSize: 15, width: 70, flex: "none" }}>
                {r.designation}
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: "var(--ink2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.commonName || r.type}
              </span>
              <span
                className="nc-mono"
                style={{ fontSize: 10, flex: "none", color: r.hours > 0 ? "var(--good)" : "var(--bad)" }}
              >
                {r.hours > 0 ? `${r.hours} H CE SOIR` : "INFAISABLE"}
              </span>
            </button>
          ))}
        </div>
      )}

      {recent.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 4 }}>
          <div className="nc-eyebrow">Recemment cherche</div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {recent.map((q) => (
              <button
                key={q}
                onClick={() => {
                  setQuery(q);
                  runSearch(q);
                }}
                className="nc-chip"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
