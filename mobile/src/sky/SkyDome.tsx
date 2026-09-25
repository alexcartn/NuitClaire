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
/** Cibles nommees : les premieres de la liste, si la place le permet. */
const LABELLED = 12;

interface Label {
  key: string;
  text: string;
  x: number;
  y: number;
  /** Rayon de la marque : l'etiquette se pose juste a cote. */
  r: number;
  size: number;
  className: string;
}

/** Place les etiquettes par ordre d'importance, a droite de leur marque, sinon
 * a gauche ; celles qui ne tiennent nulle part sans en chevaucher une autre
 * sont laissees de cote. Sur un dome de telephone, trois noms superposes ne
 * se lisent plus : mieux vaut en taire un. */
function placeLabels(labels: Label[]) {
  const boxes: { x0: number; y0: number; x1: number; y1: number }[] = [];
  const placed: (Label & { tx: number; anchor: "start" | "end" })[] = [];
  for (const l of labels) {
    const w = l.text.length * l.size * 0.58;
    const gap = l.r + 0.012;
    for (const side of [1, -1] as const) {
      const x0 = side === 1 ? l.x + gap : l.x - gap - w;
      const box = { x0, y0: l.y - l.size * 0.75, x1: x0 + w, y1: l.y + l.size * 0.3 };
      if (x0 < -1.1 || box.x1 > 1.1) continue;
      if (boxes.some((b) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0)) continue;
      boxes.push(box);
      placed.push({ ...l, tx: side === 1 ? l.x + gap : l.x - gap, anchor: side === 1 ? "start" : "end" });
      break;
    }
  }
  return placed;
}
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
  // Les faibles restent en pointille de fond ; les brillantes, les reperes,
  // ressortent.
  const starR = (mag: number) => Math.max(0.0035, (5.2 - mag) * 0.0038);
  const starOpacity = (mag: number) => (mag <= 3 ? 1 : mag <= 4 ? 0.7 : 0.45);

  const moonP = bodies ? at(toSky(bodies.moon.raDeg, bodies.moon.decDeg)) : null;
  const planetPs = (bodies?.planets ?? []).map((pl) => ({ pl, p: at(toSky(pl.raDeg, pl.decDeg)) }));
  const targetPs = targets.map((t, index) => ({ t, index, p: at(toSky(t.raDeg, t.decDeg)) }));

  const sel = targetPs.find((x) => x.t.designation === selected && x.p);
  const labels = placeLabels([
    ...(sel ? [{ key: `t:${sel.t.designation}`, text: sel.t.designation, x: sel.p!.x, y: sel.p!.y, r: 0.05, size: 0.05, className: "nc-sky-target-label-sel" }] : []),
    ...(bodies && moonP ? [{ key: "moon", text: `Lune ${Math.round(bodies.moon.illum)} %`, x: moonP.x, y: moonP.y, r: 0.035, size: 0.042, className: "nc-sky-planet-label" }] : []),
    ...planetPs.filter((x) => x.p).map(({ pl, p }) => ({ key: `p:${pl.name}`, text: pl.name, x: p!.x, y: p!.y, r: 0.018, size: 0.042, className: "nc-sky-planet-label" })),
    ...targetPs
      .filter((x) => x.p && x.index < LABELLED && x.t.designation !== selected)
      .map(({ t, p }) => ({ key: `t:${t.designation}`, text: t.designation, x: p!.x, y: p!.y, r: 0.02, size: 0.036, className: "nc-sky-target-label" })),
    ...stars
      .filter((s) => s.label)
      .map((s) => ({ key: `s:${s.label}`, text: s.label, x: s.p!.x, y: s.p!.y, r: starR(s.mag), size: 0.036, className: "nc-sky-label" })),
  ]);

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
        <circle key={i} cx={s.p!.x} cy={s.p!.y} r={starR(s.mag)} opacity={starOpacity(s.mag)} className="nc-sky-star" />
      ))}

      {planetPs.map(({ pl, p }) => p && <circle key={pl.name} cx={p.x} cy={p.y} r={0.018} className="nc-sky-planet" />)}
      {moonP && <circle cx={moonP.x} cy={moonP.y} r={0.035} className="nc-sky-moon" />}

      {targetPs.map(({ t, p }) => {
        if (!p) return null;
        const isSel = t.designation === selected;
        return (
          <g key={t.designation} onClick={() => onSelect(t.designation)} style={{ cursor: "pointer" }}>
            {/* Zone tactile plus large que la marque. */}
            <circle cx={p.x} cy={p.y} r={0.05} fill="transparent" />
            <rect
              x={p.x - (isSel ? 0.02 : 0.014)}
              y={p.y - (isSel ? 0.02 : 0.014)}
              width={isSel ? 0.04 : 0.028}
              height={isSel ? 0.04 : 0.028}
              className={isSel ? "nc-sky-target nc-sky-target-sel" : "nc-sky-target"}
              vectorEffect="non-scaling-stroke"
            />
            {isSel && <circle cx={p.x} cy={p.y} r={0.05} className="nc-sky-target-sel" vectorEffect="non-scaling-stroke" />}
          </g>
        );
      })}

      {/* Noms apres les marques, pour rester lisibles par-dessus. La cible
          choisie d'abord : elle est toujours nommee. */}
      {labels.map((l) => (
        <text key={l.key} x={l.tx} y={l.y + l.size * 0.35} fontSize={l.size} textAnchor={l.anchor} className={l.className} pointerEvents="none">
          {l.text}
        </text>
      ))}

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
