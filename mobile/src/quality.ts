// Memes seuils que scoring.score_label_fr (0.70 / 0.40) cote Python -- valeur
// attendue sur une echelle 0-1 (score astro, qualite nuages/vent...).
export function qualityColor(value01: number): string {
  if (value01 >= 0.7) return "var(--good)";
  if (value01 >= 0.4) return "var(--mid)";
  return "var(--bad)";
}

// Meme formule que scoring.wind_quality : 0 = redhibitoire (>=40 km/h de
// rafales), 1 = ideal (<=10 km/h). Duplique plutot que partage (pas de pont
// Python/TS dans ce projet), a garder synchronise avec scoring.py.
export function windQuality(gustKmh: number): number {
  return 1 - Math.max(0, Math.min(1, (gustKmh - 10) / 30));
}
