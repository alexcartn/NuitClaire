import { useCallback, useState } from "react";
import { api } from "../api";
import { useFetch } from "../useFetch";

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function fmtDate(isoDate: string): string {
  const d = new Date(isoDate + "T00:00");
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

export function Journal({ onOpenTarget }: { onOpenTarget: (designation: string) => void }) {
  const fetchSessions = useCallback(() => api.sessions(), []);
  const { data, loading, reload } = useFetch(fetchSessions, []);
  const [closing, setClosing] = useState(false);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  if (loading || !data) {
    return (
      <div className="nc-screen">
        <p className="nc-caption">Chargement...</p>
      </div>
    );
  }

  const { current, past } = data;

  const toggleDone = async (designation: string, done: boolean) => {
    await api.updateSessionItem(designation, { done: !done });
    reload();
  };

  const saveNote = async (designation: string, note: string) => {
    await api.updateSessionItem(designation, { note });
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

  return (
    <div className="nc-screen">
      <div>
        <div className="nc-eyebrow">Journal de session</div>
        <div className="nc-title">{past.length} sortie(s) enregistree(s)</div>
      </div>

      {current.items.length > 0 ? (
        <div className="nc-card" style={{ borderColor: "var(--accent)", display: "flex", flexDirection: "column", gap: 13 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontSize: 15 }}>Session en cours</div>
            {current.openedAt && (
              <div className="nc-mono" style={{ fontSize: 11, color: "var(--accent)" }}>
                {fmtTime(current.openedAt)} → {current.scoreAtOpen != null ? `score ${current.scoreAtOpen}` : ""}
              </div>
            )}
          </div>

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
                  <span className="nc-caption" style={{ flex: 1 }}>ajoutee {fmtTime(item.addedAt)}</span>
                  <button
                    onClick={() => removeItem(item.designation)}
                    style={{ background: "none", border: "none", color: "var(--ink3)", cursor: "pointer", fontSize: 16, padding: "0 4px" }}
                    title="Retirer du journal"
                  >
                    ×
                  </button>
                </div>
                <input
                  value={noteDraft[item.designation] ?? item.note}
                  onChange={(e) => setNoteDraft((d) => ({ ...d, [item.designation]: e.target.value }))}
                  onBlur={(e) => saveNote(item.designation, e.target.value)}
                  placeholder="Note (facultatif)"
                  style={{
                    background: "var(--surf)", border: "1px solid var(--line)", borderRadius: 8,
                    padding: "7px 9px", fontSize: 12, color: "var(--ink)",
                  }}
                />
              </div>
            ))}
          </div>

          <button onClick={close} disabled={closing} className="nc-btn nc-btn-primary">
            {closing ? "..." : "Cloturer la session"}
          </button>
        </div>
      ) : (
        <p className="nc-caption">
          Aucune session en cours -- ajoutez une cible au journal depuis sa fiche detail.
        </p>
      )}

      {past.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 4 }}>
          <div className="nc-eyebrow">Sorties precedentes</div>
          {past.map((p) => (
            <div key={p.closedAt} className="nc-card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontSize: 14, textTransform: "capitalize" }}>{fmtDate(p.date)}</div>
                <div className="nc-mono" style={{ fontSize: 11, color: "var(--ink2)" }}>
                  {p.score != null ? `score ${p.score}` : "score n/d"}
                </div>
              </div>
              <div style={{ fontSize: 12, color: "var(--ink2)" }}>{p.targets.join(", ") || "aucune cible"}</div>
              {p.note && <div className="nc-caption">{p.note}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
