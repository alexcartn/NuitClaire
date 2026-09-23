/** Vues de relecture du journal : l'historique d'une cible, et le carnet en
 * Markdown.
 *
 * Tout est derive de ce que le journal contient deja (`Sessions`), cote
 * client : aucune requete, aucun stockage, rien de recalcule par le serveur.
 * Le journal est deja sur l'appareil, y compris hors ligne, et ces vues ne
 * sont que des facons de le lire. Par consequent, rien ici n'invente non
 * plus : ce qui n'a pas ete saisi reste absent. */
import type { Feeling, NightConditions, Sessions, SessionItem, Site, TimelineEntry } from "./types";

// --- Historique d'une cible ------------------------------------------

export interface TargetNight {
  /** Date de la sortie, ou null pour la session en cours. */
  date: string | null;
  closedAt: string | null;
  done: boolean;
  exposureMin: number | null;
  rating: number | null;
  notes: { at: string; text: string }[];
}

export interface TargetHistory {
  designation: string;
  nights: TargetNight[];
  /** Nuits ou la cible a ete pointee, session en cours comprise. */
  nightCount: number;
  totalExposureMin: number;
  /** Moyenne des notes de satisfaction donnees a cette cible, ou null. */
  avgRating: number | null;
}

function nightFrom(item: SessionItem, date: string | null, closedAt: string | null): TargetNight {
  return {
    date,
    closedAt,
    done: item.done,
    exposureMin: item.exposureMin,
    rating: item.rating,
    notes: item.notes.map((n) => ({ at: n.at, text: n.text })),
  };
}

/** Toutes les nuits ou cette cible a ete pointee, la plus recente en tete.
 *
 * Repond a la question qu'on se pose en rouvrant une fiche : « je l'ai deja
 * faite ? quand ? qu'est-ce que j'en avais dit ? ». Le temps d'expo cumule
 * existait deja dans les statistiques, mais sans les nuits qui l'ont
 * produit. */
export function targetHistory(data: Sessions | null, designation: string): TargetHistory {
  const empty: TargetHistory = {
    designation, nights: [], nightCount: 0, totalExposureMin: 0, avgRating: null,
  };
  if (!data) return empty;

  const nights: TargetNight[] = [];
  const inCurrent = data.current.items.find((i) => i.designation === designation);
  if (inCurrent) nights.push(nightFrom(inCurrent, null, null));
  for (const outing of data.past) {
    const item = (outing.items ?? []).find((i) => i.designation === designation);
    if (item) nights.push(nightFrom(item, outing.date, outing.closedAt));
  }

  const ratings = nights.map((n) => n.rating).filter((r): r is number => r != null);
  return {
    designation,
    nights,
    nightCount: nights.length,
    totalExposureMin: nights.reduce((sum, n) => sum + (n.exposureMin ?? 0), 0),
    avgRating: ratings.length
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null,
  };
}

// --- Export Markdown --------------------------------------------------

