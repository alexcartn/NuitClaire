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
  const [showAll, setShowAll] = useState(false);

  const fetchTargets = useCallback(() => api.targets(types.length ? types : undefined), [types]);
  const { data: rows, loading, error } = useFetch(fetchTargets, [types]);

  const allTypes = useMemo(() => {
    const seen = new Set<string>();
    (rows ?? []).forEach((r) => seen.add(r.type));
    return [...seen].sort();
  }, [rows]);

  const toggleType = (t: string) =>
    setTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  const shown = showAll ? rows ?? [] : (rows ?? []).slice(0, PAGE_SIZE);
  const rest = (rows?.length ?? 0) - shown.length;

  return (
    <div className="nc-screen">
      <div>
        <div className="nc-eyebrow">Cibles faisables</div>
        <div className="nc-title">{rows ? `${rows.length} cibles · nuit complete` : "Chargement..."}</div>
        <div className="nc-sub">Triees par Messier manquants, puis cadrage simple, puis heures disponibles.</div>
      </div>

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
    </div>
  );
}
