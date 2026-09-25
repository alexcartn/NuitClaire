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
import { InstrumentSwitch } from "../components/InstrumentSwitch";
import type { Instrument } from "../types";
import { Section } from "../components/Section";
import { useRemembered } from "../useRemembered";

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
/** Au-dela, les puces du calendrier font un mur : les mieux places d'abord,
 * le reste sur demande. */
const CAL_MAX = 15;
const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

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
  instrument,
  binocularsLabel,
  onInstrumentChange,
  onOpenTarget,
}: {
  captured: Set<string>;
  instrument: Instrument;
  binocularsLabel?: string;
  onInstrumentChange: () => void;
  onOpenTarget: (designation: string) => void;
}) {
  // Une liste et une saison par instrument : aux jumelles, les hauteurs et
  // la tolerance a la Lune ne sont pas celles du Seestar.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchRows = useCallback(() => api.messier(false), [instrument]);
  const rows = useFetch(fetchRows, [instrument], instrument === "jumelles" ? "messier:false:jumelles" : "messier:false");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchSeason = useCallback(() => api.messierSeason(), [instrument]);
  const season = useFetch(fetchSeason, [instrument], instrument === "jumelles" ? "messier-season:jumelles" : "messier-season");
  const bino = instrument === "jumelles";
  const done = bino ? "vus" : "capturés";
  const sessions = useSessions();
  const [showAllGrid, setShowAllGrid] = useRemembered("messier:grid-all", true);
  const [addedTonight, setAddedTonight] = useState(false);
  const [openTonight, setOpenTonight] = useState(false);
  const [openLast, setOpenLast] = useState(false);
  const [openCal, setOpenCal] = useState(false);

  const today = new Date();
  const month = today.getMonth() + 1;
  const [calMonth, setCalMonth] = useRemembered("messier:calendar-month", month);

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
        eyebrow={bino ? "Messier aux jumelles" : "Objectif Messier"}
        title={
          <>
            <span className="nc-num">{dex.capturedCount}</span> sur {MESSIER_TOTAL} {done}
          </>
        }
      />

      <InstrumentSwitch instrument={instrument} binocularsLabel={binocularsLabel} onChanged={onInstrumentChange} />
      {bino && (
        <p className="nc-caption" style={{ margin: 0 }}>
          Un objectif à part : « vu aux jumelles » ne compte pas comme photographié, et inversement.
        </p>
      )}

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
        <Section id="messier-last" title="Dernière chance" count={dex.lastChance.length}>
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
        </Section>
      )}

      {season.data && (
        <Section id="messier-calendar" title="Calendrier de chasse">
          {/* Un mois = une case : combien de manquants y sont observables.
              Remplace les listes « ce mois-ci » et « a venir » : on voit
              d'un coup d'oeil ou sont les creux et les pics de l'annee. */}
          <div className="nc-month-grid" role="tablist" aria-label="Mois">
            {dex.calendar.map((list, m) => (
              <button
                key={m}
                role="tab"
                aria-selected={m + 1 === calMonth}
                onClick={() => {
                  setCalMonth(m + 1);
                  setOpenCal(false);
                }}
                className={[
                  "nc-month",
                  m + 1 === calMonth ? "nc-month-active" : "",
                  m + 1 === month ? "nc-month-now" : "",
                  list.length === 0 ? "nc-month-empty" : "",
                ].join(" ")}
              >
                <span>{MONTHS_SHORT[m]}</span>
                <span className="nc-month-count">{list.length}</span>
              </button>
            ))}
          </div>
          <p className="nc-caption" style={{ margin: 0 }}>
            {dex.calendar[calMonth - 1].length === 0
              ? `Aucun Messier manquant observable en ${MONTHS_FR[calMonth - 1]}.`
              : `${plural(dex.calendar[calMonth - 1].length, "manquant observable", "manquants observables")} en ${MONTHS_FR[calMonth - 1]}${calMonth === month ? " (ce mois-ci)" : ""}, les mieux placés d'abord.`}
          </p>
          <DexChips
            entries={openCal ? dex.calendar[calMonth - 1] : dex.calendar[calMonth - 1].slice(0, CAL_MAX)}
            onOpen={onOpenTarget}
          />
          {dex.calendar[calMonth - 1].length > CAL_MAX && (
            <button onClick={() => setOpenCal((v) => !v)} className="nc-link" aria-expanded={openCal}>
              {openCal ? "Réduire" : `Voir les ${dex.calendar[calMonth - 1].length - CAL_MAX} autres`}
            </button>
          )}
        </Section>
      )}

      {dex.hiddenByHorizon.length + dex.outOfReach.length > 0 && (
        <Section
          id="messier-unreachable"
          title="Pas visibles d'ici"
          count={dex.hiddenByHorizon.length + dex.outOfReach.length}
          defaultOpen={false}
        >
          {dex.hiddenByHorizon.length > 0 && (
            <div className="nc-stack-xs">
              <span className="nc-caption" style={{ color: "var(--ink2)" }}>
                Masqués par ton horizon : assez hauts, mais seulement dans des directions non cochées dans
                Réglages.
              </span>
              <DexChips entries={dex.hiddenByHorizon} onOpen={onOpenTarget} />
            </div>
          )}
          {dex.outOfReach.length > 0 && (
            <div className="nc-stack-xs">
              <span className="nc-caption" style={{ color: "var(--ink2)" }}>
                Hors de portée : culminent sous {dex.outOfReach[0].season?.minAltDeg ?? 12}° depuis ce site, il
                faudra une sortie plus au sud.
              </span>
              <DexChips entries={dex.outOfReach} onOpen={onOpenTarget} />
            </div>
          )}
        </Section>
      )}

      <Section id="messier-grid" title="Le catalogue" count={dex.capturedCount}>
        <button
          onClick={() => setShowAllGrid((v) => !v)}
          className={`nc-chip ${showAllGrid ? "" : "nc-chip-active"}`}
          style={{ alignSelf: "flex-start" }}
          aria-pressed={!showAllGrid}
        >
          Manquants seulement
        </button>
        <div className="nc-dex-grid">
          {shownGrid.map((e) => (
            <button
              key={e.id}
              onClick={() => onOpenTarget(e.designation)}
              className={`nc-dex-cell ${e.captured ? "nc-dex-captured" : "nc-strip"}`}
              aria-label={`${e.designation}${e.captured ? (bino ? ", vu" : ", capturé") : ""}${e.tonight ? ", visible ce soir" : ""}`}
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
      </Section>
    </div>
  );
}
