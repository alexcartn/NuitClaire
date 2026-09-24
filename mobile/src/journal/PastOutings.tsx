import { useState } from "react";
import { downloadText, journalToMarkdown, outingToMarkdown } from "../journalRead";
import { latestMonth, outingYears, outingsByMonth } from "../journalView";
import { useRemembered } from "../useRemembered";
import { plural } from "../format";
import { Section } from "../components/Section";
import { TabIcon } from "../components/TabIcon";
import type { Feeling, PastSession, Sessions, Site } from "../types";
import { PastConditions } from "./Conditions";
import { fmtDate } from "./format";
import { OutingPlace } from "./OutingPlace";
import { PastFeeling } from "./PastFeeling";
import { Timeline } from "./Timeline";

type PastPatch = { note?: string; site?: Site } & Partial<Feeling>;

const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

interface OutingProps {
  outing: PastSession;
  places: Site[];
  reopenBlocked: string | null;
  reopening: boolean;
  onSave: (closedAt: string, patch: PastPatch) => void;
  onReopen: (closedAt: string) => void;
  onOpenTarget: (designation: string) => void;
}

/** Une sortie, repliee sur son resume (date, score, cibles, satisfaction) :
 * on la deplie pour la relire ou la retoucher. */
function Outing({ outing: p, places, reopenBlocked, reopening, onSave, onReopen, onOpenTarget }: OutingProps) {
  const [open, setOpen] = useRemembered(`journal:outing:${p.closedAt}`, false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const summary = [
    p.score != null ? `score ${p.score}` : null,
    plural(p.targets.length, "cible", "cibles"),
    p.feeling.rating != null ? `${p.feeling.rating}/5` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="nc-card nc-stack-xs" style={{ padding: "var(--space-xs) var(--space-md)" }}>
      <button onClick={() => setOpen((v) => !v)} className="nc-item-toggle" aria-expanded={open}>
        <span className="nc-stack-xs" style={{ gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--ink)" }}>
            {/* Majuscule a la premiere lettre seulement : « capitalize »
                en mettait une a chaque mot, mois compris. */}
            {fmtDate(p.date).replace(/^./, (c) => c.toUpperCase())}
          </span>
          <span className="nc-num nc-caption nc-ellipsis">
            {summary}
            {p.targets.length > 0 && ` · ${p.targets.slice(0, 4).join(", ")}${p.targets.length > 4 ? "…" : ""}`}
          </span>
        </span>
        <span className={`nc-section-chevron ${open ? "nc-section-chevron-open" : ""}`}>
          <TabIcon name="chevron" />
        </span>
      </button>

      {open && (
        <div className="nc-stack-xs" style={{ paddingBottom: "var(--space-xs)" }}>
          {/* Cibles cliquables : en relisant une nuit, on veut pouvoir
              ouvrir la fiche d'une cible pour voir tout ce que le journal
              en dit. */}
          <div className="nc-row nc-wrap" style={{ gap: "var(--space-xs)" }}>
            {p.targets.length === 0 && <span className="nc-caption">aucune cible</span>}
            {p.targets.map((designation) => (
              <button key={designation} onClick={() => onOpenTarget(designation)} className="nc-chip nc-num">
                {designation}
              </button>
            ))}
          </div>
          <OutingPlace site={p.site} choices={places} onChange={(site) => onSave(p.closedAt, { site })} />
          <PastConditions conditions={p.conditions} />
          <PastFeeling feeling={p.feeling} onChange={(patch) => onSave(p.closedAt, patch)} />
          <input
            value={noteDraft ?? p.note}
            onChange={(e) => setNoteDraft(e.target.value)}
            onBlur={(e) => e.target.value !== p.note && onSave(p.closedAt, { note: e.target.value })}
            placeholder="Note de la sortie (facultatif)"
            aria-label="Note de la sortie"
            className="nc-input"
          />
          <div className="nc-row nc-wrap" style={{ columnGap: "var(--space-md)", rowGap: 0 }}>
            {p.timeline.length > 0 && (
              <button onClick={() => setShowTimeline((v) => !v)} className="nc-link" aria-expanded={showTimeline}>
                {showTimeline ? "Masquer le journal" : `Journal de la nuit (${p.timeline.length})`}
              </button>
            )}
            <button onClick={() => downloadText(`nuit-${p.date}.md`, outingToMarkdown(p))} className="nc-link">
              Exporter cette nuit
            </button>
            <button
              onClick={() => onReopen(p.closedAt)}
              disabled={reopenBlocked !== null || reopening}
              className="nc-link nc-link-accent"
              title={reopenBlocked ?? "Rouvrir cette sortie"}
            >
              {reopening ? "…" : "Rouvrir pour tout modifier"}
            </button>
          </div>
          {/* L'infobulle (title) ne s'affiche pas au doigt : la raison d'un
              « Rouvrir » grise est ecrite en clair. */}
          {reopenBlocked && <p className="nc-caption" style={{ margin: 0 }}>{reopenBlocked}.</p>}
          {showTimeline && <Timeline entries={p.timeline} />}
        </div>
      )}
    </div>
  );
}

/** Les sorties cloturees, rangees comme le calendrier Messier : l'annee,
 * douze mois avec leur nombre de sorties, puis celles du mois touche. */
export function PastOutings({ data, places, sessionActive, pendingCount, reopening, reopenError, onSave, onReopen, onOpenTarget }: {
  data: Sessions;
  places: Site[];
  sessionActive: boolean;
  pendingCount: number;
  reopening: string | null;
  reopenError: string | null;
  onSave: (closedAt: string, patch: PastPatch) => void;
  onReopen: (closedAt: string) => void;
  onOpenTarget: (designation: string) => void;
}) {
  const latest = latestMonth(data.past);
  const years = outingYears(data.past);
  const [year, setYear] = useRemembered("journal:year", latest?.year ?? new Date().getFullYear());
  const [month, setMonth] = useRemembered("journal:month", latest?.month ?? new Date().getMonth() + 1);
  if (data.past.length === 0) return null;

  const shownYear = years.includes(year) ? year : years[0];
  const months = outingsByMonth(data.past, shownYear);
  const list = months[month - 1];
  const reopenBlocked = sessionActive
    ? "Clôturez la session en cours avant de rouvrir une sortie passée"
    : pendingCount > 0
      ? "Saisies en attente d'envoi : rouvrez cette sortie une fois la synchronisation terminée"
      : null;

  const pickYear = (y: number) => {
    setYear(y);
    // Le mois le plus recent de l'annee choisie, pour ne pas tomber sur un vide.
    const ms = outingsByMonth(data.past, y);
    const last = [...ms.keys()].reverse().find((m) => ms[m].length > 0);
    if (last !== undefined) setMonth(last + 1);
  };

  return (
    <Section id="journal-past" title="Mes sorties" count={data.past.length}>
      <div className="nc-row nc-between">
        {years.length > 1 ? (
          <div className="nc-row nc-wrap" style={{ gap: "var(--space-xs)" }}>
            {years.map((y) => (
              <button
                key={y}
                onClick={() => pickYear(y)}
                className={`nc-chip nc-num ${y === shownYear ? "nc-chip-active" : ""}`}
                aria-pressed={y === shownYear}
              >
                {y}
              </button>
            ))}
          </div>
        ) : (
          <span className="nc-num" style={{ fontSize: "var(--text-md)" }}>{shownYear}</span>
        )}
        {/* Export local : un Blob et un lien ephemere, rien ne part sur
            le reseau (voir journalRead.downloadText). */}
        <button onClick={() => downloadText("carnet-nuitclaire.md", journalToMarkdown(data))} className="nc-chip nc-none">
          Exporter le carnet
        </button>
      </div>

      <div className="nc-month-grid" role="tablist" aria-label="Mois">
        {months.map((ms, m) => (
          <button
            key={m}
            role="tab"
            aria-selected={m + 1 === month}
            onClick={() => setMonth(m + 1)}
            className={["nc-month", m + 1 === month ? "nc-month-active" : "", ms.length === 0 ? "nc-month-empty" : ""].join(" ")}
          >
            <span>{MONTHS_SHORT[m]}</span>
            <span className="nc-month-count">{ms.length}</span>
          </button>
        ))}
      </div>

      {reopenError && <div className="nc-notice" style={{ color: "var(--bad)" }}>{reopenError}</div>}

      {list.length === 0 ? (
        <p className="nc-caption" style={{ margin: 0 }}>
          Aucune sortie en {MONTHS_FR[month - 1]} {shownYear}.
        </p>
      ) : (
        list.map((p) => (
          <Outing
            key={p.closedAt}
            outing={p}
            places={places}
            reopenBlocked={reopenBlocked}
            reopening={reopening === p.closedAt}
            onSave={onSave}
            onReopen={onReopen}
            onOpenTarget={onOpenTarget}
          />
        ))
      )}
    </Section>
  );
}
