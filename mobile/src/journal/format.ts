/** Mises en forme propres au journal. */

export function fmtDate(isoDate: string): string {
  const d = new Date(isoDate + "T00:00");
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

/** '125' minutes -> "2 h 05" ; en-dessous de l'heure, "45 min". */
export function fmtExposure(totalMin: number): string {
  if (totalMin <= 0) return "0 min";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
}
