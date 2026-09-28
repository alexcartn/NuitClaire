/** Calendrier de l'agenda du ciel (components/SkyAgenda.tsx) : des semaines
 * du lundi au dimanche, chaque jour avec ses evenements. Pur et sans DOM. */
import type { SkyEvent } from "./types";

export interface AgendaDay {
  /** "2026-10-04", date locale. */
  date: string;
  day: number;
  /** Passe (avant aujourd'hui) : grise, sans evenement. */
  past: boolean;
  today: boolean;
  events: SkyEvent[];
}

function key(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** `weeks` semaines a partir du lundi de la semaine de `today`. La date d'un
 * evenement est celle du lieu (le serveur l'ecrit avec son decalage) : ses
 * dix premiers caracteres suffisent. */
export function agendaWeeks(events: SkyEvent[], today: Date, weeks = 5): AgendaDay[][] {
  const byDay = new Map<string, SkyEvent[]>();
  for (const e of events) {
    const k = e.date.slice(0, 10);
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }
  const todayKey = key(today);
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const day = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + w * 7 + d);
      const k = key(day);
      const past = k < todayKey;
      return { date: k, day: day.getDate(), past, today: k === todayKey, events: past ? [] : byDay.get(k) ?? [] };
    }),
  );
}

/** Le jour a montrer d'office : aujourd'hui s'il s'y passe quelque chose,
 * sinon le prochain jour charge. */
export function firstBusyDay(weeks: AgendaDay[][]): string | null {
  return weeks.flat().find((d) => !d.past && d.events.length > 0)?.date ?? null;
}
