import { useCallback, useMemo, useState } from "react";
import { api } from "../api";
import { useFetch } from "../useFetch";
import { useSessions, mutate } from "../useSessions";
import { newOp } from "../sessionQueue";
import { plural } from "../format";
import { tap } from "../haptics";
import { buildDex, captureDates, MESSIER_TOTAL, MONTHS_FR, pace, type DexEntry } from "../messierDex";
import { StaleNotice } from "../components/StaleNotice";
import { ErrorNotice } from "../components/ErrorNotice";
import { ScreenHeader } from "../components/ScreenHeader";

/** Dernier mois de la periode de visibilite en cours (pour « visible
 * jusqu'en novembre »). */
function visibleUntil(e: DexEntry, month0: number): string | null {
  if (!e.season) return null;
  let last: number | null = null;
  for (let k = 0; k < 12; k++) {
    const m = (month0 + k) % 12;
    if (e.season.monthHours[m] > 0) last = m;
    else break;
  }
  return last === null ? null : MONTHS_FR[last];
}

const LIST_MAX = 6;

/** "environ 8 mois", "environ 2 ans et demi". */
function remainingLabel(months: number): string {
  if (months < 18) return `environ ${months} mois`;
  const halfYears = Math.round(months / 6) / 2;
  const whole = Math.floor(halfYears);
  return `environ ${whole} an${whole > 1 ? "s" : ""}${halfYears % 1 ? " et demi" : ""}`;
}

