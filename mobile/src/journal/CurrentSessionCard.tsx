import { useEffect, useState } from "react";
import { api } from "../api";
import { messierIdOf } from "../messierDex";
import { itemSummary } from "../journalView";
import { TabIcon } from "../components/TabIcon";
import { fmtHM } from "../format";
import { tap } from "../haptics";
import { localNoteId } from "../sessionQueue";
import type { SessionOpBody } from "../sessionQueue";
import type { CurrentSession, Feeling, Site, TimelineEntry } from "../types";
import { fmtExposure } from "./format";
import { OutingPlace } from "./OutingPlace";
import { Rating } from "./Rating";
import { Timeline } from "./Timeline";

/** La sortie en cours : cibles, fil de la nuit, ressenti, cloture. */
export function CurrentSessionCard({ current, places, pendingNotes, captured, send, onClose, onOpenTarget, onCaptureChange }: {
  current: CurrentSession;
  /** Messier deja captures (identifiants "31"...), pour proposer la capture
   * quand une cible Messier est cochee faite. */
  captured: Set<string>;
  onCaptureChange: () => void;
  places: Site[];
  pendingNotes: Set<string>;
  send: (body: SessionOpBody) => void;
  onClose: () => void;
  onOpenTarget: (designation: string) => void;
}) {
  const [itemNoteDraft, setItemNoteDraft] = useState<Record<string, string>>({});
  const [exposureDraft, setExposureDraft] = useState<Record<string, string>>({});
  const [feelingDraft, setFeelingDraft] = useState<Partial<Record<keyof Feeling, string>>>({});

  // Une seule cible depliee a la fois, la derniere ajoutee au depart : six
  // cibles depliees faisaient une page entiere de champs.
  const latest = [...current.items].sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1))[0]?.designation ?? null;
  const [openItem, setOpenItem] = useState<string | null>(latest);
  // Une cible qu'on vient d'ajouter s'ouvre : c'est elle qu'on va noter.
  useEffect(() => {
    if (latest) setOpenItem(latest);
  }, [latest]);
  const [capturing, setCapturing] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const toggleDone = (designation: string, done: boolean) => {
    send({ kind: "setDone", designation, done: !done });
    tap();
  };

  /** Cocher un Messier « fait » ne le marque pas capture d'office : une
   * sortie ratee se coche aussi. On le propose, en un appui, juste sous la
   * cible -- plus besoin d'aller le refaire dans l'onglet Messier. */
  const markCaptured = async (id: string) => {
    setCapturing(id);
    setCaptureError(null);
    try {
      await api.updateMessierCapture(id, true);
      tap();
      onCaptureChange();
    } catch {
      setCaptureError("Capture non enregistrée : pas de réseau ? Réessayez plus tard.");
    } finally {
      setCapturing(null);
    }
  };

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
    tap();
    setItemNoteDraft((d) => ({ ...d, [designation]: "" }));
  };

  const deleteTimelineEntry = (entry: TimelineEntry) => {
    if (entry.target) send({ kind: "removeItemNote", designation: entry.target, noteId: entry.id });
    else send({ kind: "removeFreeNote", noteId: entry.id });
  };

  const setFeeling = (patch: Partial<Feeling>) => send({ kind: "setFeeling", patch });

  /** Champ libre du ressenti : enregistre a la sortie du champ, pas a chaque
   * frappe -- inutile d'empiler une operation par lettre dans la file. */
  const saveFeelingText = (field: "highlight" | "nextTime", value: string) => {
    if (value === current.feeling[field]) return;
    setFeeling({ [field]: value });
  };

  return (
    <div className="nc-card nc-stack" style={{ borderColor: "var(--accent)" }}>
      <div className="nc-row nc-between nc-baseline">
        <div style={{ fontSize: "var(--text-md)" }}>Session en cours</div>
        {current.openedAt && (
          <div className="nc-num" style={{ fontSize: "var(--text-xs)", color: "var(--accent)" }}>
            depuis {fmtHM(current.openedAt)}
            {current.scoreAtOpen != null ? ` · score ${current.scoreAtOpen}` : ""}
          </div>
        )}
      </div>

      {/* D'ou cette sortie est faite, fige a son ouverture : changer de
          position dans les reglages ne doit pas reecrire le passe. On
          s'apercoit souvent une fois installe qu'on est parti sans y
          penser, d'ou la correction ici aussi. */}
      <div style={{ marginTop: "calc(var(--space-xs) * -1)" }}>
        <OutingPlace site={current.siteAtOpen} choices={places} onChange={(site) => send({ kind: "setSite", site })} />
      </div>

      {current.items.length > 0 && (
        <div className="nc-stack-xs">
          {current.items.map((item) => (
            <div key={item.designation} className="nc-session-item nc-stack-xs">
              <div className="nc-row" style={{ gap: "var(--space-sm)" }}>
                <button
                  onClick={() => toggleDone(item.designation, item.done)}
                  className="nc-check"
                  aria-pressed={item.done}
                  aria-label={`${item.designation} capturée`}
                >
                  <span className={`nc-check-box ${item.done ? "nc-check-box-on" : ""}`}>✓</span>
                </button>
                <button
                  onClick={() => onOpenTarget(item.designation)}
                  className="nc-num nc-session-target"
                >
                  {item.designation}
                </button>
                {/* Toute la ligne ouvre ou replie la cible ; son resume dit ce
                    qui a deja ete saisi sans avoir a la deplier. */}
                <button
                  onClick={() => setOpenItem((cur) => (cur === item.designation ? null : item.designation))}
                  className="nc-caption nc-grow nc-item-toggle"
                  aria-expanded={openItem === item.designation}
                  aria-label={`${openItem === item.designation ? "Replier" : "Déplier"} ${item.designation}`}
                >
                  <span className="nc-ellipsis">
                    {fmtHM(item.addedAt)}
                    {itemSummary(item) && ` · ${itemSummary(item)}`}
                  </span>
                  <span className={`nc-section-chevron ${openItem === item.designation ? "nc-section-chevron-open" : ""}`}>
                    <TabIcon name="chevron" />
                  </span>
                </button>
                <button
                  onClick={() => send({ kind: "removeItem", designation: item.designation })}
                  className="nc-icon-btn"
                  title="Retirer du journal"
                  aria-label={`Retirer ${item.designation} du journal`}
                >
                  ×
                </button>
              </div>

              {(() => {
                const id = messierIdOf(item.designation);
                if (!item.done || !id || captured.has(id)) return null;
                return (
                  <div className="nc-row nc-between nc-notice">
                    <span>
                      {item.designation} rejoint ton objectif Messier ?
                    </span>
                    <button
                      onClick={() => markCaptured(id)}
                      disabled={capturing === id}
                      className="nc-chip nc-chip-active nc-none"
                    >
                      {capturing === id ? "…" : "Marquer capturé"}
                    </button>
                  </div>
                );
              })()}
              {captureError && <div className="nc-notice">{captureError}</div>}

              {openItem === item.designation && (
              <>
              <div className="nc-row">
                <input
                  value={itemNoteDraft[item.designation] ?? ""}
                  onChange={(e) => setItemNoteDraft((d) => ({ ...d, [item.designation]: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && submitItemNote(item.designation)}
                  placeholder="Ajouter une note…"
                  aria-label={`Note sur ${item.designation}`}
                  className="nc-input"
                />
                <button
                  onClick={() => submitItemNote(item.designation)}
                  disabled={!(itemNoteDraft[item.designation] ?? "").trim()}
                  className="nc-btn nc-btn-sm nc-none"
                  aria-label={`Ajouter la note sur ${item.designation}`}
                >
                  +
                </button>
              </div>

              <div className="nc-row">
                <label className="nc-caption nc-none" htmlFor={`expo-${item.designation}`}>Expo (min)</label>
                <input
                  id={`expo-${item.designation}`}
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={exposureDraft[item.designation] ?? item.exposureMin ?? ""}
                  onChange={(e) => setExposureDraft((d) => ({ ...d, [item.designation]: e.target.value }))}
                  onBlur={(e) => saveExposure(item.designation, e.target.value)}
                  placeholder="0"
                  className="nc-input nc-none"
                  style={{ width: 80 }}
                />
                {item.exposureMin != null && (
                  <span className="nc-num nc-caption">{fmtExposure(item.exposureMin)} cette sortie</span>
                )}
              </div>

              <Rating
                label="Satisfaction"
                scope={item.designation}
                value={item.rating}
                onChange={(rating) => send({ kind: "setItemRating", designation: item.designation, rating })}
              />
              </>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="nc-stack-xs">
        <div className="nc-eyebrow">Journal de la nuit</div>
        <Timeline entries={current.timeline} pendingNotes={pendingNotes} onDelete={deleteTimelineEntry} />
      </div>

      <div className="nc-divider" />

      <div className="nc-stack-xs">
        <div className="nc-eyebrow">Ressenti de la nuit</div>
        <Rating label="Satisfaction" scope="de la nuit" value={current.feeling.rating} onChange={(rating) => setFeeling({ rating })} />
        {/* Volontairement distincte du score calcule : c'est l'ecart
            entre les deux qui interesse, pas leur accord. */}
        <Rating
          label="Ciel perçu"
          scope="cette nuit"
          value={current.feeling.skyQuality}
          onChange={(skyQuality) => setFeeling({ skyQuality })}
        />
        {/* Intitule visible en plus du placeholder : celui-ci disparait
            des que le champ est rempli, et on ne saurait plus lequel des
            deux on relit. */}
        <label className="nc-stack-xs" style={{ gap: "var(--space-2xs)" }}>
          <span className="nc-caption">Ce que je retiens</span>
          <input
            value={feelingDraft.highlight ?? current.feeling.highlight}
            onChange={(e) => setFeelingDraft((d) => ({ ...d, highlight: e.target.value }))}
            onBlur={(e) => saveFeelingText("highlight", e.target.value)}
            placeholder="Ce que je retiens"
            className="nc-input"
          />
        </label>
        <label className="nc-stack-xs" style={{ gap: "var(--space-2xs)" }}>
          <span className="nc-caption">À refaire autrement</span>
          <input
            value={feelingDraft.nextTime ?? current.feeling.nextTime}
            onChange={(e) => setFeelingDraft((d) => ({ ...d, nextTime: e.target.value }))}
            onBlur={(e) => saveFeelingText("nextTime", e.target.value)}
            placeholder="À refaire autrement"
            className="nc-input"
          />
        </label>
      </div>

      <button onClick={onClose} className="nc-btn nc-btn-primary">
        Clôturer la session
      </button>
    </div>
  );
}
