import type { NightConditions, NoteContext } from "../types";

const dec = (v: number, unit = "") => `${v.toFixed(1).replace(".", ",")}${unit}`;

/** "8,2 °C · 5 % nuages · seeing 3" : ce que la prevision annoncait a
 * l'heure de la note (voir nightContext.ts). N'affiche que ce qui est connu,
 * et rien du tout quand rien ne l'est -- une ligne de tirets ne vaut pas
 * mieux qu'une absence de ligne. */
export function ContextLine({ context }: { context: NoteContext | null }) {
  if (!context) return null;
  const parts = [
    context.temperatureC != null ? dec(context.temperatureC, " °C") : null,
    context.cloudCoverPct != null ? `${Math.round(context.cloudCoverPct)} % nuages` : null,
    context.seeing != null ? `seeing ${Math.round(context.seeing)}` : null,
    context.transparency != null ? `transp. ${Math.round(context.transparency)}` : null,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return <div className="nc-context nc-num">{parts.join(" · ")}</div>;
}

/** Conditions figees a la cloture : la vue d'ensemble de la nuit, quand le
 * contexte des notes en donne le detail heure par heure. Absente des sorties
 * anterieures a son introduction, et silencieuse dans ce cas. */
export function PastConditions({ conditions }: { conditions: NightConditions | null }) {
  if (!conditions) return null;
  // Une decimale partout, sinon « 11 a 11,2 °C » melange deux precisions
  // dans la meme phrase.
  const parts = [
    conditions.tempMinC != null && conditions.tempMaxC != null
      ? `${dec(conditions.tempMinC)} à ${dec(conditions.tempMaxC, " °C")}`
      : null,
    conditions.cloudAvgPct != null ? `${Math.round(conditions.cloudAvgPct)} % nuages` : null,
    conditions.seeingAvg != null ? `seeing ${dec(conditions.seeingAvg)}` : null,
    conditions.moonIllum != null ? `lune ${Math.round(conditions.moonIllum)} %` : null,
    conditions.dewSpreadC != null ? `écart rosée ${dec(conditions.dewSpreadC, "°")}` : null,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return <div className="nc-context nc-num">{parts.join(" · ")}</div>;
}
