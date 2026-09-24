import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { readCache, readJson, writeJson } from "../storage";
import { plural } from "../format";
import { TabIcon } from "../components/TabIcon";
import type { TargetRow, TargetSuggestion } from "../types";

const RECENT_KEY = "nc-recent-searches";
const RECENT_MAX = 6;
const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

/** Les incontournables, proposes quand le champ est vide : l'ecran
 * n'affichait rien tant qu'on ne savait pas deja quoi chercher. Noms
 * francais ici, la recherche par nom cote serveur (catalog.FRENCH_NAMES)
 * trouve les memes. */
const MUST_SEE: [string, string][] = [
  ["M31", "Galaxie d'Andromède"], ["M42", "Grande nébuleuse d'Orion"], ["M45", "Pléiades"],
  ["M51", "Galaxie du Tourbillon"], ["M13", "Grand amas d'Hercule"], ["M57", "Nébuleuse de l'Anneau"],
  ["M27", "Nébuleuse de l'Haltère"], ["M81", "Galaxie de Bode"], ["M101", "Galaxie du Moulinet"],
  ["M1", "Nébuleuse du Crabe"], ["M8", "Nébuleuse de la Lagune"], ["M16", "Nébuleuse de l'Aigle"],
  ["NGC7000", "Nébuleuse de l'Amérique du Nord"], ["NGC6960", "Dentelles du Cygne"],
  ["NGC869", "Double amas de Persée"], ["NGC2238", "Nébuleuse de la Rosette"],
];

/** "NGC0869" et "NGC869" designent le meme objet. */
function key(designation: string): string {
  return designation.replace(/\s+/g, "").toUpperCase().replace(/^([A-Z]+)0*(\d)/, "$1$2");
}

function loadRecent(): string[] {
  return readJson<string[]>(RECENT_KEY) ?? [];
}

function pushRecent(designation: string) {
  const next = [designation, ...loadRecent().filter((d) => d !== designation)].slice(0, RECENT_MAX);
  writeJson(RECENT_KEY, next);
  return next;
}

/** Creneau de ce soir d'un objet, d'apres les listes deja gardees sur
 * l'appareil (« Cibles », catalogue Messier) : aucune requete, et rien
 * d'affiche pour un objet qu'elles ne couvrent pas. */
function useTonightSlots(): Map<string, string> {
  return useMemo(() => {
    const slots = new Map<string, string>();
    const rows = [...(readCache<TargetRow[]>("targets") ?? []), ...(readCache<TargetRow[]>("messier:false") ?? [])];
    for (const r of rows) {
      if (r.start && r.end) {
        slots.set(key(r.designation), `${r.start}–${r.end}`);
        if (r.ngc) slots.set(key(r.ngc), `${r.start}–${r.end}`);
      }
    }
    return slots;
  }, []);
}

function ResultRow({ designation, name, slot, onOpen }: {
  designation: string;
  name: string;
  slot?: string;
  onOpen: () => void;
}) {
  return (
    <button onClick={onOpen} className="nc-plan-row">
      <span className="nc-num nc-none" style={{ fontSize: "var(--text-sm)", fontWeight: 500, width: 76 }}>
        {designation}
      </span>
      <span className="nc-grow nc-ellipsis" style={{ fontSize: "var(--text-sm)", color: "var(--ink2)" }}>
        {name}
      </span>
      {slot && (
        <span className="nc-num nc-caption nc-none" title="Créneau de ce soir">
          {slot}
        </span>
      )}
    </button>
  );
}

