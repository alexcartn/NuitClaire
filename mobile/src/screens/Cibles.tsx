import { useCallback, useMemo } from "react";
import { api } from "../api";
import { useFetch } from "../useFetch";
import { useRemembered } from "../useRemembered";
import { plural } from "../format";
import { StaleNotice } from "../components/StaleNotice";
import { ErrorNotice } from "../components/ErrorNotice";
import { ScreenHeader } from "../components/ScreenHeader";
import { Section } from "../components/Section";
import { TargetRowCompact } from "../components/TargetRowCompact";
import { CiblesSwitch } from "../components/CiblesSwitch";
import { MagnitudeFilter, TypeChips, distinctTypes, magnitudeBounds } from "../components/CatalogFilters";
import {
  activeFilterCount,
  applyFilters,
  groupRows,
  hourLabel,
  nightHours,
  visibleDuring,
  type CiblesGroup,
} from "../ciblesView";
import type { TargetRow } from "../types";

/** Cartes affichees par groupe avant « Voir les N autres ». */
const GROUP_PAGE = 8;

function GroupSection({ group, index, onOpenTarget }: {
  group: CiblesGroup;
  index: number;
  onOpenTarget: (designation: string) => void;
}) {
  const [all, setAll] = useRemembered(`cibles:all:${group.key}`, false);
  const shown = all ? group.rows : group.rows.slice(0, GROUP_PAGE);
  return (
    // Le premier groupe ouvert (les Messier a capturer quand il y en a), les
    // autres replies : on deplie le type qui interesse.
    <Section id={`cibles:${group.key}`} title={group.title} count={group.rows.length} defaultOpen={index === 0}>
      {/* Deux rangees de front sur grand ecran (voir desktop.css). */}
      <div className="nc-trow-grid">
        {shown.map((row) => (
          <TargetRowCompact key={row.designation} row={row} onOpen={() => onOpenTarget(row.designation)} />
        ))}
      </div>
      {group.rows.length > GROUP_PAGE && (
        <button onClick={() => setAll((v) => !v)} className="nc-link" style={{ alignSelf: "center" }} aria-expanded={all}>
          {all ? "Réduire" : `Voir les ${group.rows.length - GROUP_PAGE} autres`}
        </button>
      )}
    </Section>
  );
}

/** « Quoi photographier ce soir », sur tout le catalogue. Organisee comme la
 * page Messier : une vue d'ensemble de la nuit heure par heure, puis des
 * groupes repliables, les filtres ranges dans leur propre section. */
