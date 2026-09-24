/** Petites mises en forme partagees par les ecrans. */

/** "1 sortie", "0 sortie", "3 sorties" : en francais, zero et un prennent le
 * singulier. Remplace les "sortie(s)" qui trainaient dans l'interface. */
export function plural(n: number, one: string, many: string): string {
  return `${n} ${Math.abs(n) < 2 ? one : many}`;
}

/** "48,91° N · 4,53° E" : l'hemisphere se deduit du signe. L'ancien affichage
 * collait « °N » et « °E » en dur, faux des qu'on passe a l'ouest de
 * Greenwich ou au sud de l'equateur. */
export function fmtLatLon(lat: number, lon: number, digits = 2): string {
  const f = (v: number) => Math.abs(v).toFixed(digits).replace(".", ",");
  return `${f(lat)}° ${lat < 0 ? "S" : "N"} · ${f(lon)}° ${lon < 0 ? "O" : "E"}`;
}

/** "21:04" (heure locale, 24 h). */
export function fmtHM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "19h" : heure ronde, pour un intitule d'axe. */
export function fmtH(iso: string): string {
  return `${String(new Date(iso).getHours()).padStart(2, "0")}h`;
}

/** 20.5 -> "20:30" (les horaires de la fenetre habituelle sont stockes en
 * heures decimales, voir settings.view_window). */
export function fmtDecimalHour(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Ce que couvre la fenetre d'observation active, pour un titre. */
export function windowLabel(windowMode: string | undefined, view?: { startHour: number; endHour: number }): string {
  return windowMode === "habituelle" && view
    ? `${fmtDecimalHour(view.startHour)}–${fmtDecimalHour(view.endHour)}`
    : "nuit complète";
}