export function Recherche({
  onOpenTarget,
  onBrowseType,
  onCancel,
}: {
  onOpenTarget: (designation: string) => void;
  /** Ouvre « Cibles » filtree sur ce type. */
  onBrowseType: (type: string) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<TargetSuggestion[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [recent, setRecent] = useState<string[]>(loadRecent);
  const input = useRef<HTMLInputElement>(null);
  const slots = useTonightSlots();

  // Types de ce soir, pour parcourir sans rien savoir d'avance.
  const tonightTypes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of readCache<TargetRow[]>("targets") ?? []) counts.set(r.type, (counts.get(r.type) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, []);
  const tonightBest = useMemo(
    () => (readCache<TargetRow[]>("targets") ?? []).filter((r) => r.start && r.end).slice(0, 5),
    [],
  );
  // Visibles ce soir d'abord.
  const mustSee = useMemo(
    () => [...MUST_SEE].sort((a, b) => Number(slots.has(key(b[0]))) - Number(slots.has(key(a[0])))),
    [slots],
  );

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

  const empty = query.trim().length < MIN_QUERY_LENGTH;

  return (
    <div className="nc-screen">
      <div className="nc-row">
        <div className="nc-grow" style={{ position: "relative" }}>
          <input
            ref={input}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="M31, NGC7000, Orion, Andromède…"
            aria-label="Désignation ou nom de l'objet"
            className="nc-input"
            style={{ borderColor: "var(--accent)", borderRadius: 13, padding: "13px 44px 13px 14px", fontSize: "var(--text-md)", width: "100%" }}
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                input.current?.focus();
              }}
              className="nc-icon-btn"
              style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", margin: 0 }}
              aria-label="Effacer la recherche"
            >
              <TabIcon name="close" />
            </button>
          )}
        </div>
        <button onClick={onCancel} className="nc-link nc-link-accent" style={{ alignSelf: "center", padding: "0 var(--space-xs)" }}>
          Annuler
        </button>
      </div>

      {empty && (
        <p className="nc-caption" style={{ margin: 0 }}>
          Une désignation (M31, NGC7000, IC434) ou un nom, en français ou en anglais (Orion, Tourbillon,
          Whirlpool).
        </p>
      )}

      {searching && <p className="nc-caption">Recherche…</p>}
      {searchError && !searching && (
        <div className="nc-notice">Recherche impossible pour l'instant (pas de réseau ?).</div>
      )}

      {suggestions && (
        <div className="nc-card nc-stack-xs">
          <div className="nc-eyebrow">{plural(suggestions.length, "résultat", "résultats")}</div>
          {suggestions.length === 0 && (
            <p className="nc-caption" style={{ margin: 0 }}>
              Rien pour « {query.trim()} ». Essayez une désignation (M, NGC, IC) ou un autre nom.
            </p>
          )}
          {suggestions.map((s) => (
            <ResultRow
              key={s.designation}
              designation={s.designation}
              name={s.frenchName || s.commonName || s.type}
              slot={slots.get(key(s.designation))}
              onOpen={() => selectTarget(s.designation)}
            />
          ))}
        </div>
      )}

      {(empty || suggestions?.length === 0) && (
        <>
          {empty && recent.length > 0 && (
            <div className="nc-stack-xs">
              <div className="nc-eyebrow">Récemment cherché</div>
              <div className="nc-row nc-wrap" style={{ gap: "var(--space-xs)" }}>
                {recent.map((d) => (
                  <button key={d} onClick={() => selectTarget(d)} className="nc-chip nc-num">
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tonightBest.length > 0 && (
            <div className="nc-card nc-stack-xs">
              <div className="nc-eyebrow">En tête de liste ce soir</div>
              {tonightBest.map((r) => (
                <ResultRow
                  key={r.designation}
                  designation={r.designation}
                  name={r.commonName || r.type}
                  slot={`${r.start}–${r.end}`}
                  onOpen={() => selectTarget(r.designation)}
                />
              ))}
            </div>
          )}

          <div className="nc-card nc-stack-xs">
            <div className="nc-eyebrow">Incontournables</div>
            {mustSee.map(([d, name]) => (
              <ResultRow key={d} designation={d} name={name} slot={slots.get(key(d))} onOpen={() => selectTarget(d)} />
            ))}
          </div>

          {tonightTypes.length > 0 && (
            <div className="nc-stack-xs">
              <div className="nc-eyebrow">Parcourir ce soir par type</div>
              <div className="nc-row nc-wrap" style={{ gap: "var(--space-xs)" }}>
                {tonightTypes.map(([type, n]) => (
                  <button key={type} onClick={() => onBrowseType(type)} className="nc-chip">
                    {type} <span className="nc-num" style={{ marginLeft: 6, opacity: 0.7 }}>{n}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
