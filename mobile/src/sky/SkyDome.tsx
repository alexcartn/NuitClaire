import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import skyData from "./skyData.json";
import {
  altAz, bvColor, domeProject, domeProjectFree, horizonFloor, horizonProject, lstDeg, sunRaDec, symbolOf,
  type AltAz, type SkySymbol,
} from "./sky";
import type { SkyBodies } from "./types";

export interface SkyTarget {
  designation: string;
  raDeg: number;
  decDeg: number;
  /** Code du catalogue (« G », « OCl »...) ou type en clair (« galaxie ») :
   * choisit le symbole d'atlas. */
  kind?: string;
}

/** Ce qu'un appui sur la carte a touche. */
export interface SkyPick {
  kind: "cible" | "etoile" | "planete" | "lune";
  name: string;
  detail: string;
  alt: number;
  az: number;
  raDeg: number;
  decDeg: number;
}

/** Dome : tout le ciel d'un coup, zenith au centre. Horizon : face a une
 * direction, comme on le voit debout (a la maniere de Stellarium). */
export type SkyProjection = "dome" | "horizon";

// Les cibles les mieux placees portent leur nom ; au-dela, un symbole seul.
const LABELLED = 12;

const PLANET_COLORS: Record<string, string> = {
  Mercure: "#d9cfc1", Vénus: "#fff6d8", Mars: "#ff8a5c", Jupiter: "#f2dcb3",
  Saturne: "#eed590", Uranus: "#aee7ea", Neptune: "#8fb1ff",
};

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

interface Bounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Place les etiquettes par ordre d'importance, a droite de leur marque, sinon
 * a gauche ; celles qui ne tiennent nulle part sans en chevaucher une autre
 * sont laissees de cote. Sur un dome de telephone, trois noms superposes ne
 * se lisent plus : mieux vaut en taire un. */
function placeLabels(labels: Label[], view: Bounds) {
  const boxes: Bounds[] = [];
  const placed: (Label & { tx: number; anchor: "start" | "end" })[] = [];
  for (const l of labels) {
    if (l.y < view.y0 || l.y > view.y1) continue;
    const w = l.text.length * l.size * 0.58;
    const gap = l.r + l.size * 0.3;
    for (const side of [1, -1] as const) {
      const x0 = side === 1 ? l.x + gap : l.x - gap - w;
      const box = { x0, y0: l.y - l.size * 0.75, x1: x0 + w, y1: l.y + l.size * 0.3 };
      if (x0 < view.x0 || box.x1 > view.x1) continue;
      if (boxes.some((b) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0)) continue;
      boxes.push(box);
      placed.push({ ...l, tx: side === 1 ? l.x + gap : l.x - gap, anchor: side === 1 ? "start" : "end" });
      break;
    }
  }
  return placed;
}

const CARDINALS: [string, number][] = [["N", 0], ["NE", 45], ["E", 90], ["SE", 135], ["S", 180], ["SO", 225], ["O", 270], ["NO", 315]];

type Pt = { x: number; y: number };

