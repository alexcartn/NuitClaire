import { useCallback, useMemo, useState } from "react";
import { api } from "../api";
import { useFetch } from "../useFetch";
import { TargetRowCard } from "../components/TargetRow";

const PAGE_SIZE = 24;

export function Cibles({
  captured,
  onOpenTarget,
}: {
  captured: Set<string>;
  onOpenTarget: (designation: string) => void;
}) {
  const [types, setTypes] = useState<string[]>([]);
  const [maxMag, setMaxMag] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  const fetchTargets = useCallback(() => api.targets(types.length ? types : undefined), [types]);
  const { data: rows, loading, error } = useFetch(fetchTargets, [types]);

  const allTypes = useMemo(() => {
    const seen = new Set<string>();
    (rows ?? []).forEach((r) => seen.add(r.type));
    return [...seen].sort();
  }, [rows]);

  // Bornes de magnitude derivees des cibles chargees (pas fixes) : la plage
  // varie selon le catalogue (targets vs types selectionnes), donc le
  // curseur doit toujours couvrir tout ce qui est effectivement affichable.
  const magBounds = useMemo(() => {
    const values = (rows ?? []).map((r) => r.mag).filter((m): m is number => m != null);
    if (!values.length) return null;
    return { min: Math.floor(Math.min(...values)), max: Math.ceil(Math.max(...values)) };
  }, [rows]);

  const toggleType = (t: string) =>
    setTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  // Filtre magnitude cote client : les cibles sont deja chargees (feasibles
  // ce soir), pas besoin d'un aller-retour API pour affiner sur une colonne
  // deja presente dans les lignes recues.
  const filtered = useMemo(
    () => (rows ?? []).filter((r) => maxMag == null || r.mag == null || r.mag <= maxMag),
    [rows, maxMag],
  );

  const shown = showAll ? filtered : filtered.slice(0, PAGE_SIZE);
  const rest = filtered.length - shown.length;

  return (
    <div className="nc-screen">
      <div>
        <div className="nc-eyebrow">Cibles faisables</div>
        <div className="nc-title">{rows ? `${filtered.length} cibles · nuit complete` : "Chargement..."}</div>
        <div className="nc-sub">Triees par Messier manquants, puis cadrage simple, puis heures disponibles.</div>
      </div>

      {magBounds && magBounds.max > magBounds.min && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="nc-caption" style={{ margin: 0, flex: "none" }}>
            Magnitude max {(maxMag ?? magBounds.max).toFixed(1)}
          </span>
          <input
            type="range"
            min={magBounds.min}
            max={magBounds.max}
            step={0.5}
            value={maxMag ?? magBounds.max}
            onChange={(e) => setMaxMag(Number(e.target.value))}
            style={{ flex: 1 }}
          />
        </div>
      )}

      {allTypes.length > 0 && (
        <div style={{ display: "flex", gap: 7, overflow: "auto", margin: "0 -18px", padding: "0 18px 2px" }}>
          {allTypes.map((t) => (
            <button
              key={t}
              onClick={() => toggleType(t)}
              className={`nc-chip ${types.includes(t) ? "nc-chip-active" : ""}`}
              style={{ flex: "none" }}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {loading && <p className="nc-caption">Chargement...</p>}
      {error && <p className="nc-caption">Erreur de chargement des cibles.</p>}

      {shown.map((row) => (
        <TargetRowCard
          key={row.designation}
          row={row}
          isNew={!!row.messierId && !captured.has(row.messierId)}
          onOpen={() => onOpenTarget(row.designation)}
        />
      ))}

      {!showAll && rest > 0 && (
        <button onClick={() => setShowAll(true)} className="nc-caption" style={{ background: "none", border: "none", cursor: "pointer", padding: "6px 0" }}>
          Voir {rest} cible(s) de plus
        </button>
      )}
      {rows && rows.length === 0 && (
        <p className="nc-caption">Aucune cible exploitable cette nuit (meteo, Lune ou horizon degage).</p>
      )}
      {rows && rows.length > 0 && filtered.length === 0 && (
        <p className="nc-caption">Aucune cible ne correspond a ces filtres.</p>
      )}
    </div>
  );
}
