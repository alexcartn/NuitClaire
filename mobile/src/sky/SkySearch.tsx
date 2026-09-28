import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { BODY_NAMES } from "../solarSystem";
import { TabIcon } from "../components/TabIcon";
import type { TargetRow, TargetSuggestion } from "../types";
import { fold } from "./sky";
import { CONSTELLATIONS, NAMED_STARS } from "./skyNames";

export interface SkyFound {
  name: string;
  /** Constellation : la carte s'y centre sans rien selectionner. */
  constellation?: { raDeg: number; decDeg: number };
}

interface Hit {
  key: string;
  name: string;
  hint: string;
  found: SkyFound;
}

const MIN_QUERY = 2;
const DEBOUNCE_MS = 300;
const MAX_HITS = 8;

/** Trouver un astre sur la carte : planetes, Lune, etoiles et constellations
 * sans reseau, les cibles de ce soir, puis le catalogue entier (en ligne).
 * Un choix centre la carte dessus. */
export function SkySearch({ targets, onChoose }: { targets: TargetRow[]; onChoose: (f: SkyFound) => void }) {
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState<TargetSuggestion[]>([]);
  const q = fold(query);

  const local = useMemo<Hit[]>(() => {
    if (q.length < MIN_QUERY) return [];
    const has = (s: string | null | undefined) => !!s && fold(s).includes(q);
    const starts = (s: string) => fold(s).startsWith(q);
    const hits: Hit[] = [
      ...BODY_NAMES.filter(has).map((b) => ({ key: `b:${b}`, name: b, hint: b === "Lune" ? "" : "planète", found: { name: b } })),
      ...NAMED_STARS.filter((s) => has(s.name)).map((s) => ({ key: `s:${s.name}`, name: s.name, hint: "étoile", found: { name: s.name } })),
      ...CONSTELLATIONS.filter((c) => has(c.name)).map((c) => ({
        key: `c:${c.name}`, name: c.name, hint: "constellation", found: { name: c.name, constellation: { raDeg: c.raDeg, decDeg: c.decDeg } },
      })),
      ...targets
        .filter((t) => has(t.designation) || has(t.commonName) || has(t.messierId))
        .map((t) => ({ key: `t:${t.designation}`, name: t.designation, hint: t.commonName || t.type, found: { name: t.designation } })),
    ];
    // Ce qui commence par la saisie d'abord : « ve » donne Vénus et Véga
    // avant Grande Ourse.
    return hits.sort((a, b) => Number(starts(b.name)) - Number(starts(a.name)));
  }, [q, targets]);

  useEffect(() => {
    if (q.length < MIN_QUERY) {
      setRemote([]);
      return;
    }
    const timer = setTimeout(() => {
      // Hors ligne, on s'en tient a ce que la carte connait deja.
      api.searchSuggest(query.trim()).then(setRemote).catch(() => setRemote([]));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q, query]);

  const hits = [
    ...local,
    ...remote
      .filter((r) => !local.some((l) => l.name === r.designation))
      .map((r) => ({ key: `r:${r.designation}`, name: r.designation, hint: r.frenchName || r.commonName || r.type, found: { name: r.designation } })),
  ].slice(0, MAX_HITS);

  const choose = (f: SkyFound) => {
    setQuery("");
    setRemote([]);
    onChoose(f);
  };

  return (
    <div className="nc-sky-search">
      <div className="nc-sky-search-field">
        <TabIcon name="search" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && hits[0]) choose(hits[0].found);
            if (e.key === "Escape") setQuery("");
          }}
          placeholder="Trouver : Saturne, Véga, M31, Cygne…"
          aria-label="Trouver un astre sur la carte"
          className="nc-input"
          enterKeyHint="search"
          autoComplete="off"
        />
      </div>
      {hits.length > 0 && (
        <div className="nc-sky-search-list" role="listbox">
          {hits.map((h) => (
            <button key={h.key} role="option" aria-selected={false} onClick={() => choose(h.found)} className="nc-sky-search-item">
              <span className="nc-num">{h.name}</span>
              {h.hint && <span className="nc-caption"> · {h.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
