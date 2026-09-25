import { useMemo } from "react";
import skyData from "./skyData.json";
import { altAz, domeProject, lstDeg, type AltAz } from "./sky";
import type { SkyBodies } from "./types";

export interface SkyTarget {
  designation: string;
  raDeg: number;
  decDeg: number;
}

const SECTORS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const LABELLED = 12;
const CARDINALS: [string, number][] = [["N", 0], ["E", 90], ["S", 180], ["O", 270]];

/** Arc de couronne entre deux hauteurs, sur un secteur de 45 deg centre sur
 * `azCenter` : ce que l'horizon cache (arbres, toits) ou un secteur bouche. */
function sectorBand(azCenter: number, altFrom: number, altTo: number, rotation: number): string {
  const pts: string[] = [];
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const az = azCenter - 22.5 + (45 * i) / steps;
    const p = domeProject({ alt: altFrom, az }, rotation)!;
    pts.push(`${p.x},${p.y}`);
  }
  for (let i = steps; i >= 0; i--) {
    const az = azCenter - 22.5 + (45 * i) / steps;
    const p = domeProject({ alt: altTo, az }, rotation)!;
    pts.push(`${p.x},${p.y}`);
  }
  return `M${pts.join("L")}Z`;
}

/** Le ciel entier au-dessus de soi a l'instant `when`, en dome : zenith au
 * centre, horizon sur le bord, est a gauche (comme un planisphere tenu au-
 * dessus de la tete). Etoiles a l'oeil nu, constellations, Lune, planetes,
 * cibles de la nuit, et ce que l'horizon cache, a sa hauteur. */
export function SkyDome({ when, site, horizon, horizonAlt, rotation, bodies, targets, selected, onSelect }: {
  when: Date;
  site: { lat: number; lon: number };
  horizon: Record<string, boolean>;
  horizonAlt: Record<string, number>;
  /** 0 : nord en haut ; cap + 180 : la direction regardee en bas. */
  rotation: number;
  bodies: SkyBodies | null;
  targets: SkyTarget[];
  selected: string | null;
  onSelect: (designation: string) => void;
}) {
  const lst = lstDeg(when, site.lon);
  const toSky = (ra: number, dec: number): AltAz => altAz(ra, dec, site.lat, lst);
  const at = (p: AltAz) => domeProject(p, rotation);

  const stars = useMemo(
    () =>
      (skyData.stars as [number, number, number, string][])
        .map(([ra, dec, mag, label]) => ({ p: at(toSky(ra, dec)), mag, label }))
        .filter((s) => s.p),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lst, rotation, site.lat],
  );
  const lines = useMemo(
    () =>
      (skyData.lines as number[][])
        .map(([r1, d1, r2, d2]) => [at(toSky(r1, d1)), at(toSky(r2, d2))])
        .filter(([a, b]) => a && b),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lst, rotation, site.lat],
  );

  const R = 1.12; // marge pour les lettres cardinales
  const starR = (mag: number) => Math.max(0.004, (5.4 - mag) * 0.0048);

  return (
    <svg viewBox={`${-R} ${-R} ${2 * R} ${2 * R}`} className="nc-sky" role="img" aria-label="Carte du ciel">
      <circle cx={0} cy={0} r={1} className="nc-sky-bg" />
      {[30, 60].map((alt) => (
        <circle key={alt} cx={0} cy={0} r={Math.tan(((90 - alt) / 2) * (Math.PI / 180))} className="nc-sky-grid" vectorEffect="non-scaling-stroke" />
      ))}

      {/* Ce que l'horizon cache : secteur bouche en entier, ou jusqu'a la
          hauteur des arbres. */}
      {SECTORS.map((s, i) => {
        const az = i * 45;
        if (!horizon[s]) return <path key={s} d={sectorBand(az, 0, 89, rotation)} className="nc-sky-blocked" />;
        const h = horizonAlt[s] ?? 0;
        return h > 0 ? <path key={s} d={sectorBand(az, 0, h, rotation)} className="nc-sky-trees" /> : null;
      })}

      {lines.map(([a, b], i) => (
        <line key={i} x1={a!.x} y1={a!.y} x2={b!.x} y2={b!.y} className="nc-sky-const" vectorEffect="non-scaling-stroke" />
      ))}
      {stars.map((s, i) => (
        <circle key={i} cx={s.p!.x} cy={s.p!.y} r={starR(s.mag)} className="nc-sky-star" />
      ))}
      {stars
        .filter((s) => s.label && s.mag <= 2.2)
        .map((s, i) => (
          <text key={`l${i}`} x={s.p!.x + 0.015} y={s.p!.y - 0.012} fontSize={0.035} className="nc-sky-label">
            {s.label}
          </text>
        ))}

      {bodies?.planets.map((pl) => {
        const p = at(toSky(pl.raDeg, pl.decDeg));
        return p ? (
          <g key={pl.name}>
            <circle cx={p.x} cy={p.y} r={0.018} className="nc-sky-planet" />
            <text x={p.x + 0.025} y={p.y + 0.012} fontSize={0.04} className="nc-sky-planet-label">{pl.name}</text>
          </g>
        ) : null;
      })}
      {bodies && (() => {
        const p = at(toSky(bodies.moon.raDeg, bodies.moon.decDeg));
        return p ? (
          <g>
            <circle cx={p.x} cy={p.y} r={0.035} className="nc-sky-moon" />
            <text x={p.x + 0.045} y={p.y + 0.012} fontSize={0.04} className="nc-sky-planet-label">
              Lune {Math.round(bodies.moon.illum)} %
            </text>
          </g>
        ) : null;
      })()}

      {targets.map((t, index) => {
        const p = at(toSky(t.raDeg, t.decDeg));
        if (!p) return null;
        const isSel = t.designation === selected;
        return (
          <g key={t.designation} onClick={() => onSelect(t.designation)} style={{ cursor: "pointer" }}>
            {/* Zone tactile plus large que la marque. */}
            <circle cx={p.x} cy={p.y} r={0.05} fill="transparent" />
            <rect
              x={p.x - 0.017}
              y={p.y - 0.017}
              width={0.034}
              height={0.034}
              className={isSel ? "nc-sky-target nc-sky-target-sel" : "nc-sky-target"}
              vectorEffect="non-scaling-stroke"
            />
            {isSel && <circle cx={p.x} cy={p.y} r={0.05} className="nc-sky-target-sel" vectorEffect="non-scaling-stroke" />}
            {/* Nom des premieres seulement : au-dela, les etiquettes se
                chevauchent. La cible choisie est toujours nommee. */}
            {(isSel || index < LABELLED) && (
              <text x={p.x + 0.028} y={p.y - 0.022} fontSize={isSel ? 0.048 : 0.036} className={isSel ? "nc-sky-target-label-sel" : "nc-sky-target-label"}>
                {t.designation}
              </text>
            )}
          </g>
        );
      })}

      <circle cx={0} cy={0} r={1} className="nc-sky-horizon" vectorEffect="non-scaling-stroke" />
      {CARDINALS.map(([label, az]) => {
        const p = domeProject({ alt: 0, az }, rotation)!;
        return (
          <text key={label} x={p.x * 1.07} y={p.y * 1.07 + 0.02} fontSize={0.06} textAnchor="middle" className="nc-sky-cardinal">
            {label}
          </text>
        );
      })}
    </svg>
  );
}
