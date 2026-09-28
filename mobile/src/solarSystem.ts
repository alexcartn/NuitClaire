/** La Lune et les planetes : pas dans le catalogue, mais la meme fiche que
 * le ciel profond (screens/Detail.tsx, voir bodies.as_target_detail). */
export const BODY_NAMES = ["Lune", "Mercure", "Vénus", "Mars", "Jupiter", "Saturne", "Uranus", "Neptune"] as const;

const ENGLISH: Record<string, string> = {
  moon: "Lune", mercury: "Mercure", venus: "Vénus", mars: "Mars", jupiter: "Jupiter",
  saturn: "Saturne", uranus: "Uranus", neptune: "Neptune",
};

export function isBody(designation: string): boolean {
  return (BODY_NAMES as readonly string[]).includes(designation);
}

const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Le nom de l'appli pour ce qui a ete tape (« saturn », « venus »,
 * « lune »), ou null. Nom entier, pas un debut : dans le journal, « ma »
 * doit rester une recherche du catalogue. */
export function matchBody(query: string): string | null {
  const q = fold(query);
  return BODY_NAMES.find((b) => fold(b) === q) ?? ENGLISH[q] ?? null;
}
