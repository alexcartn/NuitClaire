/** La Lune et les planetes : pas dans le catalogue, elles ont leur propre
 * fiche (screens/BodyDetail.tsx, GET /api/bodies/{nom}). */
export const BODY_NAMES = ["Lune", "Mercure", "Vénus", "Mars", "Jupiter", "Saturne", "Uranus", "Neptune"] as const;

export function isBody(designation: string): boolean {
  return (BODY_NAMES as readonly string[]).includes(designation);
}
