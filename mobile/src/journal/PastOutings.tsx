import { useState } from "react";
import { downloadText, journalToMarkdown, outingToMarkdown } from "../journalRead";
import type { Feeling, PastSession, Sessions, Site } from "../types";
import { PastConditions } from "./Conditions";
import { fmtDate } from "./format";
import { OutingPlace } from "./OutingPlace";
import { PastFeeling } from "./PastFeeling";
import { Timeline } from "./Timeline";

type PastPatch = { note?: string; site?: Site } & Partial<Feeling>;

/** Les sorties cloturees : relecture, retouches, export, reouverture. */
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
  const [openPast, setOpenPast] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  if (data.past.length === 0) return null;

  const reopenBlocked = sessionActive || pendingCount > 0;

  return (
    <div className="nc-stack-xs" style={{ marginTop: "var(--space-2xs)" }}>
      <div className="nc-row nc-between">
        <div className="nc-eyebrow">Sorties précédentes</div>
        {/* Export local : un Blob et un lien ephemere, rien ne part sur
            le reseau (voir journalRead.downloadText). */}
        <button onClick={() => downloadText("carnet-nuitclaire.md", journalToMarkdown(data))} className="nc-chip">
          Exporter le carnet
        </button>
      </div>
      {reopenError && <div className="nc-notice" style={{ color: "var(--bad)" }}>{reopenError}</div>}
      {data.past.map((p: PastSession) => (
        <div key={p.closedAt} className="nc-card nc-stack-xs">
          <div className="nc-row nc-between nc-baseline">
            <div style={{ fontSize: "var(--text-sm)", textTransform: "capitalize" }}>{fmtDate(p.date)}</div>
            <div className="nc-num" style={{ fontSize: "var(--text-xs)", color: "var(--ink2)" }}>
              {p.score != null ? `score ${p.score}` : "score n/d"}
            </div>
          </div>
          {/* Cibles cliquables : en relisant une nuit, on veut pouvoir
              ouvrir la fiche d'une cible pour voir tout ce que le journal
              en dit. */}
          <div className="nc-row nc-wrap" style={{ columnGap: "var(--space-sm)", rowGap: 0 }}>
            {p.targets.length === 0 && <span className="nc-caption">aucune cible</span>}
            {p.targets.map((designation) => (
              <button
                key={designation}
                onClick={() => onOpenTarget(designation)}
                className="nc-link nc-num"
                style={{ fontSize: "var(--text-sm)", textDecoration: "underline", textDecorationColor: "var(--line)" }}
              >
                {designation}
              </button>
            ))}
          </div>
          <OutingPlace site={p.site} choices={places} onChange={(site) => onSave(p.closedAt, { site })} />
          <PastConditions conditions={p.conditions} />
          <PastFeeling feeling={p.feeling} onChange={(patch) => onSave(p.closedAt, patch)} />
          <input
            value={noteDraft[p.closedAt] ?? p.note}
            onChange={(e) => setNoteDraft((d) => ({ ...d, [p.closedAt]: e.target.value }))}
            onBlur={(e) => e.target.value !== p.note && onSave(p.closedAt, { note: e.target.value })}
            placeholder="Note de la sortie (facultatif)"
            aria-label="Note de la sortie"
            className="nc-input"
          />
          <div className="nc-row nc-wrap" style={{ columnGap: "var(--space-md)", rowGap: 0 }}>
            {p.timeline.length > 0 && (
              <button
                onClick={() => setOpenPast((cur) => (cur === p.closedAt ? null : p.closedAt))}
                className="nc-link"
                aria-expanded={openPast === p.closedAt}
              >
                {openPast === p.closedAt ? "Masquer le journal" : `Journal de la nuit (${p.timeline.length})`}
              </button>
            )}
            <button onClick={() => downloadText(`nuit-${p.date}.md`, outingToMarkdown(p))} className="nc-link">
              Exporter cette nuit
            </button>
            <button
              onClick={() => onReopen(p.closedAt)}
              disabled={reopenBlocked || reopening === p.closedAt}
              className="nc-link nc-link-accent"
              title={
                sessionActive
                  ? "Clôturez la session en cours avant de rouvrir une sortie passée"
                  : pendingCount > 0
                    ? "Saisies en attente d'envoi : rouvrez cette sortie une fois la synchronisation terminée"
                    : "Rouvrir cette sortie"
              }
            >
              {reopening === p.closedAt ? "…" : "Rouvrir pour tout modifier"}
            </button>
          </div>
          {openPast === p.closedAt && <Timeline entries={p.timeline} />}
        </div>
      ))}
    </div>
  );
}
