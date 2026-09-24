/** Cadran de boussole, cap en haut.
 *
 * La rose tourne, le repere reste fixe en haut : on lit la direction qu'on
 * regarde sans faire pivoter la tete, ce qui est le seul geste utile quand
 * on cherche ou est le sud avant de cocher son horizon.
 *
 * Dessine en SVG, comme les icones d'onglet, pour un rendu identique partout
 * et des couleurs qui suivent le theme (mode vision nocturne compris). */
import { COMPASS_SECTORS } from "../types";
import type { CompassSector } from "../types";

const SIZE = 132;
const CENTER = SIZE / 2;
const RING = 52;
const LABEL_RADIUS = 36;

/** Position d'un point sur le cadran. Le nord est en haut, les angles
 * tournent dans le sens horaire, comme un cap. */
function polar(angleDeg: number, radius: number): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) };
}

export function Compass({ heading, facing }: { heading: number; facing: CompassSector }) {
  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={`Vous regardez vers ${facing}, cap ${Math.round(heading)} degrés`}
    >
      <circle cx={CENTER} cy={CENTER} r={RING} fill="none" stroke="var(--line)" strokeWidth={1} />

      {/* La rose tourne de l'oppose du cap : la direction regardee remonte
          ainsi sous le repere fixe. */}
      <g transform={`rotate(${-heading} ${CENTER} ${CENTER})`}>
        {COMPASS_SECTORS.map((sector, i) => {
          const angle = i * 45;
          const cardinal = angle % 90 === 0;
          const outer = polar(angle, RING);
          const inner = polar(angle, RING - (cardinal ? 9 : 5));
          const label = polar(angle, LABEL_RADIUS);
          const isNorth = sector === "N";
          return (
            <g key={sector}>
              <line
                x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y}
                stroke={isNorth ? "var(--accent)" : "var(--ink3)"}
                strokeWidth={cardinal ? 1.6 : 1}
                strokeLinecap="round"
              />
              {/* Contre-rotation : seule la position des lettres suit la
                  rose, leur orientation non. Une vraie rose de compas les
                  fait tourner avec elle, mais a cette taille la moitie du
                  cadran se lirait alors a l'envers. */}
              <text
                x={label.x}
                y={label.y}
                transform={`rotate(${heading} ${label.x} ${label.y})`}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={cardinal ? 12 : 9}
                style={{ fontFamily: "var(--font-num)" }}
                fill={isNorth ? "var(--accent)" : "var(--ink2)"}
                fontWeight={isNorth ? 700 : 400}
              >
                {sector}
              </text>
            </g>
          );
        })}
      </g>

      {/* Repere fixe : la direction regardee. */}
      <path
        d={`M ${CENTER} ${CENTER - RING - 6} l 5 9 h -10 Z`}
        fill="var(--accent)"
      />
      <circle cx={CENTER} cy={CENTER} r={2.5} fill="var(--ink3)" />
    </svg>
  );
}
