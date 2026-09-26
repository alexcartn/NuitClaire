/** Cadran de boussole, cap en haut.
 *
 * La rose tourne, le repere reste fixe en haut : on lit la direction qu'on
 * regarde sans faire pivoter la tete, ce qui est le seul geste utile quand
 * on cherche ou est le sud avant de cocher son horizon.
 *
 * Autour du cadran, l'horizon enregistre : chaque secteur en couleur (libre,
 * degage a partir d'une hauteur, bouche). La couronne tourne avec la rose :
 * sous le repere, on lit si la direction qu'on regarde est degagee, sans
 * aller chercher le bouton du secteur.
 *
 * Dessine en SVG, comme les icones d'onglet, pour un rendu identique partout
 * et des couleurs qui suivent le theme (mode vision nocturne compris). */
import { COMPASS_SECTORS } from "../types";
import type { CompassSector } from "../types";

const SIZE = 176;
const CENTER = SIZE / 2;
const RING = 58;
const LABEL_RADIUS = 41;
/** Couronne de l'horizon, juste hors du cadran. */
const BAND_IN = RING + 4;
const BAND_OUT = RING + 16;

/** Position d'un point sur le cadran. Le nord est en haut, les angles
 * tournent dans le sens horaire, comme un cap. */
function polar(angleDeg: number, radius: number): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) };
}

export interface SectorHorizon {
  open: boolean;
  alt: number;
}

/** Couleur d'un secteur : libre, degage au-dessus d'une hauteur, bouche. */
export function horizonColor(s: SectorHorizon | undefined): string {
  if (!s || !s.open) return "var(--bad)";
  return s.alt > 0 ? "var(--mid)" : "var(--good)";
}

/** Secteur de couronne centre sur `angle`, 45 deg moins un petit jour entre
 * voisins pour qu'on distingue deux secteurs de meme couleur. */
function bandPath(angle: number): string {
  const a0 = angle - 21;
  const a1 = angle + 21;
  const o0 = polar(a0, BAND_OUT);
  const o1 = polar(a1, BAND_OUT);
  const i1 = polar(a1, BAND_IN);
  const i0 = polar(a0, BAND_IN);
  return `M${o0.x} ${o0.y}A${BAND_OUT} ${BAND_OUT} 0 0 1 ${o1.x} ${o1.y}L${i1.x} ${i1.y}A${BAND_IN} ${BAND_IN} 0 0 0 ${i0.x} ${i0.y}Z`;
}

export function Compass({ heading, facing, horizon }: {
  heading: number;
  facing: CompassSector;
  /** Horizon enregistre, par secteur : colore la couronne. */
  horizon?: Record<string, SectorHorizon>;
}) {
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
        {horizon &&
          COMPASS_SECTORS.map((sector, i) => (
            <path
              key={`h${sector}`}
              d={bandPath(i * 45)}
              fill={horizonColor(horizon[sector])}
              opacity={sector === facing ? 0.95 : 0.55}
            />
          ))}
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
        d={`M ${CENTER} ${CENTER - (horizon ? BAND_OUT + 1 : RING - 3)} l -6 -10 h 12 Z`}
        fill="var(--accent)"
      />
      <circle cx={CENTER} cy={CENTER} r={2.5} fill="var(--ink3)" />
    </svg>
  );
}
