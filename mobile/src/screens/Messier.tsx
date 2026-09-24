import { useCallback, useMemo, useState } from "react";
import { api } from "../api";
import { useFetch } from "../useFetch";
import { useRemembered } from "../useRemembered";
import { plural } from "../format";
import { tap } from "../haptics";
import { StaleNotice } from "../components/StaleNotice";
import { ErrorNotice } from "../components/ErrorNotice";
import { ScreenHeader } from "../components/ScreenHeader";
import { MagnitudeFilter, TypeChips, distinctTypes, magnitudeBounds } from "../components/CatalogFilters";

const MESSIER_TOTAL = 110;
const PAGE_SIZE = 24;

export function Messier({
  captured,
  onOpenTarget,
  onCaptureChange,
}: {
  captured: Set<string>;
  onOpenTarget: (designation: string) => void;
  onCaptureChange: () => void;
}) {
  // Memorises (voir useRemembered) : revenir d'une fiche retrouve l'ecran
  // tel qu'on l'avait laisse.
  const [onlyFeasible, setOnlyFeasible] = useRemembered("messier:feasible", false);
  const [types, setTypes] = useRemembered<string[]>("messier:types", []);
  const [magRange, setMagRange] = useRemembered<[number, number] | null>("messier:mag", null);
  const [showAll, setShowAll] = useRemembered("messier:all", false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const fetchMessier = useCallback(() => api.messier(onlyFeasible), [onlyFeasible]);
  const { data: rows, loading, error, fetchedAt, reload } = useFetch(
    fetchMessier,
    [onlyFeasible],
    `messier:${onlyFeasible}`,
  );

  const allTypes = useMemo(() => distinctTypes(rows), [rows]);
  const magBounds = useMemo(() => magnitudeBounds(rows), [rows]);
  // Meteo injoignable cote serveur : le catalogue arrive sans la faisabilite
  // du soir (voir api/routers/catalog.py). On le dit, plutot que de laisser
  // croire que rien n'est visible.
  const feasibilityUnknown = !!rows?.length && rows.every((r) => r.feasibleTonight == null);

  const toggleCapture = async (messierId: string, isCaptured: boolean) => {
    setCaptureError(null);
    try {
      await api.updateMessierCapture(messierId, !isCaptured);
      tap();
      onCaptureChange();
    } catch {
      setCaptureError("Capture non enregistrée : pas de réseau ? Réessayez dans un instant.");
    }
  };

  const toggleType = (t: string) =>
    setTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  const filtered = useMemo(() => {
    const [lo, hi] = magRange ?? [-Infinity, Infinity];
    return (rows ?? []).filter(
      (r) => (types.length === 0 || types.includes(r.type)) && (r.mag == null || (r.mag >= lo && r.mag <= hi)),
    );
  }, [rows, types, magRange]);

  const shown = showAll ? filtered : filtered.slice(0, PAGE_SIZE);
  const rest = filtered.length - shown.length;

  const capturedPct = Math.round((captured.size / MESSIER_TOTAL) * 100);

  return (
    <div className="nc-screen">
      <ScreenHeader
        eyebrow="Catalogue Messier"
        title={`${captured.size} sur ${MESSIER_TOTAL} capturés`}
      />

      <div className="nc-stack-xs">
        <div style={{ height: 8, borderRadius: 4, background: "var(--bar)", overflow: "hidden" }}>
          <div style={{ width: `${capturedPct}%`, height: "100%", background: "var(--accent)" }} />
        </div>
        <div className="nc-num nc-caption">{capturedPct} % du catalogue</div>
      </div>

      <button
        onClick={() => setOnlyFeasible((v) => !v)}
        className={`nc-chip ${onlyFeasible ? "nc-chip-active" : ""}`}
        style={{ alignSelf: "flex-start" }}
        aria-pressed={onlyFeasible}
      >
        Faisable ce soir uniquement
      </button>

      <TypeChips types={allTypes} selected={types} onToggle={toggleType} />
      <MagnitudeFilter bounds={magBounds} value={magRange} onChange={setMagRange} />

      {loading && !rows && <p className="nc-caption">Chargement…</p>}
      {error &&
        (rows ? (
          <StaleNotice when={fetchedAt} />
        ) : (
          <ErrorNotice message="Impossible de charger le catalogue." onRetry={reload} />
        ))}
      {feasibilityUnknown && (
        <div className="nc-notice">
          Prévision météo injoignable : le catalogue s'affiche, mais la visibilité de ce soir n'est pas connue.
        </div>
      )}
      {onlyFeasible && rows && rows.length === 0 && !error && (
        <p className="nc-caption">Aucun Messier faisable ce soir, ou prévision indisponible.</p>
      )}
      {rows && rows.length > 0 && filtered.length === 0 && (
        <p className="nc-caption">Aucun objet ne correspond à ces filtres.</p>
      )}
      {captureError && <div className="nc-notice">{captureError}</div>}

      <div className="nc-grid-2" style={{ gap: "var(--space-sm)" }}>
        {shown.map((row) => {
          const isCaptured = !!row.messierId && captured.has(row.messierId);
          return (
            <div key={row.designation} className="nc-card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <button
                onClick={() => onOpenTarget(row.designation)}
                className="nc-strip"
                style={{
                  position: "relative", height: 84, background: "var(--surf2)", border: "none",
                  borderBottom: "1px solid var(--line)", cursor: "pointer", padding: 0, overflow: "hidden",
                }}
              >
                {row.imageUrl && (
                  <img
                    src={row.imageUrl}
                    alt=""
                    loading="lazy"
                    // Meme raison que dans TargetRow : une vignette absente
                    // laisse la place a l'aplat, pas a l'icone cassee.
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                  />
                )}
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: 8 }}>
                  <span className="nc-num" style={{ fontSize: "var(--text-sm)", color: "var(--ink)", background: "var(--surf)", padding: "2px 5px", borderRadius: 4 }}>
                    {row.designation}
                  </span>
                  {/* « CE SOIR » est un mot, la designation au-dessus est un
                      numero : seule la seconde reste en chasse fixe.
                      Et ce n'est pas une mesure : ce badge empruntait le vert
                      de l'echelle bon/moyen/mauvais pour dire un simple oui,
                      et criait alors plus fort que le seul geste de cet ecran
                      -- marquer une capture. Sur une page qui suit une
                      collection, l'accent revient a la capture ; la
                      faisabilite du soir est un indice, et le filtre
                      « Faisable ce soir uniquement » est la pour qui la
                      cherche vraiment. Rien a afficher quand c'est non :
                      l'absence le dit deja, le tiret n'etait que du bruit. */}
                  {row.feasibleTonight && (
                    <span
                      style={{
                        fontFamily: "var(--font-display)", fontWeight: 600,
                        fontSize: "var(--text-xs)", letterSpacing: ".08em",
                        color: "var(--ink2)",
                        background: "var(--surf)", padding: "2px 5px", borderRadius: 4,
                      }}
                    >
                      CE SOIR
                    </span>
                  )}
                </div>
              </button>
              <div className="nc-stack-xs" style={{ padding: "var(--space-xs)" }}>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--ink2)", minHeight: 30 }}>
                  {row.commonName || row.type}
                </div>
                <button
                  onClick={() => row.messierId && toggleCapture(row.messierId, isCaptured)}
                  aria-pressed={isCaptured}
                  aria-label={`${row.designation} capturé`}
                  className="nc-btn"
                  style={{
                    background: isCaptured ? "var(--accent)" : "var(--surf2)",
                    color: isCaptured ? "var(--onaccent)" : "var(--ink2)",
                    borderRadius: 9,
                    padding: "0 var(--space-sm)",
                    fontSize: "var(--text-xs)",
                    textAlign: "center",
                    // `minHeight: 0` annulait le plancher tactile de .nc-btn :
                    // ces boutons tombaient a 34 px.
                  }}
                >
                  {isCaptured ? "Capturé ✓" : "Marquer capturé"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {!showAll && rest > 0 && (
        <button onClick={() => setShowAll(true)} className="nc-link" style={{ alignSelf: "center" }}>
          Voir {plural(rest, "objet de plus", "objets de plus")}
        </button>
      )}
    </div>
  );
}
