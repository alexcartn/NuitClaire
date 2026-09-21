/** Acces a localStorage qui ne casse jamais l'appli.
 *
 * localStorage leve dans plusieurs cas reels : navigation privee sur
 * certains navigateurs, stockage bloque par une politique de site, quota
 * atteint, et meme la simple lecture peut lever avant tout acces. Une appli
 * qu'on ouvre dehors, hors ligne, ne doit pas s'arreter la-dessus : ici tout
 * echec se traduit par "pas de valeur", jamais par une exception.
 *
 * Regroupe parce que trois modules faisaient le meme try/catch (file du
 * journal, theme, cache de donnees). */

export function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* stockage plein ou indisponible : la valeur ne sera pas retenue */
  }
}

export function readText(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeText(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* idem */
  }
}
