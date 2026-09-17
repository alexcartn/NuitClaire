import { useCallback, useState } from "react";
import { api } from "../api";
import { useFetch } from "../useFetch";
import type { TargetRow, TimelineEntry } from "../types";

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function fmtDate(isoDate: string): string {
  const d = new Date(isoDate + "T00:00");
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

const inputStyle = {
  background: "var(--surf)", border: "1px solid var(--line)", borderRadius: 8,
  padding: "7px 9px", fontSize: 12, color: "var(--ink)", flex: 1,
} as const;

/** Fil chronologique d'une nuit : notes par cible et notes libres deja
 * fusionnees/triees par le backend (voir sessions.timeline) -- on se
 * contente de les rendre comme un carnet, sans reconstituer le tri ici. */
function Timeline({ entries, onDelete }: { entries: TimelineEntry[]; onDelete?: (entry: TimelineEntry) => void }) {
  if (entries.length === 0) {
    return <p className="nc-caption" style={{ margin: 0 }}>Aucune note pour l'instant.</p>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {entries.map((e) => (
        <div key={e.id} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ flex: 1, fontSize: 12, color: "var(--ink2)" }}>
            <span className="nc-mono">{fmtTime(e.at)}</span>
            {" · "}
            {e.target ? <span style={{ color: "var(--ink)", fontWeight: 500 }}>{e.target}</span> : "Note libre"}
            {" — "}
            {e.text}
          </span>
          {onDelete && (
            <button
              onClick={() => onDelete(e)}
              style={{ background: "none", border: "none", color: "var(--ink3)", cursor: "pointer", fontSize: 13, padding: 0 }}
              title="Supprimer cette note"
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export function Journal({ onOpenTarget }: { onOpenTarget: (designation: string) => void }) {
  const fetchSessions = useCallback(() => api.sessions(), []);
  const { data, loading, reload } = useFetch(fetchSessions, []);
  const [closing, setClosing] = useState(false);
  const [reopening, setReopening] = useState<string | null>(null);
  const [reopenError, setReopenError] = useState<string | null>(null);
  const [pastNoteDraft, setPastNoteDraft] = useState<Record<string, string>>({});
  const [openPast, setOpenPast] = useState<string | null>(null);
  const [itemNoteDraft, setItemNoteDraft] = useState<Record<string, string>>({});
  const [freeNoteDraft, setFreeNoteDraft] = useState("");
  const [targetQuery, setTargetQuery] = useState("");
  const [targetResults, setTargetResults] = useState<TargetRow[] | null>(null);
  const [searchingTarget, setSearchingTarget] = useState(false);

  if (loading || !data) {
    return (
      <div className="nc-screen">
        <p className="nc-caption">Chargement...</p>
      </div>
    );
  }

  const { current, past } = data;
  const sessionActive = current.items.length > 0 || current.freeNotes.length > 0;

  const searchTargets = async () => {
    if (!targetQuery.trim()) return;
    setSearchingTarget(true);
    try {
      setTargetResults(await api.search(targetQuery.trim()));
    } finally {
      setSearchingTarget(false);
    }
  };

  const addTarget = async (designation: string) => {
    await api.addSessionItem(designation);
    setTargetResults(null);
    setTargetQuery("");
    reload();
  };

  const submitFreeNote = async () => {
    const text = freeNoteDraft.trim();
    if (!text) return;
    await api.addFreeNote(text);
    setFreeNoteDraft("");
    reload();
  };

  const toggleDone = async (designation: string, done: boolean) => {
    await api.updateSessionItem(designation, { done: !done });
    reload();
  };

  const submitItemNote = async (designation: string) => {
    const text = (itemNoteDraft[designation] ?? "").trim();
    if (!text) return;
    await api.addItemNote(designation, text);
    setItemNoteDraft((d) => ({ ...d, [designation]: "" }));
    reload();
  };

  const deleteTimelineEntry = async (entry: TimelineEntry) => {
    if (entry.target) await api.deleteItemNote(entry.target, entry.id);
    else await api.deleteFreeNote(entry.id);
    reload();
  };

  const removeItem = async (designation: string) => {
    await api.deleteSessionItem(designation);
    reload();
  };

  const close = async () => {
    setClosing(true);
    try {
      await api.closeSession();
      reload();
    } finally {
      setClosing(false);
    }
  };

  const savePastNote = async (closedAt: string, note: string) => {
    await api.updatePastSessionNote(closedAt, note);
    reload();
  };

  const reopen = async (closedAt: string) => {
    setReopening(closedAt);
    setReopenError(null);
    try {
      await api.reopenSession(closedAt);
      reload();
    } catch (e) {
      setReopenError(e instanceof Error ? e.message : "Impossible de rouvrir cette sortie.");
    } finally {
      setReopening(null);
    }
  };

  return (
    <div className="nc-screen">
      <div>
        <div className="nc-eyebrow">Journal de session</div>
        <div className="nc-title">{past.length} sortie(s) enregistree(s)</div>
      </div>

      <div className="nc-card" style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        <div className="nc-eyebrow">Ajouter a la session</div>
        <form onSubmit={(e) => { e.preventDefault(); searchTargets(); }} style={{ display: "flex", gap: 8 }}>
          <input
            value={targetQuery}
            onChange={(e) => setTargetQuery(e.target.value)}
            placeholder="Ajouter une cible : M31, NGC7380..."
            className="nc-mono"
            style={inputStyle}
          />
          <button type="submit" className="nc-btn" style={{ flex: "none" }} disabled={searchingTarget}>
            {searchingTarget ? "..." : "Chercher"}
          </button>
        </form>
        {targetResults && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {targetResults.length === 0 && (
              <p className="nc-caption" style={{ margin: 0 }}>Aucun objet trouve pour « {targetQuery} ».</p>
            )}
            {targetResults.map((r) => (
              <div key={r.designation} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="nc-mono" style={{ fontSize: 12, width: 70, flex: "none" }}>{r.designation}</span>
                <span className="nc-caption" style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.commonName || r.type}
                </span>
                <button onClick={() => addTarget(r.designation)} className="nc-btn" style={{ flex: "none", padding: "5px 10px", fontSize: 12 }}>
                  Ajouter
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ height: 1, background: "var(--line)" }} />

        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={freeNoteDraft}
            onChange={(e) => setFreeNoteDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitFreeNote()}
            placeholder="Note libre, sans cible (ex : conditions, materiel...)"
            style={inputStyle}
          />
          <button onClick={submitFreeNote} disabled={!freeNoteDraft.trim()} className="nc-btn" style={{ flex: "none" }}>
            Ajouter
          </button>
        </div>
      </div>

      {sessionActive ? (
        <div className="nc-card" style={{ borderColor: "var(--accent)", display: "flex", flexDirection: "column", gap: 13 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontSize: 15 }}>Session en cours</div>
            {current.openedAt && (
              <div className="nc-mono" style={{ fontSize: 11, color: "var(--accent)" }}>
                {fmtTime(current.openedAt)} → {current.scoreAtOpen != null ? `score ${current.scoreAtOpen}` : ""}
              </div>
            )}
          </div>

          {current.items.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {current.items.map((item) => (
                <div
                  key={item.designation}
                  style={{
                    background: "var(--surf2)", border: "1px solid var(--line)", borderRadius: 11,
                    padding: "12px 13px", display: "flex", flexDirection: "column", gap: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                    <button
                      onClick={() => toggleDone(item.designation, item.done)}
                      className="nc-mono"
                      style={{
                        width: 22, height: 22, flex: "none", borderRadius: 6, cursor: "pointer",
                        border: `1px solid ${item.done ? "var(--accent)" : "var(--ink3)"}`,
                        background: item.done ? "var(--accent)" : "transparent",
                        color: item.done ? "var(--onaccent)" : "transparent",
                        fontSize: 12, lineHeight: "20px", padding: 0,
                      }}
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => onOpenTarget(item.designation)}
                      className="nc-mono"
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink)", fontSize: 13, fontWeight: 500, padding: 0 }}
                    >
                      {item.designation}
                    </button>
                    <span className="nc-caption" style={{ flex: 1 }}>
                      ajoutee {fmtTime(item.addedAt)}
                      {item.notes.length > 0 && ` · ${item.notes.length} note(s)`}
                    </span>
                    <button
                      onClick={() => removeItem(item.designation)}
                      style={{ background: "none", border: "none", color: "var(--ink3)", cursor: "pointer", fontSize: 16, padding: "0 4px" }}
                      title="Retirer du journal"
                    >
                      ×
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      value={itemNoteDraft[item.designation] ?? ""}
                      onChange={(e) => setItemNoteDraft((d) => ({ ...d, [item.designation]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && submitItemNote(item.designation)}
                      placeholder="Ajouter une note..."
                      style={inputStyle}
                    />
                    <button
                      onClick={() => submitItemNote(item.designation)}
                      disabled={!(itemNoteDraft[item.designation] ?? "").trim()}
                      className="nc-btn"
                      style={{ flex: "none", padding: "5px 10px", fontSize: 12 }}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div className="nc-eyebrow">Journal de la nuit</div>
            <Timeline entries={current.timeline} onDelete={deleteTimelineEntry} />
          </div>

          <button onClick={close} disabled={closing} className="nc-btn nc-btn-primary">
            {closing ? "..." : "Cloturer la session"}
          </button>
        </div>
      ) : (
        <p className="nc-caption">
          Aucune session en cours -- ajoutez une cible ou une note libre ci-dessus.
        </p>
      )}

      {past.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 4 }}>
          <div className="nc-eyebrow">Sorties precedentes</div>
          {reopenError && <p className="nc-caption" style={{ color: "var(--danger, #e2434f)" }}>{reopenError}</p>}
          {past.map((p) => (
            <div key={p.closedAt} className="nc-card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontSize: 14, textTransform: "capitalize" }}>{fmtDate(p.date)}</div>
                <div className="nc-mono" style={{ fontSize: 11, color: "var(--ink2)" }}>
                  {p.score != null ? `score ${p.score}` : "score n/d"}
                </div>
              </div>
              <div style={{ fontSize: 12, color: "var(--ink2)" }}>{p.targets.join(", ") || "aucune cible"}</div>
              <input
                value={pastNoteDraft[p.closedAt] ?? p.note}
                onChange={(e) => setPastNoteDraft((d) => ({ ...d, [p.closedAt]: e.target.value }))}
                onBlur={(e) => savePastNote(p.closedAt, e.target.value)}
                placeholder="Note de la sortie (facultatif)"
                style={{
                  background: "var(--surf2)", border: "1px solid var(--line)", borderRadius: 8,
                  padding: "7px 9px", fontSize: 12, color: "var(--ink)",
                }}
              />
              {p.timeline.length > 0 && (
                <>
                  <button
                    onClick={() => setOpenPast((cur) => (cur === p.closedAt ? null : p.closedAt))}
                    className="nc-caption"
                    style={{ alignSelf: "flex-start", background: "none", border: "none", cursor: "pointer", color: "var(--ink2)", padding: 0 }}
                  >
                    {openPast === p.closedAt ? "Masquer le journal de cette nuit" : `Voir le journal de cette nuit (${p.timeline.length})`}
                  </button>
                  {openPast === p.closedAt && <Timeline entries={p.timeline} />}
                </>
              )}
              <button
                onClick={() => reopen(p.closedAt)}
                disabled={sessionActive || reopening === p.closedAt}
                className="nc-caption"
                title={sessionActive ? "Cloturez la session en cours avant de rouvrir une sortie passee" : "Rouvrir cette sortie"}
                style={{
                  alignSelf: "flex-start", background: "none", border: "none", cursor: "pointer",
                  color: sessionActive ? "var(--ink3)" : "var(--accent)", padding: 0,
                }}
              >
                {reopening === p.closedAt ? "..." : "Rouvrir cette sortie"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
