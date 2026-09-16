// Memes seuils que scoring.score_label_fr (0.70 / 0.40) cote Python -- valeur
// attendue sur une echelle 0-1 (score astro, qualite nuages/vent...).
export function qualityColor(value01: number): string {
  if (value01 >= 0.7) return "var(--good)";
  if (value01 >= 0.4) return "var(--mid)";
  return "var(--bad)";
}
