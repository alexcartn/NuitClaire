import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { useFetch } from "../useFetch";
import { applyServer, mutate, refresh, useSessions } from "../useSessions";
import { closeOp, localNoteId, newOp, parseTargetPrefix } from "../sessionQueue";
import type { SessionOpBody } from "../sessionQueue";
import { useTheme } from "../useTheme";
import { downloadText, journalToMarkdown, knownSites, outingToMarkdown, siteLine } from "../journalRead";
import { useWakeLock } from "../useWakeLock";
import { StatCard } from "../components/StatCard";
import { TabIcon } from "../components/TabIcon";
import type { Feeling, NightConditions, NoteContext, Site, TargetRow, TimelineEntry } from "../types";

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

/** "8,2 °C · 5 % · seeing 3" : ce que la prevision annoncait a l'heure de la
 * note (voir nightContext.ts). N'affiche que ce qui est connu, et rien du
 * tout quand rien ne l'est -- une ligne de tirets ne vaut pas mieux qu'une
 * absence de ligne. */
function ContextLine({ context }: { context: NoteContext | null }) {
  if (!context) return null;
  const parts = [
    context.temperatureC != null ? `${context.temperatureC.toFixed(1).replace(".", ",")} °C` : null,
    context.cloudCoverPct != null ? `${Math.round(context.cloudCoverPct)} % nuages` : null,
    context.seeing != null ? `seeing ${Math.round(context.seeing)}` : null,
    context.transparency != null ? `transp. ${Math.round(context.transparency)}` : null,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return (
    <div className="nc-context nc-mono">
      {parts.join(" · ")}
    </div>
  );
}

/** Note de 1 a 5, ou rien. Cinq boutons chiffres plutot que des etoiles :
 * les glyphes d'etoile basculent en emoji couleur sur certains telephones,
 * ce qui ruinerait le mode vision nocturne. Reappuyer sur la valeur courante
 * l'efface. */
function Rating({ label, scope, value, onChange }: {
  label: string;
  /** Ce que la note qualifie, ajoute au nom accessible. L'ecran porte
   * plusieurs "Satisfaction" -- une par cible, plus celle de la nuit -- que
   * le contexte visuel distingue, mais qui seraient indiscernables a la
   * voix. */
  scope: string;
  value: number | null;
  onChange: (next: number | null) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span className="nc-caption" style={{ margin: 0, flex: "none" }}>{label}</span>
      <div style={{ display: "flex", gap: 5 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => onChange(value === n ? null : n)}
            className={`nc-chip ${value === n ? "nc-chip-active" : ""}`}
            style={{ minWidth: 32 }}
            aria-pressed={value === n}
            aria-label={`${label} ${scope} : ${n} sur 5`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Conditions figees a la cloture : la vue d'ensemble de la nuit, quand le
 * contexte des notes en donne le detail heure par heure. Absente des sorties
 * anterieures a son introduction, et silencieuse dans ce cas. */
function PastConditions({ conditions }: { conditions: NightConditions | null }) {
  if (!conditions) return null;
  // Une decimale partout, sinon « 11 a 11,2 °C » melange deux precisions
  // dans la meme phrase.
  const n = (v: number, unit = "") => `${v.toFixed(1).replace(".", ",")}${unit}`;
  const parts = [
    conditions.tempMinC != null && conditions.tempMaxC != null
      ? `${n(conditions.tempMinC)} a ${n(conditions.tempMaxC, " °C")}`
      : null,
    conditions.cloudAvgPct != null ? `${Math.round(conditions.cloudAvgPct)} % nuages` : null,
    conditions.seeingAvg != null ? `seeing ${n(conditions.seeingAvg)}` : null,
    conditions.moonIllum != null ? `lune ${Math.round(conditions.moonIllum)} %` : null,
    conditions.dewSpreadC != null ? `ecart rosee ${n(conditions.dewSpreadC, "°")}` : null,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return <div className="nc-context nc-mono">{parts.join(" · ")}</div>;
}

/** Lieu d'une sortie, corrigeable -- typiquement quand on est parti
 * observer ailleurs sans penser a changer sa position dans les reglages.
 * Sert pour la sortie en cours comme pour une sortie cloturee.
 *
 * On choisit parmi les lieux que le carnet connait deja plutot que de
 * ressaisir des coordonnees : on observe depuis une poignee d'endroits,
 * presque toujours les memes. Un endroit inedit se pose d'abord dans
 * Reglages, puis se retrouve ici. */
function OutingPlace({ site, choices, onChange }: {
  site: Site | null;
  choices: Site[];
  onChange: (next: Site) => void;
}) {
  const [open, setOpen] = useState(false);
  const others = choices.filter((c) => c.name !== site?.name);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {site && <div className="nc-context nc-mono">{siteLine(site)}</div>}
      {(others.length > 0 || !site) && (
        <button
          onClick={() => setOpen((v) => !v)}
          className="nc-caption"
          style={{ alignSelf: "flex-start", background: "none", border: "none", cursor: "pointer", color: "var(--ink2)", padding: 0 }}
        >
          {open ? "Masquer les lieux" : site ? "Corriger le lieu" : "Indiquer le lieu"}
        </button>
      )}
      {open && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {others.map((choice) => (
            <button
              key={choice.name}
              onClick={() => {
                onChange(choice);
                setOpen(false);
              }}
              className="nc-chip"
            >
              {choice.name}
            </button>
          ))}
          {others.length === 0 && (
            <p className="nc-caption" style={{ margin: 0 }}>
              Aucun autre lieu dans le carnet. Posez-le dans Reglages, il apparaitra ici.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Ressenti d'une sortie cloturee, modifiable. On rentre rarement remplir
 * « ce que je retiens » avant d'avoir range le materiel : sans cela, la case
 * resterait vide pour toujours. Les deux champs libres n'apparaissent en
 * saisie qu'une fois la carte depliee, pour ne pas alourdir la liste. */
function PastFeeling({ feeling, onChange }: {
  feeling: Feeling;
  onChange: (patch: Partial<Feeling>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Record<keyof Feeling, string>>>({});
  const scores = [
    feeling.rating != null ? `satisfaction ${feeling.rating}/5` : null,
    feeling.skyQuality != null ? `ciel percu ${feeling.skyQuality}/5` : null,
  ].filter(Boolean);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {scores.length > 0 && (
        <div className="nc-mono" style={{ fontSize: 11, color: "var(--ink2)" }}>{scores.join(" · ")}</div>
      )}
      {feeling.highlight && (
        <div className="nc-caption" style={{ margin: 0 }}>Je retiens : {feeling.highlight}</div>
      )}
      {feeling.nextTime && (
        <div className="nc-caption" style={{ margin: 0 }}>A refaire autrement : {feeling.nextTime}</div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="nc-caption"
        style={{ alignSelf: "flex-start", background: "none", border: "none", cursor: "pointer", color: "var(--ink2)", padding: 0 }}
      >
        {open ? "Masquer le ressenti" : scores.length || feeling.highlight || feeling.nextTime
          ? "Modifier le ressenti"
          : "Ajouter un ressenti"}
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 2 }}>
          <Rating
            label="Satisfaction"
            scope="de cette sortie"
            value={feeling.rating}
            onChange={(rating) => onChange({ rating })}
          />
          <Rating
            label="Ciel percu"
            scope="cette nuit-la"
            value={feeling.skyQuality}
            onChange={(skyQuality) => onChange({ skyQuality })}
          />
          <input
            value={draft.highlight ?? feeling.highlight}
            onChange={(e) => setDraft((d) => ({ ...d, highlight: e.target.value }))}
            onBlur={(e) => e.target.value !== feeling.highlight && onChange({ highlight: e.target.value })}
            placeholder="Ce que je retiens"
            className="nc-input"
          />
          <input
            value={draft.nextTime ?? feeling.nextTime}
            onChange={(e) => setDraft((d) => ({ ...d, nextTime: e.target.value }))}
            onBlur={(e) => e.target.value !== feeling.nextTime && onChange({ nextTime: e.target.value })}
            placeholder="A refaire autrement"
            className="nc-input"
          />
        </div>
      )}
    </div>
  );
}

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
            <ContextLine context={e.context} />
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
  // Le lieu configure : c'est justement celui qu'on vient de poser dans
  // Reglages en rentrant, et qui n'est encore dans aucune sortie.
  const fetchState = useCallback(() => api.state(), []);
  const { data: appState } = useFetch(fetchState, [], "state");
  const { data: stats, reload: reloadStats } = useFetch(fetchStats, []);
  const [reopening, setReopening] = useState<string | null>(null);
  const [reopenError, setReopenError] = useState<string | null>(null);
  const [pastNoteDraft, setPastNoteDraft] = useState<Record<string, string>>({});
  const [openPast, setOpenPast] = useState<string | null>(null);
  const [itemNoteDraft, setItemNoteDraft] = useState<Record<string, string>>({});
  const [exposureDraft, setExposureDraft] = useState<Record<string, string>>({});
  const [freeNoteDraft, setFreeNoteDraft] = useState("");
  const [feelingDraft, setFeelingDraft] = useState<Partial<Record<keyof Feeling, string>>>({});
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
  // Lieu courant en tete, puis ceux que le carnet connait deja, sans
  // doublon de nom.
  const places = [
    ...(appState ? [appState.site] : []),
    ...knownSites(data).filter((site) => site.name !== appState?.site.name),
  ];

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

  const rateItem = (designation: string, rating: number | null) =>
    send({ kind: "setItemRating", designation, rating });

  const setFeeling = (patch: Partial<Feeling>) => send({ kind: "setFeeling", patch });

  /** Champ libre du ressenti : enregistre a la sortie du champ, pas a chaque
   * frappe -- inutile d'empiler une operation par lettre dans la file. */
  const saveFeelingText = (field: "highlight" | "nextTime", value: string) => {
    if (value === current.feeling[field]) return;
    setFeeling({ [field]: value });
  };

  // Fige au passage le resume des conditions sur la duree de la sortie (voir
  // nightContext.conditionsBetween) : le detail par note existe deja, la vue
  // d'ensemble serait sinon perdue.
  const close = () => mutate(closeOp(current.openedAt));

  const savePastSession = async (
    closedAt: string,
    patch: { note?: string; site?: Site } & Partial<Feeling>,
  ) => {
    // Retouche d'une sortie deja cloturee : pas une saisie de terrain, elle
    // peut rester un aller-retour direct (et le serveur valide `closedAt`).
    try {
      applyServer(await api.updatePastSession(closedAt, patch));
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
              label="Satisfaction"
              value={stats.avgRating != null ? `${stats.avgRating}/5` : "n/d"}
              sub={`${stats.ratedOutings} sortie(s) notee(s)`}
            />
            <StatCard
              label="Ce mois"
              value={stats.capturesByMonth.find((m) => m.month === new Date().toISOString().slice(0, 7))?.count ?? 0}
              sub="cible(s) capturee(s)"
            />
          </div>
          {stats.outingsBySite.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div className="nc-caption" style={{ margin: 0 }}>Lieux d'observation</div>
              {stats.outingsBySite.slice(0, 5).map((s) => (
                <div key={s.name} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.name}
                  </span>
                  <span className="nc-mono" style={{ color: "var(--ink2)", flex: "none" }}>
                    {s.count} sortie(s)
                  </span>
                </div>
              ))}
            </div>
          )}

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

          {/* D'ou cette sortie est faite, fige a son ouverture : changer de
              position dans les reglages ne doit pas reecrire le passe. On
              s'apercoit souvent une fois installe qu'on est parti sans y
              penser, d'ou la correction ici aussi. */}
          <div style={{ marginTop: -8 }}>
            <OutingPlace
              site={current.siteAtOpen}
              choices={places}
              onChange={(site) => send({ kind: "setSite", site })}
            />
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

                  <Rating
                    label="Satisfaction"
                    scope={item.designation}
                    value={item.rating}
                    onChange={(rating) => rateItem(item.designation, rating)}
                  />
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div className="nc-eyebrow">Journal de la nuit</div>
            <Timeline entries={current.timeline} pendingNotes={pendingNotes} onDelete={deleteTimelineEntry} />
          </div>

          <div style={{ height: 1, background: "var(--line)" }} />

          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            <div className="nc-eyebrow">Ressenti de la nuit</div>
            <Rating
              label="Satisfaction"
              scope="de la nuit"
              value={current.feeling.rating}
              onChange={(rating) => setFeeling({ rating })}
            />
            {/* Volontairement distincte du score calcule : c'est l'ecart
                entre les deux qui interesse, pas leur accord. */}
            <Rating
              label="Ciel percu"
              scope="cette nuit"
              value={current.feeling.skyQuality}
              onChange={(skyQuality) => setFeeling({ skyQuality })}
            />
            {/* Intitule visible en plus du placeholder : celui-ci disparait
                des que le champ est rempli, et on ne saurait plus lequel des
                deux on relit. */}
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="nc-caption" style={{ margin: 0 }}>Ce que je retiens</span>
              <input
                value={feelingDraft.highlight ?? current.feeling.highlight}
                onChange={(e) => setFeelingDraft((d) => ({ ...d, highlight: e.target.value }))}
                onBlur={(e) => saveFeelingText("highlight", e.target.value)}
                placeholder="Ce que je retiens"
                className="nc-input"
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="nc-caption" style={{ margin: 0 }}>A refaire autrement</span>
              <input
                value={feelingDraft.nextTime ?? current.feeling.nextTime}
                onChange={(e) => setFeelingDraft((d) => ({ ...d, nextTime: e.target.value }))}
                onBlur={(e) => saveFeelingText("nextTime", e.target.value)}
                placeholder="A refaire autrement"
                className="nc-input"
              />
            </label>
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div className="nc-eyebrow">Sorties precedentes</div>
            {/* Export local : un Blob et un lien ephemere, rien ne part sur
                le reseau (voir journalRead.downloadText). */}
            <button
              onClick={() => downloadText("carnet-nuitclaire.md", journalToMarkdown(data))}
              className="nc-chip"
            >
              Exporter le carnet
            </button>
          </div>
          {reopenError && <p className="nc-caption" style={{ color: "var(--danger, #e2434f)" }}>{reopenError}</p>}
          {past.map((p) => (
            <div key={p.closedAt} className="nc-card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontSize: 14, textTransform: "capitalize" }}>{fmtDate(p.date)}</div>
                <div className="nc-mono" style={{ fontSize: 11, color: "var(--ink2)" }}>
                  {p.score != null ? `score ${p.score}` : "score n/d"}
                </div>
              </div>
              {/* Cibles cliquables : en relisant une nuit, on veut pouvoir
                  ouvrir la fiche d'une cible pour voir tout ce que le journal
                  en dit. */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {p.targets.length === 0 && (
                  <span style={{ fontSize: 12, color: "var(--ink2)" }}>aucune cible</span>
                )}
                {p.targets.map((designation) => (
                  <button
                    key={designation}
                    onClick={() => onOpenTarget(designation)}
                    className="nc-mono"
                    style={{
                      background: "none", border: "none", padding: 0, cursor: "pointer",
                      fontSize: 12, color: "var(--ink2)", textDecoration: "underline",
                      textDecorationColor: "var(--line)",
                    }}
                  >
                    {designation}
                  </button>
                ))}
              </div>
              <OutingPlace
                site={p.site}
                choices={places}
                onChange={(site) => savePastSession(p.closedAt, { site })}
              />
              <PastConditions conditions={p.conditions} />
              <PastFeeling
                feeling={p.feeling}
                onChange={(patch) => savePastSession(p.closedAt, patch)}
              />
              <input
                value={pastNoteDraft[p.closedAt] ?? p.note}
                onChange={(e) => setPastNoteDraft((d) => ({ ...d, [p.closedAt]: e.target.value }))}
                onBlur={(e) => savePastSession(p.closedAt, { note: e.target.value })}
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
                onClick={() => downloadText(`nuit-${p.date}.md`, outingToMarkdown(p))}
                className="nc-caption"
                style={{ alignSelf: "flex-start", background: "none", border: "none", cursor: "pointer", color: "var(--ink2)", padding: 0 }}
              >
                Exporter cette nuit
              </button>
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
                {reopening === p.closedAt ? "..." : "Rouvrir pour tout modifier"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
