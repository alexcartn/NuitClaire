import { useCallback, useMemo } from "react";
import { api } from "../api";
import { useFetch } from "../useFetch";
import { useRemembered } from "../useRemembered";
import { plural } from "../format";
import { StaleNotice } from "../components/StaleNotice";
import { ErrorNotice } from "../components/ErrorNotice";
import { ScreenHeader } from "../components/ScreenHeader";
import { TargetRowCard } from "../components/TargetRow";
import { MagnitudeFilter, TypeChips, distinctTypes, magnitudeBounds } from "../components/CatalogFilters";

const PAGE_SIZE = 24;

export function Cibles({
  captured,
  windowLabel,
  onOpenTarget,
}: {
  captured: Set<string>;
  /** "nuit complète" ou "20:00–22:30" : le titre annoncait « nuit complete »
   * en dur, meme en fenetre habituelle. */
  windowLabel: string;
  onOpenTarget: (designation: string) => void;
}) {
  // Memorises (voir useRemembered) : ouvrir une fiche puis revenir ne remet
  // plus les filtres a zero.
  const [types, setTypes] = useRemembered<string[]>("cibles:types", []);
  const [magRange, setMagRange] = useRemembered<[number, number] | null>("cibles:mag", null);
  const [showAll, setShowAll] = useRemembered("cibles:all", false);

  const fetchTargets = useCallback(() => api.targets(types.length ? types : undefined), [types]);
  const { data: rows, loading, error, fetchedAt, reload } = useFetch(
    fetchTargets,
    [types],
    // Meme cle que "Ce soir" quand aucun filtre n'est pose : c'est la meme
    // requete, inutile d'en stocker deux copies.
    types.length ? `targets:${[...types].sort().join(",")}` : "targets",
  );

  const allTypes = useMemo(() => distinctTypes(rows), [rows]);
  const magBounds = useMemo(() => magnitudeBounds(rows), [rows]);

  const toggleType = (t: string) =>
    setTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  // Filtre magnitude cote client : les cibles sont deja chargees (faisables
  // ce soir), pas besoin d'un aller-retour API pour affiner sur une colonne
  // deja presente dans les lignes recues.
  const filtered = useMemo(() => {
    if (!magRange) return rows ?? [];
    const [lo, hi] = magRange;
    return (rows ?? []).filter((r) => r.mag == null || (r.mag >= lo && r.mag <= hi));
  }, [rows, magRange]);

  const shown = showAll ? filtered : filtered.slice(0, PAGE_SIZE);
  const rest = filtered.length - shown.length;

  return (
    <div className="nc-screen">
      <ScreenHeader
        eyebrow="Cibles faisables"
        title={rows ? `${plural(filtered.length, "cible", "cibles")} · ${windowLabel}` : "Chargement…"}
        sub="Triées par Messier manquants, puis cadrage simple, puis heures disponibles."
      />

      <MagnitudeFilter bounds={magBounds} value={magRange} onChange={setMagRange} />
      <TypeChips types={allTypes} selected={types} onToggle={toggleType} />

      {loading && !rows && <p className="nc-caption">Chargement…</p>}
      {error &&
        (rows ? (
          <StaleNotice when={fetchedAt} />
        ) : (
          <ErrorNotice message="Impossible de charger les cibles de la nuit." onRetry={reload} />
        ))}

      {shown.map((row) => (
        <TargetRowCard
          key={row.designation}
          row={row}
          isNew={!!row.messierId && !captured.has(row.messierId)}
          onOpen={() => onOpenTarget(row.designation)}
        />
      ))}

      {!showAll && rest > 0 && (
        <button onClick={() => setShowAll(true)} className="nc-link" style={{ alignSelf: "center" }}>
          Voir {plural(rest, "cible de plus", "cibles de plus")}
        </button>
      )}
      {rows && rows.length === 0 && (
        <p className="nc-caption">Aucune cible exploitable cette nuit (météo, Lune ou horizon dégagé).</p>
      )}
      {rows && rows.length > 0 && filtered.length === 0 && (
        <p className="nc-caption">Aucune cible ne correspond à ces filtres.</p>
      )}
    </div>
  );
}
