import { useCallback, useState, type CSSProperties } from "react";
import { api } from "../api";
import { useFetch } from "../useFetch";
import { agendaWeeks, firstBusyDay } from "../agendaView";
import type { SkyEvent } from "../types";

const KIND_LABEL: Record<SkyEvent["kind"], string> = {
  lune: "Lune",
  eclipse: "Éclipse",
  planete: "Planète",
  rapprochement: "Rapprochement",
  meteores: "Étoiles filantes",
};

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

/** Repere d'un evenement dans sa case : la Lune dessinee (pleine = disque
 * vide, nouvelle = disque plein), le reste en point d'accent. */
function Mark({ e }: { e: SkyEvent }) {
  const base: CSSProperties = { width: 7, height: 7, borderRadius: "50%", boxSizing: "border-box", flex: "none" };
  if (e.kind === "lune") {
    const full = e.title.startsWith("Pleine");
    return <span style={{ ...base, border: "1.5px solid var(--ink2)", background: full ? "transparent" : "var(--ink2)" }} />;
  }
  if (e.kind === "eclipse") {
    return <span style={{ ...base, border: "1.5px solid var(--accent)", background: "linear-gradient(90deg, var(--accent) 50%, transparent 50%)" }} />;
  }
  return <span style={{ ...base, background: "var(--accent)", opacity: e.visible === false ? 0.4 : 1 }} />;
}

/** Heure de l'evenement quand elle compte ; la nuit pour les etoiles
 * filantes ; rien pour une opposition (toute la nuit). */
function timeOf(e: SkyEvent): string | null {
  const d = new Date(e.date);
  if (e.kind === "meteores") {
    const next = new Date(d.getTime() + 86_400_000);
    return `nuit du ${d.getDate()} au ${next.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`;
  }
  if (e.kind === "planete") return null;
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function dayTitle(date: string): string {
  return new Date(date + "T12:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

/** Ce qui arrive dans le ciel ces 5 prochaines semaines, calcule pour le
 * lieu (voir sky_events.py), en calendrier : un repere par evenement, un
 * appui sur un jour en donne le detail. */
export function SkyAgenda() {
  const { data } = useFetch(useCallback(() => api.skyEvents(), []), [], "sky-events");
  const [picked, setPicked] = useState<string | null>(null);
  if (!data) return null;
  const weeks = agendaWeeks(data, new Date());
  const selected = picked ?? firstBusyDay(weeks);
  const day = weeks.flat().find((d) => d.date === selected);

  return (
    <div className="nc-card nc-stack-xs">
      <div className="nc-row nc-between">
        <span className="nc-eyebrow">À venir dans le ciel</span>
        <span className="nc-caption nc-none">5 semaines</span>
      </div>

      <div role="grid" aria-label="Calendrier du ciel" style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 3 }}>
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="nc-caption" style={{ textAlign: "center", fontSize: 11 }}>{w}</span>
        ))}
        {weeks.flat().map((d) => {
          const isSel = d.date === selected;
          const busy = d.events.length > 0;
          // Le 1er du mois porte son nom : on voit ou le mois change.
          const label = d.day === 1 ? new Date(d.date + "T12:00").toLocaleDateString("fr-FR", { month: "short" }) : null;
          return (
            <button
              key={d.date}
              onClick={() => busy && setPicked(d.date)}
              disabled={!busy}
              aria-pressed={isSel}
              aria-label={`${dayTitle(d.date)}${busy ? ` : ${d.events.map((e) => e.title).join(", ")}` : ""}`}
              style={{
                minHeight: 44, padding: "4px 0", borderRadius: 10, cursor: busy ? "pointer" : "default",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", gap: 3,
                background: isSel ? "var(--accent)" : busy ? "var(--surf)" : "transparent",
                border: d.today && !isSel ? "1px solid var(--accent)" : "1px solid transparent",
                color: isSel ? "var(--onaccent)" : d.past ? "var(--ink3)" : "var(--ink)",
                opacity: d.past ? 0.5 : 1,
              }}
            >
              <span className="nc-num" style={{ fontSize: "var(--text-xs)", fontWeight: busy ? 600 : 400, lineHeight: 1.1 }}>
                {label ? <span style={{ fontSize: 9 }}>{label} </span> : null}
                {d.day}
              </span>
              {busy && (
                <span style={{ display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "center" }}>
                  {d.events.slice(0, 3).map((e, i) => (
                    isSel
                      ? <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--onaccent)" }} />
                      : <Mark key={i} e={e} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {day && day.events.length > 0 && (
        <div className="nc-stack-xs" style={{ paddingTop: "var(--space-xs)", borderTop: "1px solid var(--line)" }}>
          <span className="nc-caption" style={{ color: "var(--ink)", fontWeight: 600 }}>{dayTitle(day.date)}</span>
          {day.events.map((e) => {
            const t = timeOf(e);
            return (
              <div key={e.title} className="nc-stack-xs" style={{ gap: 2, opacity: e.visible === false ? 0.6 : 1 }}>
                <div className="nc-row nc-between" style={{ gap: "var(--space-xs)", alignItems: "baseline" }}>
                  <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>{e.title}</span>
                  <span className="nc-caption nc-none" style={{ color: "var(--accent)" }}>{KIND_LABEL[e.kind]}</span>
                </div>
                <span className="nc-caption">
                  {t && <span className="nc-num" style={{ color: "var(--ink)" }}>{t} · </span>}
                  {e.detail}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="nc-row nc-wrap nc-caption" style={{ gap: "var(--space-sm)", fontSize: 11 }}>
        <span className="nc-row" style={{ gap: 4 }}><Mark e={{ kind: "lune", title: "Nouvelle Lune" } as SkyEvent} /> nouvelle Lune</span>
        <span className="nc-row" style={{ gap: 4 }}><Mark e={{ kind: "lune", title: "Pleine Lune" } as SkyEvent} /> pleine Lune</span>
        <span className="nc-row" style={{ gap: 4 }}><Mark e={{ kind: "planete", visible: true } as SkyEvent} /> événement</span>
      </div>
    </div>
  );
}
