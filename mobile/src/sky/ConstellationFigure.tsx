import { useMemo } from "react";
import { buildFigure, type LineRow, type StarRow } from "./constellationFigure";
import { bvColor } from "./sky";
import skyData from "./skyData.json";

/** Rayon d'une etoile selon son eclat, en part de la largeur du cadre. */
const starRadius = (mag: number, width: number) => width * (0.003 + Math.max(0, 6 - mag) * 0.0022);
const starOpacity = (mag: number) => (mag <= 2 ? 1 : mag <= 3.5 ? 0.85 : mag <= 4.3 ? 0.6 : 0.4);

/** La constellation dessinee comme la carte du ciel : fond de nuit, ses
 * traits, les etoiles du voisinage a leur couleur, et le nom de celles qui en
 * ont un. Sert de repere pour la reconnaitre dehors, avant de lire sa
 * legende. */
export function ConstellationFigure({ id, title }: { id: string; title: string }) {
  const fig = useMemo(
    () => buildFigure(id, skyData.stars as StarRow[], skyData.lines as LineRow[]),
    [id],
  );
  if (!fig) return null;
  const { box } = fig;
  const labelSize = box.w * 0.045;

  return (
    <svg
      viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
      className="nc-const-fig"
      role="img"
      aria-label={`Tracé de la constellation ${title}, nord en haut, est à gauche`}
    >
      <rect x={box.x} y={box.y} width={box.w} height={box.h} className="nc-sky-bg" />
      {fig.segments.map((s, i) => (
        <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} className="nc-sky-const nc-const-fig-line" vectorEffect="non-scaling-stroke" />
      ))}
      {fig.stars.map((s, i) => (
        <circle
          key={i}
          cx={s.x}
          cy={s.y}
          r={starRadius(s.mag, box.w)}
          opacity={starOpacity(s.mag)}
          fill={bvColor(s.bv ?? 0.6)}
          className="nc-sky-star"
        />
      ))}
      {fig.stars.filter((s) => s.label).map((s) => {
        // Le nom se met a droite de l'etoile ; a gauche quand il sortirait
        // du cadre (Aldebaran, au bord).
        const gap = starRadius(s.mag, box.w) + labelSize * 0.35;
        const flip = s.x + gap + s.label.length * labelSize * 0.58 > box.x + box.w;
        return (
          <text
            key={s.label}
            x={flip ? s.x - gap : s.x + gap}
            y={s.y + labelSize * 0.3}
            fontSize={labelSize}
            textAnchor={flip ? "end" : "start"}
            // Liseré epais : le nom reste lisible par-dessus un trait.
            style={{ strokeWidth: labelSize * 0.22 }}
            className="nc-sky-label"
          >
            {s.label}
          </text>
        );
      })}
    </svg>
  );
}