function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function longDate(isoDate: string): string {
  const d = new Date(isoDate + "T00:00");
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function num(value: number, digits = 1): string {
  return value.toFixed(digits).replace(".", ",");
}

/** "Marson · 48,912 N 4,529 E" : ou la sortie a ete faite. Les coordonnees
 * a trois decimales, soit une centaine de metres -- de quoi retrouver le
 * champ, pas de quoi pretendre a la precision d'un releve. */
export function siteLine(site: Site | null): string | null {
  if (!site) return null;
  const deg = (value: number, positive: string, negative: string) =>
    `${Math.abs(value).toFixed(3).replace(".", ",")} ${value >= 0 ? positive : negative}`;
  return `${site.name} · ${deg(site.lat, "N", "S")} ${deg(site.lon, "E", "O")}`;
}

function conditionsLine(c: NightConditions | null): string | null {
  if (!c) return null;
  const parts = [
    c.tempMinC != null && c.tempMaxC != null ? `${num(c.tempMinC)} a ${num(c.tempMaxC)} °C` : null,
    c.cloudAvgPct != null ? `${Math.round(c.cloudAvgPct)} % de nuages` : null,
    c.seeingAvg != null ? `seeing ${num(c.seeingAvg)}` : null,
    c.transparencyAvg != null ? `transparence ${num(c.transparencyAvg)}` : null,
    c.dewSpreadC != null ? `ecart au point de rosee ${num(c.dewSpreadC)} °` : null,
    c.moonIllum != null ? `Lune ${Math.round(c.moonIllum)} %` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function feelingLines(feeling: Feeling): string[] {
  const lines: string[] = [];
  const scores = [
    feeling.rating != null ? `satisfaction ${feeling.rating}/5` : null,
    feeling.skyQuality != null ? `ciel percu ${feeling.skyQuality}/5` : null,
  ].filter(Boolean);
  if (scores.length) lines.push(`_${scores.join(" · ")}_`);
  if (feeling.highlight) lines.push(`**Ce que je retiens.** ${feeling.highlight}`);
  if (feeling.nextTime) lines.push(`**A refaire autrement.** ${feeling.nextTime}`);
  return lines;
}

function timelineLines(timeline: TimelineEntry[]): string[] {
  return timeline.map((e) => {
    const who = e.target ? `**${e.target}**` : "_note libre_";
    const ctx = e.context
      ? [
          e.context.temperatureC != null ? `${num(e.context.temperatureC)} °C` : null,
          e.context.cloudCoverPct != null ? `${Math.round(e.context.cloudCoverPct)} % nuages` : null,
          e.context.seeing != null ? `seeing ${Math.round(e.context.seeing)}` : null,
        ].filter(Boolean).join(" · ")
      : "";
    return `- ${hhmm(e.at)} · ${who} : ${e.text}${ctx ? `  \n  <sub>${ctx}</sub>` : ""}`;
  });
}

function exposureLine(items: SessionItem[]): string | null {
  const withTime = items.filter((i) => i.exposureMin);
  if (withTime.length === 0) return null;
  return withTime.map((i) => `${i.designation} ${i.exposureMin} min`).join(" · ");
}

/** Une nuit, en Markdown : en-tete, conditions, cibles, fil, ressenti. */
export function outingToMarkdown(outing: Sessions["past"][number]): string {
  const lines: string[] = [`## ${longDate(outing.date)}`, ""];

  const meta = [
    siteLine(outing.site),
    outing.score != null ? `score ${outing.score}/100` : null,
    conditionsLine(outing.conditions),
  ].filter(Boolean);
  if (meta.length) lines.push(`_${meta.join(" · ")}_`, "");

  if (outing.targets.length) {
    lines.push(`**Cibles.** ${outing.targets.join(", ")}`);
    const expo = exposureLine(outing.items ?? []);
    if (expo) lines.push(`**Temps de pose.** ${expo}`);
    lines.push("");
  }

  if (outing.timeline.length) {
    lines.push("### Journal de la nuit", "", ...timelineLines(outing.timeline), "");
  }

  const feeling = feelingLines(outing.feeling);
  if (feeling.length) lines.push(...feeling, "");
  if (outing.note) lines.push(`> ${outing.note}`, "");

  return lines.join("\n");
}

/** Le carnet entier, sorties les plus recentes en tete. La session en cours
 * n'y figure pas : elle n'est pas encore une sortie. */
export function journalToMarkdown(data: Sessions, siteName?: string): string {
  const head = [
    "# Carnet d'observation",
    "",
    `_${data.past.length} sortie(s)${siteName ? ` · ${siteName}` : ""} · exporte le ${longDate(
      new Date().toISOString().slice(0, 10),
    )}_`,
    "",
  ];
  return head.concat(data.past.map(outingToMarkdown)).join("\n");
}

/** Propose le texte au telechargement. Passe par un Blob et un lien
 * ephemere : pas d'appel reseau, l'export doit marcher hors ligne comme le
 * reste du journal. */
export function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
