import type { StarHop } from "../types";
import { fmtHM } from "../format";

/** Carte du chemin d'etoiles (voir starhop.py) : le ciel autour du chemin,
 * zenith en haut, comme on le voit a l'oeil et dans des jumelles (qui ne
 * retournent pas l'image). Un cercle par saut a la taille du champ des
 * jumelles : ce qu'on doit voir dans l'oculaire a chaque etape.
 *
 * Pense pour la vision nocturne : pas de trait fin (epaisseur fixe en
 * pixels, `vector-effect`), pas de couleur qui porte le sens hormis l'accent
 * sur la cible, la ou l'on vise. */
export function StarHopChart({ hop }: { hop: StarHop }) {
  const r = hop.radiusDeg;
  const size = 2 * r;
  // y du ciel vers le haut, y du SVG vers le bas.
  const Y = (y: number) => -y;
  const font = size * 0.035;
  const starR = (mag: number) => Math.max(size * 0.004, (6.3 - mag) * size * 0.0055);

  return (
    <svg
      viewBox={`${-r} ${-r} ${size} ${size}`}
      className="nc-starhop"
      role="img"
      aria-label={`Carte du chemin depuis ${hop.anchor}`}
    >
      {hop.lines.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={Y(y1)} x2={x2} y2={Y(y2)} className="nc-starhop-const" vectorEffect="non-scaling-stroke" />
      ))}

      {/* Le chemin, puis un champ de jumelles autour de chaque etape. */}
      <polyline
        points={hop.hops.map((h) => `${h.x},${Y(h.y)}`).join(" ")}
        className="nc-starhop-path"
        vectorEffect="non-scaling-stroke"
      />
      {hop.hops.map((h, i) => (
        <circle
          key={`f${i}`}
          cx={h.x}
          cy={Y(h.y)}
          r={hop.fovDeg / 2}
          className={h.target ? "nc-starhop-field nc-starhop-field-target" : "nc-starhop-field"}
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {hop.stars.map((s, i) => (
        <circle key={`s${i}`} cx={s.x} cy={Y(s.y)} r={starR(s.mag)} className="nc-starhop-star" />
      ))}
      {hop.stars
        .filter((s) => s.label)
        .map((s, i) => (
          <text key={`l${i}`} x={s.x + starR(s.mag) * 1.6} y={Y(s.y) - starR(s.mag)} fontSize={font} className="nc-starhop-label">
            {s.label}
          </text>
        ))}

      {hop.hops.map((h, i) =>
        h.target ? (
          <g key={`t${i}`}>
            <circle cx={h.x} cy={Y(h.y)} r={size * 0.018} className="nc-starhop-target" vectorEffect="non-scaling-stroke" />
          </g>
        ) : (
          <text key={`n${i}`} x={h.x - font * 0.3} y={Y(h.y) + font * 1.6} fontSize={font * 0.9} className="nc-starhop-step">
            {i === 0 ? "départ" : i}
          </text>
        ),
      )}
      <title>{`Orientée comme le ciel vers ${fmtHM(hop.time)}`}</title>
    </svg>
  );
}