/** Trace une suite de points, en levant le crayon sur ceux qui manquent. */
function pathOf(pts: (Pt | null)[], close = false): string {
  let d = "";
  let pen = false;
  for (const p of pts) {
    if (!p) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${p.x.toFixed(3)},${p.y.toFixed(3)}`;
    pen = true;
  }
  return close && d ? `${d}Z` : d;
}

/** Symbole d'une cible, centre sur (x, y), de demi-taille `s`. */
export function TargetMark({ x, y, s, symbol, className }: { x: number; y: number; s: number; symbol: SkySymbol; className: string }) {
  const common = { className, vectorEffect: "non-scaling-stroke" as const };
  switch (symbol) {
    case "galaxy":
      return <ellipse cx={x} cy={y} rx={s * 1.25} ry={s * 0.62} transform={`rotate(-30 ${x} ${y})`} {...common} />;
    case "open":
      return <circle cx={x} cy={y} r={s} strokeDasharray="2 2" {...common} />;
    case "globular":
      return (
        <g>
          <circle cx={x} cy={y} r={s} {...common} />
          <path d={`M${x - s} ${y}H${x + s}M${x} ${y - s}V${y + s}`} {...common} />
        </g>
      );
    case "planetary":
      return (
        <g>
          <circle cx={x} cy={y} r={s * 0.6} {...common} />
          <path d={`M${x - s * 1.2} ${y}H${x - s * 0.6}M${x + s * 0.6} ${y}H${x + s * 1.2}M${x} ${y - s * 1.2}V${y - s * 0.6}M${x} ${y + s * 0.6}V${y + s * 1.2}`} {...common} />
        </g>
      );
    default:
      return <rect x={x - s} y={y - s} width={2 * s} height={2 * s} {...common} />;
  }
}

/** La Lune avec sa phase, le cote eclaire tourne vers le Soleil. */
function MoonMark({ x, y, r, illum, sunAngle }: { x: number; y: number; r: number; illum: number; sunAngle: number }) {
  const k = Math.max(0, Math.min(1, illum / 100));
  const rx = Math.abs(1 - 2 * k) * r;
  // Bord eclaire du haut vers le bas par la droite (cote Soleil une fois
  // tourne), puis le terminateur, bombe vers l'ombre en phase gibbeuse.
  const d = `M0 ${-r}A${r} ${r} 0 0 1 0 ${r}A${rx} ${r} 0 0 ${k > 0.5 ? 1 : 0} 0 ${-r}Z`;
  return (
    <g transform={`translate(${x} ${y}) rotate(${(sunAngle * 180) / Math.PI})`}>
      <circle r={r * 2.2} className="nc-sky-moon-halo" />
      <circle r={r} className="nc-sky-moon-dark" />
      <path d={d} className="nc-sky-moon" />
    </g>
  );
}

interface View {
  s: number;
  cx: number;
  cy: number;
}

/** Direction regardee dans la vue horizon ; `fov` : champ en degres sur le
 * plus petit cote de l'ecran. */
interface Look {
  az: number;
  alt: number;
  fov: number;
}

const DOME_VIEW: View = { s: 1, cx: 0, cy: 0 };
// Face au sud, l'horizon dans le bas de l'ecran : ce qu'on regarde d'abord
// sous nos latitudes.
const LOOK_ALT = 35;
const LOOK_FOV = 90;
const clampLook = (l: Look): Look => ({
  az: ((l.az % 360) + 360) % 360,
  alt: Math.max(3, Math.min(90, l.alt)),
  fov: Math.max(12, Math.min(150, l.fov)),
});

/** Le ciel au-dessus de soi a l'instant `when`, en dome (zenith au centre,
 * horizon sur le bord, est a gauche, comme un planisphere tenu au-dessus de
 * la tete) ou face a l'horizon. Voie lactee, etoiles a leur couleur,
 * constellations, Lune en phase, planetes, cibles de la nuit en symboles
 * d'atlas, et la silhouette de l'horizon masque. Pincer pour zoomer, glisser
 * pour se deplacer (ou tourner la tete, face a l'horizon) ; un appui dit ce
 * qu'on a touche. */
export function SkyDome({
  when, site, horizon, horizonAlt, projection = "dome", rotation, heading = null, bodies, targets, selected,
  showGrid = false, showConstellations = true, focus = null, onSelect, onPick,
}: {
  when: Date;
  site: { lat: number; lon: number };
  horizon: Record<string, boolean>;
  horizonAlt: Record<string, number>;
  projection?: SkyProjection;
  /** Dome : 0, nord en haut ; cap + 180, la direction regardee en bas. */
  rotation: number;
  /** Vue horizon : le cap de la boussole, que la vue suit ; null, on tourne
   * au doigt. */
  heading?: number | null;
  bodies: SkyBodies | null;
  targets: SkyTarget[];
  selected: string | null;
  showGrid?: boolean;
  showConstellations?: boolean;
  /** Centrer la carte sur ce point ; `n` change a chaque demande. */
  focus?: { raDeg: number; decDeg: number; n: number } | null;
  onSelect: (designation: string) => void;
  onPick?: (pick: SkyPick | null) => void;
}) {
  const horizonView = projection === "horizon";
  const lst = lstDeg(when, site.lon);
  const toSky = (ra: number, dec: number): AltAz => altAz(ra, dec, site.lat, lst);
  const [view, setView] = useState<View>(DOME_VIEW);
  const [look, setLook] = useState<Look>({ az: 180, alt: LOOK_ALT, fov: LOOK_FOV });
  const center: AltAz = { alt: look.alt, az: horizonView && heading != null ? heading : look.az };

  // Taille reelle de la carte : la vue horizon remplit l'ecran, quelle que
  // soit sa forme ; le dome reste carre.
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 1, h: 1 });
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const r = svg.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setSize({ w: r.width, h: r.height });
    });
    ro.observe(svg);
    return () => ro.disconnect();
  }, []);

  // --- Projection et cadre -------------------------------------------------
  const R = 1.14; // dome : marge pour les lettres cardinales
  let proj: (p: AltAz) => Pt | null;
  let projFree: (p: AltAz) => Pt;
  let vb: Bounds;
  let zt: number;
  if (horizonView) {
    const span = Math.tan(((look.fov / 4) * Math.PI) / 180);
    const hx = size.w >= size.h ? (span * size.w) / size.h : span;
    const hy = size.w >= size.h ? span : (span * size.h) / size.w;
    vb = { x0: -hx, y0: -hy, x1: hx, y1: hy };
    zt = span / R;
    proj = (p) => (p.alt < 0 ? null : horizonProject(p, center));
    // Sous l'horizon, ramene juste dessous : les contours (Voie lactee,
    // silhouette) restent finis et sont caches par le sol.
    projFree = (p) => horizonProject({ alt: Math.max(-1, p.alt), az: p.az }, center) ?? { x: 0, y: 1e3 };
  } else {
    const w = (2 * R) / view.s;
    vb = { x0: view.cx - w / 2, y0: view.cy - w / 2, x1: view.cx + w / 2, y1: view.cy + w / 2 };
    zt = 1 / view.s;
    proj = (p) => domeProject(p, rotation);
    projFree = (p) => domeProjectFree(p, rotation);
  }
  // Les tailles a l'ecran restent lisibles au zoom : textes constants,
  // etoiles un peu plus grosses seulement.
  const zr = Math.sqrt(zt);
  const vbW = vb.x1 - vb.x0;
  const vbH = vb.y1 - vb.y0;
  const inView = (p: Pt | null, m = 0): p is Pt => !!p && p.x > vb.x0 + m && p.x < vb.x1 - m && p.y > vb.y0 + m && p.y < vb.y1 - m;

  // --- Positions (recalculees quand l'heure change, pas a chaque geste) ---
  const starsSky = useMemo(
    () =>
      (skyData.stars as [number, number, number, string, number][]).map(([ra, dec, mag, label, bv]) => ({
        ra, dec, pos: toSky(ra, dec), mag, label, color: bvColor(bv ?? 0.6),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lst, site.lat],
  );
  const linesSky = useMemo(
    () => (skyData.lines as number[][]).map(([r1, d1, r2, d2]) => [toSky(r1, d1), toSky(r2, d2)] as const),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lst, site.lat],
  );
  // Voie lactee : cinq niveaux de luminosite empiles, du plus etendu au
  // coeur ; les contours passent sous l'horizon et sont rognes au ciel.
  const milkywaySky = useMemo(
    () =>
      (skyData.milkyway as number[][][]).map((rings) =>
        rings.map((ring) => {
          const pts: AltAz[] = [];
          for (let i = 0; i < ring.length; i += 2) pts.push(toSky(ring[i], ring[i + 1]));
          return pts;
        }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lst, site.lat],
  );
  const constSky = useMemo(
    () =>
      (skyData.constellations as { id: string; fr: string; ra: number; dec: number; rank: number }[])
        .filter((c) => c.rank <= 2)
        .map((c) => ({ ...c, pos: toSky(c.ra, c.dec) }))
        .filter((c) => c.pos.alt > 8),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lst, site.lat],
  );

  const stars = starsSky.map((s) => ({ ...s, p: proj(s.pos) })).filter((s): s is typeof s & { p: Pt } => inView(s.p, -0.05));
  const lines = showConstellations
    ? linesSky.map(([a, b]) => [proj(a), proj(b)] as const).filter((l): l is readonly [Pt, Pt] => !!l[0] && !!l[1] && (inView(l[0]) || inView(l[1])))
    : [];
  const milkyway = milkywaySky.map((rings) => rings.map((ring) => pathOf(ring.map(projFree), true)).join(""));
  const constellations = showConstellations ? constSky.map((c) => ({ ...c, p: proj(c.pos) })).filter((c) => inView(c.p)) : [];

  // Silhouette de l'horizon : les arbres et les toits a leur hauteur, en
  // ombre continue ; un secteur bouche, voile hachure par-dessus le ciel.
  const silhouette = useMemo(() => {
    const top: AltAz[] = [];
    const veils: { from: number; to: number }[] = [];
    let start: number | null = null;
    for (let az = 0; az <= 360; az += 2) {
      const floor = horizonFloor(az, horizon, horizonAlt);
      // Un peu de relief, toujours le meme, en ondulations lentes : une
      // cime d'arbres n'est ni une regle ni une scie. Proportionnel a la
      // hauteur, pour ne rien inventer la ou l'horizon est degage.
      const wave = 0.12 * Math.sin((az * Math.PI) / 23) + 0.07 * Math.sin((az * Math.PI) / 9.5);
      top.push({ alt: floor == null ? 0 : floor > 0 ? Math.max(0, floor * (1 + wave)) : 0, az });
      if (floor == null && start == null) start = az;
      if (floor != null && start != null) {
        veils.push({ from: start, to: az - 2 });
        start = null;
      }
    }
    if (start != null) veils.push({ from: start, to: 360 });
    return { top, veils };
  }, [horizon, horizonAlt]);

  const topPts = silhouette.top.map(projFree);
  const crest = pathOf(topPts);
  const horizonLoop = pathOf(Array.from({ length: 181 }, (_, i) => projFree({ alt: 0, az: i * 2 })), true);
  const pad = Math.max(vbW, vbH);
  const ground = horizonView
    ? `${pathOf(topPts, true)} M${vb.x0 - pad},${vb.y0 - pad}H${vb.x1 + pad}V${vb.y1 + pad}H${vb.x0 - pad}Z`
    : `${pathOf(topPts, true)} M0,-1A1,1 0 1,0 0,1A1,1 0 1,0 0,-1Z`;
  // Secteur bouche : de l'horizon au zenith, bords suivant les meridiens.
  const veils = silhouette.veils.map(({ from, to }) => {
    const pts: Pt[] = [];
    for (let az = from; az <= to; az += 2) pts.push(projFree({ alt: 0, az }));
    for (let alt = 0; alt <= 90; alt += 6) pts.push(projFree({ alt, az: to }));
    for (let alt = 90; alt >= 0; alt -= 6) pts.push(projFree({ alt, az: from }));
    return pathOf(pts, true);
  });

  // Reperes de hauteur : 30 et 60 deg toujours, discrets ; la grille
  // complete (tous les 10 deg, et les huit directions) sur demande.
  const altRings = showGrid ? [10, 20, 30, 40, 50, 60, 70, 80] : [30, 60];
  const grid = [
    ...altRings.map((alt) => pathOf(Array.from({ length: 121 }, (_, i) => proj({ alt, az: i * 3 })))),
    ...(showGrid ? CARDINALS.map(([, az]) => pathOf(Array.from({ length: 16 }, (_, i) => proj({ alt: i * 6, az })))) : []),
  ];
  // Hauteurs ecrites le long de la direction regardee (le bas du dome).
  const gridAz = horizonView ? center.az : rotation + 180;
  const gridLabels = showGrid
    ? altRings.map((alt) => ({ alt, p: proj({ alt, az: gridAz + (horizonView ? 0 : 4) }) })).filter((g) => inView(g.p))
    : [];

  const sun = sunRaDec(when);
  const sunPos = toSky(sun.ra, sun.dec);
  const sunP = projFree(sunPos);
  // Lueur du crepuscule, du cote du Soleil, tant qu'il n'est pas a -18 deg.
  const twilight = sunPos.alt > -18 ? Math.min(1, (sunPos.alt + 18) / 18) : 0;
  const glowP = projFree({ alt: 0, az: sunPos.az });
  // Fond : du zenith sombre a l'horizon plus clair.
  const zenith = projFree({ alt: 90, az: 0 });
  const frontHorizon = projFree({ alt: 0, az: center.az });
  const bgR = horizonView ? Math.hypot(frontHorizon.x - zenith.x, frontHorizon.y - zenith.y) : 1;

  const starR = (mag: number) => Math.max(0.0035, (5.3 - mag) * 0.0042) * zr;
  const starOpacity = (mag: number) => (mag <= 2 ? 1 : mag <= 3.5 ? 0.85 : mag <= 4.3 ? 0.6 : 0.4);

  const moonPos = bodies ? toSky(bodies.moon.raDeg, bodies.moon.decDeg) : null;
  const moonP = moonPos ? proj(moonPos) : null;
  // A l'oeil nu seulement (Uranus, Neptune ne le sont pas), sauf l'astre
  // choisi depuis sa fiche.
  const planetPs = (bodies?.planets ?? [])
    .filter((pl) => pl.mag <= 6 || pl.name === selected)
    .map((pl) => {
      const pos = toSky(pl.raDeg, pl.decDeg);
      return { pl, pos, p: proj(pos) };
    });
  const targetPs = targets.map((t, index) => {
    const pos = toSky(t.raDeg, t.decDeg);
    return { t, index, pos, p: proj(pos), symbol: symbolOf(t.kind) };
  });

  const sel = targetPs.find((x) => x.t.designation === selected) ?? null;
  const labels = placeLabels([
    ...(sel && sel.p ? [{ key: `t:${sel.t.designation}`, text: sel.t.designation, x: sel.p.x, y: sel.p.y, r: 0.045 * zt, size: 0.05 * zt, className: "nc-sky-target-label-sel" }] : []),
    ...(bodies && moonP && selected !== "Lune" ? [{ key: "moon", text: `Lune ${Math.round(bodies.moon.illum)} %`, x: moonP.x, y: moonP.y, r: 0.04 * zt, size: 0.042 * zt, className: "nc-sky-planet-label" }] : []),
    ...planetPs.filter((x) => x.p && x.pl.name !== selected).map(({ pl, p }) => ({ key: `p:${pl.name}`, text: pl.name, x: p!.x, y: p!.y, r: 0.02 * zt, size: 0.042 * zt, className: "nc-sky-planet-label" })),
    ...targetPs
      .filter((x) => x.p && (x.index < LABELLED || zt < 0.62) && x.t.designation !== selected)
      .map(({ t, p }) => ({ key: `t:${t.designation}`, text: t.designation, x: p!.x, y: p!.y, r: 0.02 * zt, size: 0.036 * zt, className: "nc-sky-target-label" })),
    ...stars
      .filter((s) => s.label && s.label !== selected)
      .map((s) => ({ key: `s:${s.label}`, text: s.label, x: s.p.x, y: s.p.y, r: starR(s.mag), size: 0.038 * zt, className: "nc-sky-label" })),
  ], vb);

  // Cible choisie hors du cadre, ou sous l'horizon : une fleche au bord
  // indique ou tourner ; un appui dessus y amene la carte.
  const selArrow = (() => {
    if (!sel) return null;
    let a: Pt | null;
    if (sel.pos.alt < 0 && !horizonView) a = domeProject({ alt: 0, az: sel.pos.az }, rotation);
    else a = sel.p ?? horizonProject(sel.pos, center);
    if (!a) {
      const dAz = ((sel.pos.az - center.az + 540) % 360) - 180;
      a = { x: Math.sign(dAz || 1) * 1e3, y: 0 };
    }
    if (inView(a, 0.02 * zt) && (sel.p || horizonView)) return null;
    const cx = (vb.x0 + vb.x1) / 2;
    const cy = (vb.y0 + vb.y1) / 2;
    const dx = a.x - cx;
    const dy = a.y - cy;
    const m = 0.09 * zt;
    const t = inView(a, m) ? 1 : Math.min(dx ? (vbW / 2 - m) / Math.abs(dx) : Infinity, dy ? (vbH / 2 - m) / Math.abs(dy) : Infinity);
    return { x: cx + dx * t, y: cy + dy * t, angle: (Math.atan2(dy, dx) * 180) / Math.PI, below: sel.pos.alt < 0 };
  })();
  const goToSelected = () => {
    if (!sel) return;
    if (horizonView) {
      setLook((l) => clampLook({ ...l, az: sel.pos.az, alt: sel.pos.alt < 0 ? 20 : Math.max(12, sel.pos.alt) }));
    } else {
      const p = domeProject(sel.pos, rotation);
      setView(p ? clampView({ s: Math.max(view.s, 2), cx: p.x, cy: p.y }) : DOME_VIEW);
    }
  };

  // Centrer sur demande (recherche).
  useEffect(() => {
    if (!focus) return;
    const pos = toSky(focus.raDeg, focus.decDeg);
    if (horizonView) {
      setLook((l) => clampLook({ ...l, az: pos.az, alt: pos.alt < 0 ? 20 : Math.max(12, pos.alt) }));
    } else {
      const p = domeProject(pos, rotation);
      setView(p ? clampView({ s: 2.5, cx: p.x, cy: p.y }) : DOME_VIEW);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.n, focus != null]);

  // --- Zoom et deplacement ------------------------------------------------
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ moved: boolean; startDist: number; startView: View; startLook: Look; start: { x: number; y: number } } | null>(null);

  const toSvg = (clientX: number, clientY: number) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const m = svg.getScreenCTM();
    return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 };
  };
  function clampView(v: View): View {
    const s = Math.max(1, Math.min(6, v.s));
    const lim = 1 - 1 / s;
    return { s, cx: Math.max(-lim, Math.min(lim, v.cx)), cy: Math.max(-lim, Math.min(lim, v.cy)) };
  }
  const pixelsPerUnit = () => size.w / vbW;

  // Molette (ordinateur) : zoom, sans faire defiler la page.
  const projRef = useRef(projection);
  projRef.current = projection;
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const f = Math.exp(-e.deltaY * 0.0015);
      if (projRef.current === "horizon") setLook((l) => clampLook({ ...l, fov: l.fov / f }));
      else setView((v) => clampView({ ...v, s: v.s * f }));
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    // Garder le doigt meme s'il sort de la carte ; sans effet (et sans
    // erreur) si le navigateur ne le permet pas pour ce pointeur.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* pointeur deja relache */
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    gesture.current = {
      moved: gesture.current?.moved ?? false,
      startDist: pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0,
      startView: view,
      startLook: { ...look, az: center.az },
      start: pts.length === 2 ? { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } : { x: e.clientX, y: e.clientY },
    };
    if (pts.length === 1) gesture.current.moved = false;
  };
  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    const pts = [...pointers.current.values()];
    if (pts.length === 2 && g.startDist > 0) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      g.moved = true;
      if (horizonView) setLook(clampLook({ ...g.startLook, fov: g.startLook.fov * (g.startDist / d) }));
      else setView(clampView({ ...g.startView, s: g.startView.s * (d / g.startDist) }));
    } else if (pts.length === 1) {
      const dx = e.clientX - g.start.x;
      const dy = e.clientY - g.start.y;
      if (Math.hypot(dx, dy) > 6) g.moved = true;
      if (!g.moved) return;
      if (horizonView) {
        // Le ciel suit le doigt : glisser vers la droite fait regarder a
        // gauche. Pres du centre, une unite vaut 2 rad (tan de l'angle moitie).
        const span = Math.tan(((g.startLook.fov / 4) * Math.PI) / 180);
        const degPerPx = ((2 * span) / Math.min(size.w, size.h)) * (360 / Math.PI);
        setLook(clampLook({
          ...g.startLook,
          az: heading != null ? g.startLook.az : g.startLook.az - dx * degPerPx,
          alt: g.startLook.alt + dy * degPerPx,
        }));
      } else if (g.startView.s > 1) {
        const ppu = pixelsPerUnit() * (view.s / g.startView.s);
        setView(clampView({ ...g.startView, cx: g.startView.cx - dx / ppu, cy: g.startView.cy - dy / ppu }));
      }
    }
  };
  const onPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    const wasTap = pointers.current.size === 1 && gesture.current && !gesture.current.moved;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 1 && gesture.current) {
      const [only] = [...pointers.current.values()];
      gesture.current = { ...gesture.current, startView: view, startLook: { ...look, az: center.az }, start: only, startDist: 0 };
    }
    if (!wasTap) return;
    pick(toSvg(e.clientX, e.clientY));
  };
  const resetView = () => {
    if (horizonView) setLook((l) => ({ ...l, alt: LOOK_ALT, fov: LOOK_FOV }));
    else setView(DOME_VIEW);
  };

  /** Ce qui est le plus proche de l'appui, dans un rayon d'un doigt. */
  const pick = (q: { x: number; y: number }) => {
    const reach = 0.07 * zt;
    const dist = (p: Pt | null) => (p ? Math.hypot(p.x - q.x, p.y - q.y) : Infinity);
    if (selArrow && dist(selArrow) <= reach * 1.3) {
      goToSelected();
      return;
    }
    const t = targetPs.filter((x) => x.p).sort((a, b) => dist(a.p) - dist(b.p))[0];
    if (t && dist(t.p) <= reach) {
      onSelect(t.t.designation);
      onPick?.({ kind: "cible", name: t.t.designation, detail: t.t.kind ?? "", alt: t.pos.alt, az: t.pos.az, raDeg: t.t.raDeg, decDeg: t.t.decDeg });
      return;
    }
    if (moonP && moonPos && bodies && dist(moonP) <= reach) {
      onPick?.({ kind: "lune", name: "Lune", detail: `éclairée à ${Math.round(bodies.moon.illum)} %`, alt: moonPos.alt, az: moonPos.az, raDeg: bodies.moon.raDeg, decDeg: bodies.moon.decDeg });
      return;
    }
    const pl = planetPs.filter((x) => x.p).sort((a, b) => dist(a.p) - dist(b.p))[0];
    if (pl && dist(pl.p) <= reach) {
      onPick?.({ kind: "planete", name: pl.pl.name, detail: `magnitude ${pl.pl.mag.toFixed(1).replace(".", ",")}`, alt: pl.pos.alt, az: pl.pos.az, raDeg: pl.pl.raDeg, decDeg: pl.pl.decDeg });
      return;
    }
    const st = stars.filter((s) => s.mag <= 4.5).sort((a, b) => dist(a.p) - dist(b.p))[0];
    if (st && dist(st.p) <= reach * 0.8) {
      onPick?.({ kind: "etoile", name: st.label || "Étoile", detail: `magnitude ${st.mag.toFixed(1).replace(".", ",")}`, alt: st.pos.alt, az: st.pos.az, raDeg: st.ra, decDeg: st.dec });
      return;
    }
    onPick?.(null);
  };

  const zoomed = horizonView ? look.fov < LOOK_FOV - 5 || Math.abs(look.alt - LOOK_ALT) > 40 : view.s > 1;
  const viewBox = `${vb.x0} ${vb.y0} ${vbW} ${vbH}`;
  // Selection sous l'horizon, face a l'horizon : montree dans le sol, en
  // retrait, pour savoir ou elle se levera.
  const selBelow = horizonView && sel && sel.pos.alt < 0 ? horizonProject(sel.pos, center) : null;

  return (
    <div className="nc-sky-wrap">
      <svg
        ref={svgRef}
        viewBox={viewBox}
        className={horizonView ? "nc-sky nc-sky-horizon-view" : "nc-sky"}
        role="img"
        aria-label={horizonView ? "Ciel face à l'horizon" : "Carte du ciel"}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={(e) => pointers.current.delete(e.pointerId)}
        onDoubleClick={resetView}
        style={{ touchAction: "none" }}
      >
        <defs>
          <radialGradient id="nc-sky-grad" cx={zenith.x} cy={zenith.y} r={bgR} gradientUnits="userSpaceOnUse">
            <stop offset="0%" className="nc-sky-grad-top" />
            <stop offset="75%" className="nc-sky-grad-mid" />
            <stop offset="100%" className="nc-sky-grad-edge" />
          </radialGradient>
          <radialGradient id="nc-sky-twilight" cx={glowP.x} cy={glowP.y} r="1.1" gradientUnits="userSpaceOnUse">
            <stop offset="0%" className="nc-sky-dusk-in" />
            <stop offset="100%" className="nc-sky-dusk-out" />
          </radialGradient>
          <clipPath id="nc-sky-clip">
            {horizonView ? <path d={horizonLoop} /> : <circle cx={0} cy={0} r={1} />}
          </clipPath>
          <radialGradient id="nc-sky-glow">
            <stop offset="0%" className="nc-sky-glow-in" />
            <stop offset="100%" className="nc-sky-glow-out" />
          </radialGradient>
          {/* Hachures a pas constant a l'ecran, quel que soit le zoom. */}
          <pattern id="nc-sky-hatch" width={0.04 * zt} height={0.04 * zt} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2={0.04 * zt} className="nc-sky-hatch" style={{ strokeWidth: 0.008 * zt }} />
          </pattern>
        </defs>

        {horizonView ? (
          <rect x={vb.x0} y={vb.y0} width={vbW} height={vbH} fill="url(#nc-sky-grad)" className="nc-sky-bg-grad" />
        ) : (
          <circle cx={0} cy={0} r={1} fill="url(#nc-sky-grad)" className="nc-sky-bg-grad" />
        )}

        <g clipPath="url(#nc-sky-clip)">
          {twilight > 0 && (
            horizonView
              ? <rect x={vb.x0} y={vb.y0} width={vbW} height={vbH} fill="url(#nc-sky-twilight)" opacity={twilight} />
              : <circle cx={0} cy={0} r={1} fill="url(#nc-sky-twilight)" opacity={twilight} />
          )}
          {milkyway.map((d, i) => (
            <path key={i} d={d} fillRule="evenodd" className="nc-sky-mw" />
          ))}
          {grid.map((d, i) => (
            <path key={i} d={d} className="nc-sky-grid" vectorEffect="non-scaling-stroke" />
          ))}
          {gridLabels.map(({ alt, p }) => (
            <text key={alt} x={p!.x} y={p!.y - 0.008 * zt} fontSize={0.03 * zt} textAnchor="middle" className="nc-sky-grid-label" pointerEvents="none">
              {alt}°
            </text>
          ))}

          {lines.map(([a, b], i) => (
            <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="nc-sky-const" vectorEffect="non-scaling-stroke" />
          ))}
          {constellations.map((c) => (
            <text key={c.id} x={c.p!.x} y={c.p!.y} fontSize={0.03 * zt} textAnchor="middle" className="nc-sky-const-name" pointerEvents="none">
              {c.fr}
            </text>
          ))}

          {stars.map((s, i) => (
            <g key={i}>
              {s.mag <= 1.6 && <circle cx={s.p.x} cy={s.p.y} r={starR(s.mag) * 3.2} fill="url(#nc-sky-glow)" className="nc-sky-star-glow" />}
              <circle cx={s.p.x} cy={s.p.y} r={starR(s.mag)} opacity={starOpacity(s.mag)} fill={s.color} className="nc-sky-star" />
            </g>
          ))}

          {planetPs.map(({ pl, p }) => p && (
            <g key={pl.name}>
              <circle cx={p.x} cy={p.y} r={0.034 * zr} fill="url(#nc-sky-glow)" className="nc-sky-planet-glow" />
              <circle cx={p.x} cy={p.y} r={Math.max(0.011, 0.018 - pl.mag * 0.0015) * zr} fill={PLANET_COLORS[pl.name] ?? "#f3d9a4"} className="nc-sky-planet" />
            </g>
          ))}
          {moonP && bodies && (
            <MoonMark x={moonP.x} y={moonP.y} r={0.036 * zr} illum={bodies.moon.illum} sunAngle={Math.atan2(sunP.y - moonP.y, sunP.x - moonP.x)} />
          )}

          {targetPs.map(({ t, p, symbol }) => {
            if (!p) return null;
            const isSel = t.designation === selected;
            return (
              <g key={t.designation}>
                <TargetMark x={p.x} y={p.y} s={(isSel ? 0.022 : 0.015) * zt} symbol={symbol} className={isSel ? "nc-sky-target nc-sky-target-sel" : "nc-sky-target"} />
                {isSel && <circle cx={p.x} cy={p.y} r={0.05 * zt} className="nc-sky-target-sel nc-sky-target-ring" vectorEffect="non-scaling-stroke" />}
              </g>
            );
          })}

          {/* Dome : l'horizon masque, par-dessus le ciel qu'il cache. */}
          {!horizonView && <path d={ground} fillRule="evenodd" className="nc-sky-ground" />}
          {!horizonView && <path d={crest} className="nc-sky-crest" vectorEffect="non-scaling-stroke" />}
          {veils.map((d, i) => (
            <path key={i} d={d} fill="url(#nc-sky-hatch)" className="nc-sky-veil" />
          ))}
        </g>

        {/* Face a l'horizon : le sol couvre tout le bas de l'ecran. */}
        {horizonView && <path d={ground} fillRule="evenodd" className="nc-sky-ground nc-sky-ground-full" />}
        {horizonView && <path d={crest} className="nc-sky-crest" vectorEffect="non-scaling-stroke" />}
        {selBelow && inView(selBelow) && sel && (
          <g opacity={0.6}>
            <TargetMark x={selBelow.x} y={selBelow.y} s={0.022 * zt} symbol={sel.symbol} className="nc-sky-target nc-sky-target-sel" />
            <text x={selBelow.x} y={selBelow.y + 0.075 * zt} fontSize={0.036 * zt} textAnchor="middle" className="nc-sky-target-label-sel" style={{ strokeWidth: 0.012 * zt }} pointerEvents="none">
              {sel.t.designation} (sous l'horizon)
            </text>
          </g>
        )}

        {/* Noms apres les marques, pour rester lisibles par-dessus. La cible
            choisie d'abord : elle est toujours nommee. */}
        {labels.map((l) => (
          <text key={l.key} x={l.tx} y={l.y + l.size * 0.35} fontSize={l.size} textAnchor={l.anchor} className={l.className} pointerEvents="none"
            style={{ strokeWidth: 0.012 * zt }}>
            {l.text}
          </text>
        ))}

        {!horizonView && <circle cx={0} cy={0} r={1} className="nc-sky-horizon" vectorEffect="non-scaling-stroke" />}
        {CARDINALS.map(([label, az]) => {
          const main = label.length === 1;
          let x: number;
          let y: number;
          if (horizonView) {
            const p = horizonProject({ alt: 0, az }, center);
            if (!inView(p)) return null;
            x = p.x;
            y = p.y + 0.075 * zt;
          } else {
            const p = domeProject({ alt: 0, az }, rotation)!;
            x = p.x * 1.075;
            y = p.y * 1.075 + 0.018 * zt;
          }
          return (
            <text key={label} x={x} y={y} fontSize={(main ? 0.058 : 0.036) * zt} textAnchor="middle"
              className={`nc-sky-cardinal${main ? "" : " nc-sky-cardinal-minor"}${horizonView ? " nc-sky-cardinal-ground" : ""}`} pointerEvents="none">
              {label}
            </text>
          );
        })}

        {selArrow && sel && (
          <g className="nc-sky-arrow" pointerEvents="none">
            <path
              d={`M${0.035 * zt},0L${-0.02 * zt},${0.025 * zt}L${-0.02 * zt},${-0.025 * zt}Z`}
              transform={`translate(${selArrow.x} ${selArrow.y}) rotate(${selArrow.angle})`}
              className="nc-sky-arrow-head"
            />
            <text
              x={selArrow.x - Math.cos((selArrow.angle * Math.PI) / 180) * 0.06 * zt}
              y={selArrow.y - Math.sin((selArrow.angle * Math.PI) / 180) * 0.06 * zt + 0.012 * zt}
              fontSize={0.034 * zt}
              textAnchor={Math.cos((selArrow.angle * Math.PI) / 180) > 0.3 ? "end" : Math.cos((selArrow.angle * Math.PI) / 180) < -0.3 ? "start" : "middle"}
              className="nc-sky-target-label-sel"
              style={{ strokeWidth: 0.012 * zt }}
            >
              {sel.t.designation}{selArrow.below ? " (sous l'horizon)" : ""}
            </text>
          </g>
        )}
      </svg>
      {zoomed && (
        <button onClick={resetView} className="nc-chip nc-sky-zoom-reset">
          Vue entière
        </button>
      )}
    </div>
  );
}
