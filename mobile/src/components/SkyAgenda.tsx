import { useCallback, useState } from "react";
import { api } from "../api";
import { useFetch } from "../useFetch";
import type { SkyEvent } from "../types";

const KIND_LABEL: Record<SkyEvent["kind"], string> = {
  lune: "Lune",
  eclipse: "Éclipse",
  planete: "Planète",
  rapprochement: "Rapprochement",
  meteores: "Étoiles filantes",
};

/** « sam. 4 oct. », et l'heure quand elle compte (rapprochement, phase,
 * eclipse) ; une pluie d'etoiles filantes se donne pour la nuit. */
function when(e: SkyEvent): string {
  const d = new Date(e.date);
  const day = d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  if (e.kind === "meteores") {
    const next = new Date(d.getTime() + 86_400_000);
    return `nuit du ${d.getDate()} au ${next.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`;
  }
  if (e.kind === "planete") return day;
  return `${day} · ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
}

/** Ce qui arrive dans le ciel ces 30 prochains jours, calcule pour le lieu
 * (voir sky_events.py) : les dates que les articles annoncent, mais fiables
 * et a nos heures. */
export function SkyAgenda() {
  const { data } = useFetch(useCallback(() => api.skyEvents(), []), [], "sky-events");
  const [all, setAll] = useState(false);
  if (!data) return null;
  // La nuit en cours reste affichee jusqu'au matin.
  const upcoming = data.filter((e) => new Date(e.date).getTime() > Date.now() - 12 * 3_600_000);
  if (upcoming.length === 0) return null;
  const shown = all ? upcoming : upcoming.slice(0, 4);
  return (
    <div className="nc-card nc-stack-xs">
      <div className="nc-row nc-between">
        <span className="nc-eyebrow">À venir dans le ciel</span>
        <span className="nc-caption nc-none">30 jours</span>
      </div>
      {shown.map((e) => (
        <div key={`${e.date}-${e.title}`} className="nc-stack-xs"
          style={{ gap: 2, paddingTop: "var(--space-xs)", borderTop: "1px solid var(--line)", opacity: e.visible === false ? 0.6 : 1 }}>
          <div className="nc-row nc-between" style={{ gap: "var(--space-xs)", alignItems: "baseline" }}>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>{e.title}</span>
            <span className="nc-caption nc-none" style={{ color: "var(--accent)" }}>{KIND_LABEL[e.kind]}</span>
          </div>
          <span className="nc-caption nc-num" style={{ color: "var(--ink)" }}>{when(e)}</span>
          <span className="nc-caption">{e.detail}</span>
        </div>
      ))}
      {upcoming.length > 4 && (
        <button onClick={() => setAll((v) => !v)} className="nc-link nc-link-accent">
          {all ? "Réduire" : `Tout voir (+${upcoming.length - 4})`}
        </button>
      )}
    </div>
  );
}