export function Cibles({
  captured,
  windowLabel,
  onOpenTarget,
  onSwitch,
}: {
  captured: Set<string>;
  /** "nuit complète" ou "20:00–22:30" : le titre annoncait « nuit complete »
   * en dur, meme en fenetre habituelle. */
  windowLabel: string;
  onOpenTarget: (designation: string) => void;
  /** Bascule vers l'objectif Messier (meme onglet de la barre). */
  onSwitch: (screen: "cibles" | "messier") => void;
}) {
  // Memorises (voir useRemembered) : ouvrir une fiche puis revenir ne remet
  // plus les filtres a zero.
  const [types, setTypes] = useRemembered<string[]>("cibles:types", []);
  const [magRange, setMagRange] = useRemembered<[number, number] | null>("cibles:mag", null);
  const [singleFrame, setSingleFrame] = useRemembered("cibles:single", false);
  const [hour, setHour] = useRemembered<number | null>("cibles:hour", null);

  // Une seule requete, filtree sur le telephone : filtrer par type cote
  // serveur faisait disparaitre les autres types des puces des qu'on en
  // choisissait un. Meme cle que « Ce soir » : c'est la meme liste.
  const fetchTargets = useCallback(() => api.targets(), []);
  const { data: rows, loading, error, fetchedAt, reload } = useFetch(fetchTargets, [], "targets");

  const filters = { types, magRange, singleFrame };
  const allTypes = useMemo(() => distinctTypes(rows), [rows]);
  const magBounds = useMemo(() => magnitudeBounds(rows), [rows]);
  const filtered = useMemo(
    () => applyFilters(rows ?? [], filters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, types, magRange, singleFrame],
  );
  const hours = useMemo(() => nightHours(rows ?? []), [rows]);
  const selectedHour = hour != null && hours.includes(hour) ? hour : null;
  const visible: TargetRow[] = useMemo(
    () => (selectedHour == null ? filtered : filtered.filter((r) => visibleDuring(r, selectedHour))),
    [filtered, selectedHour],
  );
  const groups = useMemo(
    () => groupRows(visible, captured),
    [visible, captured],
  );
  const nFilters = activeFilterCount(filters);

  const toggleType = (t: string) =>
    setTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  const resetFilters = () => {
    setTypes([]);
    setMagRange(null);
    setSingleFrame(false);
  };

  return (
    <div className="nc-screen">
      <ScreenHeader
        eyebrow="Cibles faisables"
        title={rows ? `${plural(visible.length, "cible", "cibles")} · ${selectedHour != null ? `vers ${hourLabel(selectedHour)}` : windowLabel}` : "Chargement…"}
      />

      <CiblesSwitch active="cibles" onSelect={onSwitch} />


      {loading && !rows && <p className="nc-caption">Chargement…</p>}
      {error &&
        (rows ? (
          <StaleNotice when={fetchedAt} />
        ) : (
          <ErrorNotice message="Impossible de charger les cibles de la nuit." onRetry={reload} />
        ))}

      {rows && rows.length > 0 && (
        <Section id="cibles-filters" title="Filtres" count={nFilters || undefined} defaultOpen={false}>
          <TypeChips types={allTypes} selected={types} onToggle={toggleType} />
          <MagnitudeFilter bounds={magBounds} value={magRange} onChange={setMagRange} />
          <button
            onClick={() => setSingleFrame((v) => !v)}
            className={`nc-chip ${singleFrame ? "nc-chip-active" : ""}`}
            style={{ alignSelf: "flex-start" }}
            aria-pressed={singleFrame}
          >
            Cadre unique seulement
          </button>
          {nFilters > 0 && (
            <button onClick={resetFilters} className="nc-link">
              Tout réinitialiser
            </button>
          )}
        </Section>
      )}

      {hours.length > 1 && (
        // Le pendant du calendrier Messier, a l'echelle de la nuit : combien
        // de cibles (filtres compris) sont pointables a chaque heure. Un
        // appui filtre la liste sur cette heure, un second l'enleve.
        <div className="nc-stack-xs">
          <div className="nc-row nc-between nc-baseline">
            <div className="nc-eyebrow">À quelle heure ?</div>
            <span className="nc-caption" style={{ margin: 0 }}>
              {selectedHour != null
                ? `${hourLabel(selectedHour)} à ${hourLabel(selectedHour + 60)}`
                : "toute la nuit"}
            </span>
          </div>
          <div className="nc-row nc-hscroll" role="tablist" aria-label="Heures de la nuit" style={{ gap: "var(--space-xs)" }}>
            <button
              role="tab"
              aria-selected={selectedHour == null}
              onClick={() => setHour(null)}
              className={`nc-hour ${selectedHour == null ? "nc-hour-active" : ""}`}
            >
              <span className="nc-hour-label">Toutes</span>
              <span className="nc-hour-count nc-num">{filtered.length}</span>
            </button>
            {hours.map((h) => {
              const n = filtered.filter((r) => visibleDuring(r, h)).length;
              return (
                <button
                  key={h}
                  role="tab"
                  aria-selected={h === selectedHour}
                  onClick={() => setHour(h === selectedHour ? null : h)}
                  className={["nc-hour", h === selectedHour ? "nc-hour-active" : "", n === 0 ? "nc-hour-empty" : ""].join(" ")}
                >
                  <span className="nc-hour-label nc-num">{hourLabel(h)}</span>
                  <span className="nc-hour-count nc-num">{n}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {groups.map((g, i) => (
        <GroupSection key={g.key} group={g} index={i} onOpenTarget={onOpenTarget} />
      ))}

      {rows && rows.length === 0 && (
        <p className="nc-caption">Aucune cible exploitable cette nuit (météo, Lune ou horizon dégagé).</p>
      )}
      {rows && rows.length > 0 && visible.length === 0 && (
        <div className="nc-notice nc-row nc-between">
          <span>Aucune cible ne correspond à ces filtres{selectedHour != null ? " à cette heure" : ""}.</span>
          <button
            onClick={() => {
              resetFilters();
              setHour(null);
            }}
            className="nc-chip"
          >
            Tout afficher
          </button>
        </div>
      )}
    </div>
  );
}