function fmtCaptureDate(iso: string): string {
  return new Date(iso + "T00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "2-digit" });
}

/** Rangee de designations a toucher pour ouvrir la fiche. */
function DexChips({ entries, onOpen }: { entries: DexEntry[]; onOpen: (d: string) => void }) {
  return (
    <div className="nc-row nc-wrap" style={{ gap: "var(--space-xs)" }}>
      {entries.map((e) => (
        <button key={e.id} onClick={() => onOpen(e.designation)} className="nc-chip nc-num">
          {e.designation}
        </button>
      ))}
    </div>
  );
}

/** Le Pokedex Messier : l'objectif des 110. « Cibles » repond a « quoi
 * photographier ce soir » sur tout le catalogue ; cette page-ci repond a
 * « ou en suis-je, et que chasser ensuite » -- d'ou l'absence de filtres par
 * type ou magnitude, qui etaient la meme liste qu'a cote (voir messierDex.ts
 * pour le classement). */
export function Messier({
  captured,
  onOpenTarget,
}: {
  captured: Set<string>;
  onOpenTarget: (designation: string) => void;
}) {
  const fetchRows = useCallback(() => api.messier(false), []);
  const rows = useFetch(fetchRows, [], "messier:false");
  const fetchSeason = useCallback(() => api.messierSeason(), []);
  const season = useFetch(fetchSeason, [], "messier-season");
  const sessions = useSessions();
  const [showAllGrid, setShowAllGrid] = useState(true);
  const [addedTonight, setAddedTonight] = useState(false);
  const [openTonight, setOpenTonight] = useState(false);
  const [openLast, setOpenLast] = useState(false);

  const today = new Date();
  const month = today.getMonth() + 1;

  const ngcToId = useMemo(
    () => new Map((rows.data ?? []).filter((r) => r.ngc && r.messierId).map((r) => [r.ngc!.toUpperCase(), r.messierId!])),
    [rows.data],
  );
  const dates = useMemo(() => captureDates(sessions.data, ngcToId), [sessions.data, ngcToId]);
  const dex = useMemo(
    () => buildDex(rows.data, season.data, captured, dates, month),
    [rows.data, season.data, captured, dates, month],
  );
  const rhythm = pace(dates, dex.capturedCount, today);
  const pct = Math.round((dex.capturedCount / MESSIER_TOTAL) * 100);
  const feasibilityUnknown = !!rows.data?.length && rows.data.every((r) => r.feasibleTonight == null);
  const loading = (rows.loading && !rows.data) || (season.loading && !season.data);

  // Les premiers seulement : une nuit ne suffit pas a 27 objets, et le plan
  // se lit mieux court. Le bouton ajoute ce qui est affiche.
  const tonightShown = openTonight ? dex.tonight : dex.tonight.slice(0, LIST_MAX);
  const lastShown = openLast ? dex.lastChance : dex.lastChance.slice(0, LIST_MAX);

  const addTonight = () => {
    tonightShown.forEach((e) => mutate(newOp({ kind: "addItem", designation: e.designation })));
    tap();
    setAddedTonight(true);
  };

  const shownGrid = showAllGrid ? dex.entries : dex.entries.filter((e) => !e.captured);

  return (
    <div className="nc-screen">
      <ScreenHeader
        eyebrow="Objectif Messier"
        title={
          <>
            <span className="nc-num">{dex.capturedCount}</span> sur {MESSIER_TOTAL} capturés
          </>
        }
      />

      <div className="nc-card nc-stack">
        <div style={{ height: 10, borderRadius: 5, background: "var(--bar)", overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: "var(--accent)" }} />
        </div>
        <div className="nc-grid-2" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
          <div className="nc-stack-xs" style={{ gap: 0 }}>
            <span className="nc-num" style={{ fontSize: "var(--text-lg)" }}>{pct} %</span>
            <span className="nc-caption">du catalogue</span>
          </div>
          <div className="nc-stack-xs" style={{ gap: 0 }}>
            <span className="nc-num" style={{ fontSize: "var(--text-lg)" }}>{rhythm.thisMonth}</span>
            <span className="nc-caption">ce mois-ci</span>
          </div>
          <div className="nc-stack-xs" style={{ gap: 0 }}>
            <span className="nc-num" style={{ fontSize: "var(--text-lg)" }}>{rhythm.thisYear}</span>
            <span className="nc-caption">cette année</span>
          </div>
        </div>
        <p className="nc-caption" style={{ margin: 0 }}>
          {rhythm.monthsToGo != null
            ? `À ce rythme (${plural(rhythm.lastYear, "capture datée", "captures datées")} sur 12 mois), il reste ${remainingLabel(rhythm.monthsToGo)} de chasse.`
            : "Le rythme s'affichera avec au moins trois captures datées par le journal."}
          {dex.outOfReach.length > 0 &&
            ` ${plural(dex.outOfReach.length, "objet reste", "objets restent")} hors de portée d'ici.`}
        </p>
      </div>

      {loading && <p className="nc-caption">Chargement…</p>}
      {rows.error &&
        (rows.data ? <StaleNotice when={rows.fetchedAt} /> : <ErrorNotice message="Impossible de charger le catalogue." onRetry={rows.reload} />)}
      {season.error && !season.data && (
        <ErrorNotice message="Impossible de calculer les saisons." onRetry={season.reload} />
      )}
      {feasibilityUnknown && (
        <div className="nc-notice">
          Prévision météo injoignable : la chasse de ce soir n'est pas connue, le reste l'est.
        </div>
      )}

      {dex.tonight.length > 0 && (
        <div className="nc-card nc-stack" style={{ borderColor: "var(--accent)" }}>
          <div className="nc-row nc-between nc-baseline">
            <div className="nc-eyebrow">À chasser ce soir</div>
            <span className="nc-caption">{plural(dex.tonight.length, "manquant", "manquants")}</span>
          </div>
          <div className="nc-stack-xs">
            {tonightShown.map((e) => (
              <button key={e.id} onClick={() => onOpenTarget(e.designation)} className="nc-plan-row">
                <span className="nc-num nc-none" style={{ fontSize: "var(--text-sm)" }}>
                  {e.row?.start}–{e.row?.end}
                </span>
                <span className="nc-num nc-none" style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>
                  {e.designation}
                </span>
                <span className="nc-grow nc-ellipsis nc-caption" style={{ margin: 0 }}>
                  {e.leavingSoon ? "dernière chance · " : ""}
                  {e.row?.commonName || e.row?.type}
                </span>
              </button>
            ))}
          </div>
          {dex.tonight.length > LIST_MAX && (
            <button onClick={() => setOpenTonight((v) => !v)} className="nc-link" aria-expanded={openTonight}>
              {openTonight ? "Réduire" : `Voir les ${dex.tonight.length - LIST_MAX} autres`}
            </button>
          )}
          <button onClick={addTonight} disabled={addedTonight} className="nc-btn">
            {addedTonight
              ? "Ajoutés au journal ✓"
              : `Ajouter ${tonightShown.length === 1 ? "cet objet" : `ces ${tonightShown.length}`} au journal`}
          </button>
        </div>
      )}

      {dex.lastChance.length > 0 && (
        <div className="nc-card nc-stack">
          <div className="nc-eyebrow">Dernière chance</div>
          <p className="nc-caption" style={{ margin: 0 }}>
            Encore visibles le soir, plus dans un ou deux mois : sinon, rendez-vous l'an prochain.
          </p>
          <div className="nc-stack-xs">
            {lastShown.map((e) => (
              <button key={e.id} onClick={() => onOpenTarget(e.designation)} className="nc-plan-row">
                <span className="nc-num nc-none" style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>
                  {e.designation}
                </span>
                <span className="nc-grow nc-ellipsis nc-caption" style={{ margin: 0 }}>
                  {e.row?.commonName || e.row?.type}
                </span>
                <span className="nc-caption nc-none">jusqu'en {visibleUntil(e, month - 1)}</span>
              </button>
            ))}
          </div>
          {dex.lastChance.length > LIST_MAX && (
            <button onClick={() => setOpenLast((v) => !v)} className="nc-link" aria-expanded={openLast}>
              {openLast ? "Réduire" : `Voir les ${dex.lastChance.length - LIST_MAX} autres`}
            </button>
          )}
        </div>
      )}

      {dex.thisMonth.length > 0 && (
        <div className="nc-stack-xs">
          <div className="nc-eyebrow">Visibles ce mois-ci, pas ce soir</div>
          <DexChips entries={dex.thisMonth} onOpen={onOpenTarget} />
        </div>
      )}

      {dex.upcoming.length > 0 && (
        <div className="nc-stack">
          <div className="nc-eyebrow">À venir</div>
          {dex.upcoming.map((g) => (
            <div key={g.month} className="nc-stack-xs">
              <span className="nc-caption" style={{ textTransform: "capitalize" }}>
                {MONTHS_FR[g.month - 1]}
              </span>
              <DexChips entries={g.entries} onOpen={onOpenTarget} />
            </div>
          ))}
        </div>
      )}

      {dex.hiddenByHorizon.length > 0 && (
        <div className="nc-stack-xs">
          <div className="nc-eyebrow">Masqués par ton horizon</div>
          <p className="nc-caption" style={{ margin: 0 }}>
            Assez hauts depuis ici, mais seulement dans des directions non cochées dans Réglages.
          </p>
          <DexChips entries={dex.hiddenByHorizon} onOpen={onOpenTarget} />
        </div>
      )}

      {dex.outOfReach.length > 0 && (
        <div className="nc-stack-xs">
          <div className="nc-eyebrow">Hors de portée d'ici</div>
          <p className="nc-caption" style={{ margin: 0 }}>
            Culminent sous {dex.outOfReach[0].season?.minAltDeg ?? 12}° depuis ce site : il faudra une sortie
            plus au sud.
          </p>
          <DexChips entries={dex.outOfReach} onOpen={onOpenTarget} />
        </div>
      )}

      <div className="nc-stack">
        <div className="nc-row nc-between">
          <div className="nc-eyebrow">Le catalogue</div>
          <button
            onClick={() => setShowAllGrid((v) => !v)}
            className={`nc-chip ${showAllGrid ? "" : "nc-chip-active"}`}
            aria-pressed={!showAllGrid}
          >
            Manquants seulement
          </button>
        </div>
        <div className="nc-dex-grid">
          {shownGrid.map((e) => (
            <button
              key={e.id}
              onClick={() => onOpenTarget(e.designation)}
              className={`nc-dex-cell ${e.captured ? "nc-dex-captured" : "nc-strip"}`}
              aria-label={`${e.designation}${e.captured ? ", capturé" : ""}${e.tonight ? ", visible ce soir" : ""}`}
            >
              {e.captured && e.row?.imageUrl && (
                <img
                  src={e.row.imageUrl}
                  alt=""
                  loading="lazy"
                  onError={(ev) => {
                    ev.currentTarget.style.display = "none";
                  }}
                />
              )}
              <span className="nc-dex-number nc-num">{e.designation}</span>
              {e.captured
                ? e.capturedOn && <span className="nc-dex-note nc-num">{fmtCaptureDate(e.capturedOn)}</span>
                : e.tonight && <span className="nc-dex-note">ce soir</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
