import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { useFetch } from "../useFetch";
import { applyServer, mutate, refresh, useSessions } from "../useSessions";
import { localNoteId, newOp, parseTargetPrefix } from "../sessionQueue";
import type { SessionOpBody } from "../sessionQueue";
import { useTheme } from "../useTheme";
import { useWakeLock } from "../useWakeLock";
import { StatCard } from "../components/StatCard";
import { TabIcon } from "../components/TabIcon";
import type { TargetRow, TimelineEntry } from "../types";

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function fmtDate(isoDate: string): string {
  const d = new Date(isoDate + "T00:00");
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

/** '125' minutes -> "2 h 05" ; en-dessous de l'heure, "45 min". */
function fmtExposure(totalMin: number): string {
  if (totalMin <= 0) return "0 min";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
}

/** Evenements frequents d'une nuit, poses en un appui plutot que tapes.
 * C'est la meme note libre horodatee qu'une saisie au clavier -- juste le
 * texte le plus courant, pre-ecrit : dehors, a 23h, on ne tape pas une
 * phrase, on appuie. Rien n'est mesure ni deduit par l'appli (voir
 * l'en-tete de sessions.py), c'est bien l'utilisateur qui constate. */
const QUICK_NOTES = [
  "Buée",
  "Nuage",
  "Mise au point",
  "Avion",
  "Satellite",
  "Vent",
] as const;

/** Bandeau d'etat de la synchronisation. Le journal se remplit dehors, avec
 * un reseau qui va et vient : ce qui compte est de savoir que rien n'est
 * perdu, pas d'etre bloque. Silencieux quand tout est envoye. */
function SyncBanner({ pendingCount, syncError, loadError }: {
  pendingCount: number; syncError: string | null; loadError: string | null;
}) {
  if (pendingCount === 0 && !syncError && !loadError) return null;
  const message = pendingCount > 0
    ? `${pendingCount} saisie(s) en attente d'envoi : conservees sur l'appareil, envoyees des le retour du reseau.`
    : loadError
      ? `Journal affiche depuis la copie locale (${loadError}).`
      : syncError;
  return (
    <div
      className="nc-caption"
      style={{
        margin: 0, background: "var(--surf2)", border: "1px solid var(--line)",
        borderRadius: 9, padding: "8px 10px", color: "var(--ink2)",
      }}
    >
      {message}
    </div>
  );
}

/** Fil chronologique d'une nuit : notes par cible et notes libres deja
 * fusionnees/triees (par le backend, ou localement tant qu'une saisie n'est
 * pas partie -- voir sessionQueue.applyOp) ; on se contente de les rendre
 * comme un carnet, sans reconstituer le tri ici. */
function Timeline({ entries, pendingNotes, onDelete }: {
  entries: TimelineEntry[];
  pendingNotes?: Set<string>;
  onDelete?: (entry: TimelineEntry) => void;
}) {
  if (entries.length === 0) {
    return <p className="nc-caption" style={{ margin: 0 }}>Aucune note pour l'instant.</p>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {entries.map((e) => (
        <div key={e.id} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span className="nc-log-entry">
            <span className="nc-mono">{fmtTime(e.at)}</span>
            {" · "}
            {e.target ? <span style={{ color: "var(--ink)", fontWeight: 500 }}>{e.target}</span> : "Note libre"}
            {" — "}
            {e.text}
            {pendingNotes?.has(e.id) && (
              <span className="nc-mono" style={{ color: "var(--ink3)", fontSize: 11 }}> · en attente</span>
            )}
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
  const { data, loading, loadError, pendingCount, pendingNotes, syncError, syncCount } = useSessions();
  const fetchStats = useCallback(() => api.stats(), []);
  const { data: stats, reload: reloadStats } = useFetch(fetchStats, []);
  const [reopening, setReopening] = useState<string | null>(null);
  const [reopenError, setReopenError] = useState<string | null>(null);
  const [pastNoteDraft, setPastNoteDraft] = useState<Record<string, string>>({});
  const [openPast, setOpenPast] = useState<string | null>(null);
  const [itemNoteDraft, setItemNoteDraft] = useState<Record<string, string>>({});
  const [exposureDraft, setExposureDraft] = useState<Record<string, string>>({});
  const [freeNoteDraft, setFreeNoteDraft] = useState("");
  const [targetQuery, setTargetQuery] = useState("");
  const [targetResults, setTargetResults] = useState<TargetRow[] | null>(null);
  const [searchingTarget, setSearchingTarget] = useState(false);
  const { isNight, toggleNight } = useTheme();

  // Les statistiques derivent du journal cote serveur : les recharger quand
  // une saisie vient d'y etre enregistree, pas a chaque frappe locale.
  useEffect(() => {
    if (syncCount > 0) reloadStats();
  }, [syncCount, reloadStats]);

  // Ecran maintenu allume pendant une sortie seulement (voir useWakeLock).
  // Appele avant tout retour anticipe : un hook ne se saute pas.
  const hasSession = Boolean(
    data && (data.current.items.length > 0 || data.current.freeNotes.length > 0),
  );
  useWakeLock(hasSession);

  if (loading || !data) {
    return (
      <div className="nc-screen">
        <p className="nc-caption">{loadError ?? "Chargement..."}</p>
      </div>
    );
  }

  const { current, past } = data;
  const sessionActive = hasSession;

  const send = (body: SessionOpBody) => mutate(newOp(body));

  const searchTargets = async () => {
    if (!targetQuery.trim()) return;
    setSearchingTarget(true);
    try {
      setTargetResults(await api.search(targetQuery.trim()));
    } finally {
      setSearchingTarget(false);
    }
  };

  const addTarget = (designation: string) => {
    send({ kind: "addItem", designation });
    setTargetResults(null);
    setTargetQuery("");
  };

  /** Ce que deviendra la note libre en cours de frappe : rattachee a une
   * cible si elle commence par une designation, libre sinon. Calcule a
   * chaque frappe pour l'afficher avant l'envoi -- une detection qui se
   * declenche en silence serait une mauvaise surprise sur une note qui
   * commence par hasard par "M31". */
  const prefix = parseTargetPrefix(freeNoteDraft);
  const prefixIsNew =
    prefix !== null && !current.items.some((i) => i.designation === prefix.designation);

  const addQuickNote = (text: string) => send({ kind: "addFreeNote", noteId: localNoteId(), text });

  const submitFreeNote = () => {
    const text = freeNoteDraft.trim();
    if (!text) return;
    if (prefix) {
      // La cible d'abord : le serveur refuse une note sur une cible absente
      // de la session. Les deux operations partent dans cet ordre (voir
      // sessionQueue.ts), y compris hors ligne.
      if (prefixIsNew) send({ kind: "addItem", designation: prefix.designation });
      send({ kind: "addItemNote", designation: prefix.designation, noteId: localNoteId(), text: prefix.text });
    } else {
      send({ kind: "addFreeNote", noteId: localNoteId(), text });
    }
    setFreeNoteDraft("");
  };

  const toggleDone = (designation: string, done: boolean) =>
    send({ kind: "setDone", designation, done: !done });

  const saveExposure = (designation: string, raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === "") return;
    const minutes = Math.round(Number(trimmed));
    if (!Number.isFinite(minutes) || minutes < 0) return;
    send({ kind: "setExposure", designation, minutes });
  };

  const submitItemNote = (designation: string) => {
    const text = (itemNoteDraft[designation] ?? "").trim();
    if (!text) return;
    send({ kind: "addItemNote", designation, noteId: localNoteId(), text });
    setItemNoteDraft((d) => ({ ...d, [designation]: "" }));
  };

  const deleteTimelineEntry = (entry: TimelineEntry) => {
    if (entry.target) send({ kind: "removeItemNote", designation: entry.target, noteId: entry.id });
    else send({ kind: "removeFreeNote", noteId: entry.id });
  };

  const removeItem = (designation: string) => send({ kind: "removeItem", designation });

  const close = () => send({ kind: "closeSession" });

  const savePastNote = async (closedAt: string, note: string) => {
    // Retouche d'une sortie deja cloturee : pas une saisie de terrain, elle
    // peut rester un aller-retour direct (et le serveur valide `closedAt`).
    try {
      applyServer(await api.updatePastSessionNote(closedAt, note));
    } catch {
      refresh();
    }
  };

  const reopen = async (closedAt: string) => {
    setReopening(closedAt);
    setReopenError(null);
    try {
      applyServer(await api.reopenSession(closedAt));
    } catch (e) {
      setReopenError(e instanceof Error ? e.message : "Impossible de rouvrir cette sortie.");
    } finally {
      setReopening(null);
    }
  };

  return (
    <div className="nc-screen">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <div className="nc-eyebrow">Journal de session</div>
          <div className="nc-title">{past.length} sortie(s) enregistree(s)</div>
        </div>
        {/* Bascule vision nocturne a portee de pouce : c'est sur cet ecran
            qu'on en a besoin, au moment ou on sort. Le nom accessible
            reprend le texte visible ("Nuit") avant de le completer -- une
            aide vocale doit pouvoir designer le bouton par ce qui est
            ecrit dessus. */}
        <button
          onClick={toggleNight}
          className={`nc-chip ${isNight ? "nc-chip-active" : ""}`}
          style={{ flex: "none", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}
          aria-pressed={isNight}
          aria-label="Nuit : vision nocturne"
          title={isNight ? "Revenir au theme precedent" : "Vision nocturne : rouge sur noir, tailles augmentees"}
        >
          <TabIcon name="moon" />
          Nuit
        </button>
      </div>

      <SyncBanner pendingCount={pendingCount} syncError={syncError} loadError={loadError} />

      {stats && stats.totalOutings > 0 && (
        <div className="nc-card" style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          <div className="nc-eyebrow">Statistiques</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
            <StatCard label="Sorties" value={stats.totalOutings} sub={`${stats.successfulOutings} reussie(s)`} />
            <StatCard
              label="Score moyen"
              value={stats.avgScoreSuccessful != null ? stats.avgScoreSuccessful : "n/d"}
              sub="sorties reussies"
            />
            <StatCard label="Expo totale" value={fmtExposure(stats.totalExposureMin)} />
            <StatCard
              label="Ce mois"
              value={stats.capturesByMonth.find((m) => m.month === new Date().toISOString().slice(0, 7))?.count ?? 0}
              sub="cible(s) capturee(s)"
            />
          </div>
          {stats.exposureByTarget.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div className="nc-caption" style={{ margin: 0 }}>Expo cumulee par cible</div>
              {stats.exposureByTarget.slice(0, 6).map((e) => (
                <div key={e.designation} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span className="nc-mono">{e.designation}</span>
                  <span className="nc-mono" style={{ color: "var(--ink2)" }}>{fmtExposure(e.totalMin)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="nc-card" style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        <div className="nc-eyebrow">Ajouter a la session</div>
        <form onSubmit={(e) => { e.preventDefault(); searchTargets(); }} style={{ display: "flex", gap: 8 }}>
          <input
            value={targetQuery}
            onChange={(e) => setTargetQuery(e.target.value)}
            placeholder="Ajouter une cible : M31, NGC7380..."
            className="nc-input nc-mono"
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
                <button onClick={() => addTarget(r.designation)} className="nc-btn nc-btn-sm" style={{ flex: "none" }}>
                  Ajouter
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ height: 1, background: "var(--line)" }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={freeNoteDraft}
              onChange={(e) => setFreeNoteDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitFreeNote()}
              placeholder="Note : « M31 tres contraste », ou conditions, materiel..."
              className="nc-input"
            />
            <button onClick={submitFreeNote} disabled={!freeNoteDraft.trim()} className="nc-btn" style={{ flex: "none" }}>
              Ajouter
            </button>
          </div>
          {prefix && (
            <p className="nc-caption" style={{ margin: 0 }}>
              Sera rattachee a <span className="nc-mono" style={{ color: "var(--accent)" }}>{prefix.designation}</span>
              {prefixIsNew ? ", ajoutee a la session." : "."}
            </p>
          )}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {QUICK_NOTES.map((label) => (
            <button key={label} onClick={() => addQuickNote(label)} className="nc-chip">
              {label}
            </button>
          ))}
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
                      className="nc-input"
                    />
                    <button
                      onClick={() => submitItemNote(item.designation)}
                      disabled={!(itemNoteDraft[item.designation] ?? "").trim()}
                      className="nc-btn nc-btn-sm"
                      style={{ flex: "none" }}
                    >
                      +
                    </button>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="nc-caption" style={{ margin: 0, flex: "none" }}>Expo (min)</span>
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={exposureDraft[item.designation] ?? item.exposureMin ?? ""}
                      onChange={(e) => setExposureDraft((d) => ({ ...d, [item.designation]: e.target.value }))}
                      onBlur={(e) => saveExposure(item.designation, e.target.value)}
                      placeholder="0"
                      className="nc-input"
                      style={{ flex: "none", width: 72 }}
                    />
                    {item.exposureMin != null && (
                      <span className="nc-mono" style={{ fontSize: 11, color: "var(--ink3)" }}>
                        {fmtExposure(item.exposureMin)} cette sortie
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div className="nc-eyebrow">Journal de la nuit</div>
            <Timeline entries={current.timeline} pendingNotes={pendingNotes} onDelete={deleteTimelineEntry} />
          </div>

          <button onClick={close} className="nc-btn nc-btn-primary">
            Cloturer la session
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
                disabled={sessionActive || pendingCount > 0 || reopening === p.closedAt}
                className="nc-caption"
                title={
                  sessionActive
                    ? "Cloturez la session en cours avant de rouvrir une sortie passee"
                    : pendingCount > 0
                      ? "Saisies en attente d'envoi : rouvrez cette sortie une fois la synchronisation terminee"
                      : "Rouvrir cette sortie"
                }
                style={{
                  alignSelf: "flex-start", background: "none", border: "none", cursor: "pointer",
                  color: sessionActive || pendingCount > 0 ? "var(--ink3)" : "var(--accent)", padding: 0,
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
