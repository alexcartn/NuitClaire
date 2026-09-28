import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import skyData from "./skyData.json";
import { altAz, bvColor, domeProject, domeProjectFree, horizonFloor, lstDeg, sunRaDec, symbolOf, type AltAz, type SkySymbol } from "./sky";
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
}

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

/** Place les etiquettes par ordre d'importance, a droite de leur marque, sinon
 * a gauche ; celles qui ne tiennent nulle part sans en chevaucher une autre
 * sont laissees de cote. Sur un dome de telephone, trois noms superposes ne
 * se lisent plus : mieux vaut en taire un. */
function placeLabels(labels: Label[]) {
  const boxes: { x0: number; y0: number; x1: number; y1: number }[] = [];
  const placed: (Label & { tx: number; anchor: "start" | "end" })[] = [];
  for (const l of labels) {
    const w = l.text.length * l.size * 0.58;
    const gap = l.r + l.size * 0.3;
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

const CARDINALS: [string, number][] = [["N", 0], ["NE", 45], ["E", 90], ["SE", 135], ["S", 180], ["SO", 225], ["O", 270], ["NO", 315]];

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

/** Le ciel entier au-dessus de soi a l'instant `when`, en dome : zenith au
 * centre, horizon sur le bord, est a gauche (comme un planisphere tenu au-
 * dessus de la tete). Voie lactee, etoiles a leur couleur, constellations,
 * Lune en phase, planetes, cibles de la nuit en symboles d'atlas, et la
 * silhouette de l'horizon masque. Pincer pour zoomer, glisser pour se
 * deplacer ; un appui dit ce qu'on a touche. */
export function SkyDome({ when, site, horizon, horizonAlt, rotation, bodies, targets, selected, onSelect, onPick }: {
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
  onPick?: (pick: SkyPick | null) => void;
}) {
  const lst = lstDeg(when, site.lon);
  const toSky = (ra: number, dec: number): AltAz => altAz(ra, dec, site.lat, lst);
  const at = (p: AltAz) => domeProject(p, rotation);
  const [view, setView] = useState<View>({ s: 1, cx: 0, cy: 0 });
  // Les tailles a l'ecran restent lisibles au zoom : textes constants,
  // etoiles un peu plus grosses seulement.
  const z = view.s;
  const zt = 1 / z;
  const zr = 1 / Math.sqrt(z);

  const stars = useMemo(
    () =>
      (skyData.stars as [number, number, number, string, number][])
        .map(([ra, dec, mag, label, bv]) => {
          const pos = toSky(ra, dec);
          return { pos, p: at(pos), mag, label, color: bvColor(bv ?? 0.6) };
        })
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
  // Voie lactee : cinq niveaux de luminosite empiles, du plus etendu au
  // coeur ; les contours passent sous l'horizon et sont rognes au dome.
  const milkyway = useMemo(
    () =>
      (skyData.milkyway as number[][][]).map((rings) =>
        rings
          .map((ring) => {
            const pts: string[] = [];
            for (let i = 0; i < ring.length; i += 2) {
              const p = domeProjectFree(toSky(ring[i], ring[i + 1]), rotation);
              pts.push(`${p.x.toFixed(3)},${p.y.toFixed(3)}`);
            }
            return `M${pts.join("L")}Z`;
          })
          .join(""),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lst, rotation, site.lat],
  );
  const constellations = useMemo(
    () =>
      (skyData.constellations as { id: string; fr: string; ra: number; dec: number; rank: number }[])
        .filter((c) => c.rank <= 2)
        .map((c) => ({ ...c, pos: toSky(c.ra, c.dec) }))
        .filter((c) => c.pos.alt > 8)
        .map((c) => ({ ...c, p: at(c.pos)! })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lst, rotation, site.lat],
  );

  // Silhouette de l'horizon : les arbres et les toits a leur hauteur, en
  // ombre continue ; un secteur bouche, voile hachure par-dessus le ciel.
  const silhouette = useMemo(() => {
    const top: string[] = [];
    const veils: string[] = [];
    let veil: string[] = [];
    for (let az = 0; az <= 360; az += 2) {
      const floor = horizonFloor(az, horizon, horizonAlt);
      // Un peu de relief, toujours le meme, en ondulations lentes : une
      // cime d'arbres n'est ni une regle ni une scie. Proportionnel a la
      // hauteur, pour ne rien inventer la ou l'horizon est degage.
      const wave = 0.12 * Math.sin((az * Math.PI) / 23) + 0.07 * Math.sin((az * Math.PI) / 9.5);
      const h = floor == null ? 0 : floor > 0 ? Math.max(0, floor * (1 + wave)) : 0;
      const p = domeProject({ alt: h, az }, rotation)!;
      top.push(`${p.x.toFixed(3)},${p.y.toFixed(3)}`);
      if (floor == null) {
        const q = domeProject({ alt: 0, az }, rotation)!;
        veil.push(`${q.x.toFixed(3)},${q.y.toFixed(3)}`);
      } else if (veil.length) {
        veils.push(`M0,0L${veil.join("L")}Z`);
        veil = [];
      }
    }
    if (veil.length) veils.push(`M0,0L${veil.join("L")}Z`);
    // Anneau entre le cercle de l'horizon et la cime : trace dans un sens,
    // cercle dans l'autre, rempli en pair-impair.
    return { ground: `M${top.join("L")}Z M0,-1A1,1 0 1,0 0,1A1,1 0 1,0 0,-1Z`, crest: `M${top.join("L")}`, veils };
  }, [horizon, horizonAlt, rotation]);

  const sun = sunRaDec(when);
  const sunPos = toSky(sun.ra, sun.dec);
  const sunP = domeProjectFree(sunPos, rotation);
  // Lueur du crepuscule, du cote du Soleil, tant qu'il n'est pas a -18 deg.
  const twilight = sunPos.alt > -18 ? Math.min(1, (sunPos.alt + 18) / 18) : 0;
  const glowP = domeProject({ alt: 0, az: sunPos.az }, rotation)!;

  const R = 1.14; // marge pour les lettres cardinales
  const starR = (mag: number) => Math.max(0.0035, (5.3 - mag) * 0.0042) * zr;
  const starOpacity = (mag: number) => (mag <= 2 ? 1 : mag <= 3.5 ? 0.85 : mag <= 4.3 ? 0.6 : 0.4);

  const moonPos = bodies ? toSky(bodies.moon.raDeg, bodies.moon.decDeg) : null;
  const moonP = moonPos ? at(moonPos) : null;
  // A l'oeil nu seulement (Uranus, Neptune ne le sont pas), sauf l'astre
  // choisi depuis sa fiche.
  const planetPs = (bodies?.planets ?? [])
    .filter((pl) => pl.mag <= 6 || pl.name === selected)
    .map((pl) => {
      const pos = toSky(pl.raDeg, pl.decDeg);
      return { pl, pos, p: at(pos) };
    });
  const targetPs = targets.map((t, index) => {
    const pos = toSky(t.raDeg, t.decDeg);
    return { t, index, pos, p: at(pos), symbol: symbolOf(t.kind) };
  });

  const sel = targetPs.find((x) => x.t.designation === selected && x.p);
  const labels = placeLabels([
    ...(sel ? [{ key: `t:${sel.t.designation}`, text: sel.t.designation, x: sel.p!.x, y: sel.p!.y, r: 0.045 * zt, size: 0.05 * zt, className: "nc-sky-target-label-sel" }] : []),
    ...(bodies && moonP ? [{ key: "moon", text: `Lune ${Math.round(bodies.moon.illum)} %`, x: moonP.x, y: moonP.y, r: 0.04 * zt, size: 0.042 * zt, className: "nc-sky-planet-label" }] : []),
    ...planetPs.filter((x) => x.p).map(({ pl, p }) => ({ key: `p:${pl.name}`, text: pl.name, x: p!.x, y: p!.y, r: 0.02 * zt, size: 0.042 * zt, className: "nc-sky-planet-label" })),
    ...targetPs
      .filter((x) => x.p && (x.index < LABELLED || z > 1.6) && x.t.designation !== selected)
      .map(({ t, p }) => ({ key: `t:${t.designation}`, text: t.designation, x: p!.x, y: p!.y, r: 0.02 * zt, size: 0.036 * zt, className: "nc-sky-target-label" })),
    ...stars
      .filter((s) => s.label)
      .map((s) => ({ key: `s:${s.label}`, text: s.label, x: s.p!.x, y: s.p!.y, r: starR(s.mag), size: 0.038 * zt, className: "nc-sky-label" })),
  ]);

  // --- Zoom et deplacement ------------------------------------------------
  const svgRef = useRef<SVGSVGElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ moved: boolean; startDist: number; startView: View; start: { x: number; y: number } } | null>(null);

  const toSvg = (clientX: number, clientY: number) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const m = svg.getScreenCTM();
    return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 };
  };
  const clampView = (v: View): View => {
    const s = Math.max(1, Math.min(6, v.s));
    const lim = 1 - 1 / s;
    return { s, cx: Math.max(-lim, Math.min(lim, v.cx)), cy: Math.max(-lim, Math.min(lim, v.cy)) };
  };
  const pixelsPerUnit = () => (svgRef.current ? svgRef.current.getBoundingClientRect().width / ((2 * R) / view.s) : 1);

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
      start: pts.length === 2 ? { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } : { x: e.clientX, y: e.clientY },
    };
    if (pts.length === 1) gesture.current.moved = false;
  };
  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    const pts = [...pointers.current.values()];
    const ppu = pixelsPerUnit() * (view.s / g.startView.s);
    if (pts.length === 2 && g.startDist > 0) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      g.moved = true;
      setView(clampView({ ...g.startView, s: g.startView.s * (d / g.startDist) }));
    } else if (pts.length === 1) {
      const dx = e.clientX - g.start.x;
      const dy = e.clientY - g.start.y;
      if (Math.hypot(dx, dy) > 6) g.moved = true;
      if (g.moved && g.startView.s > 1) {
        setView(clampView({ ...g.startView, cx: g.startView.cx - dx / ppu, cy: g.startView.cy - dy / ppu }));
      }
    }
  };
  const onPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    const wasTap = pointers.current.size === 1 && gesture.current && !gesture.current.moved;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 1 && gesture.current) {
      const [only] = [...pointers.current.values()];
      gesture.current = { ...gesture.current, startView: view, start: only, startDist: 0 };
    }
    if (!wasTap) return;
    pick(toSvg(e.clientX, e.clientY));
  };

  /** Ce qui est le plus proche de l'appui, dans un rayon d'un doigt. */
  const pick = (q: { x: number; y: number }) => {
    const reach = 0.07 * zt;
    const dist = (p: { x: number; y: number } | null) => (p ? Math.hypot(p.x - q.x, p.y - q.y) : Infinity);
    const t = targetPs.filter((x) => x.p).sort((a, b) => dist(a.p) - dist(b.p))[0];
    if (t && dist(t.p) <= reach) {
      onSelect(t.t.designation);
      onPick?.({ kind: "cible", name: t.t.designation, detail: t.t.kind ?? "", alt: t.pos.alt, az: t.pos.az });
      return;
    }
    if (moonP && moonPos && bodies && dist(moonP) <= reach) {
      onPick?.({ kind: "lune", name: "Lune", detail: `éclairée à ${Math.round(bodies.moon.illum)} %`, alt: moonPos.alt, az: moonPos.az });
      return;
    }
    const pl = planetPs.filter((x) => x.p).sort((a, b) => dist(a.p) - dist(b.p))[0];
    if (pl && dist(pl.p) <= reach) {
      onPick?.({ kind: "planete", name: pl.pl.name, detail: `magnitude ${pl.pl.mag.toFixed(1).replace(".", ",")}`, alt: pl.pos.alt, az: pl.pos.az });
      return;
    }
    const st = stars.filter((s) => s.mag <= 4.5).sort((a, b) => dist(a.p) - dist(b.p))[0];
    if (st && dist(st.p) <= reach * 0.8) {
      onPick?.({ kind: "etoile", name: st.label || "Étoile", detail: `magnitude ${st.mag.toFixed(1).replace(".", ",")}`, alt: st.pos.alt, az: st.pos.az });
      return;
    }
    onPick?.(null);
  };

  const vb = (2 * R) / view.s;
  const viewBox = `${view.cx - vb / 2} ${view.cy - vb / 2} ${vb} ${vb}`;

  return (
    <div className="nc-sky-wrap" style={{ position: "relative" }}>
      <svg
        ref={svgRef}
        viewBox={viewBox}
        className="nc-sky"
        role="img"
        aria-label="Carte du ciel"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={(e) => pointers.current.delete(e.pointerId)}
        onDoubleClick={() => setView({ s: 1, cx: 0, cy: 0 })}
        style={{ touchAction: "none" }}
      >
        <defs>
          <radialGradient id="nc-sky-grad" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse">
            <stop offset="0%" className="nc-sky-grad-top" />
            <stop offset="75%" className="nc-sky-grad-mid" />
            <stop offset="100%" className="nc-sky-grad-edge" />
          </radialGradient>
          <radialGradient id="nc-sky-twilight" cx={glowP.x} cy={glowP.y} r="1.1" gradientUnits="userSpaceOnUse">
            <stop offset="0%" className="nc-sky-dusk-in" />
            <stop offset="100%" className="nc-sky-dusk-out" />
          </radialGradient>
          <clipPath id="nc-sky-clip">
            <circle cx={0} cy={0} r={1} />
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

        <circle cx={0} cy={0} r={1} fill="url(#nc-sky-grad)" className="nc-sky-bg-grad" />

        <g clipPath="url(#nc-sky-clip)">
          {twilight > 0 && <circle cx={0} cy={0} r={1} fill="url(#nc-sky-twilight)" opacity={twilight} />}
          {milkyway.map((d, i) => (
            <path key={i} d={d} fillRule="evenodd" className="nc-sky-mw" />
          ))}
          {[30, 60].map((alt) => (
            <circle key={alt} cx={0} cy={0} r={Math.tan(((90 - alt) / 2) * (Math.PI / 180))} className="nc-sky-grid" vectorEffect="non-scaling-stroke" />
          ))}

          {lines.map(([a, b], i) => (
            <line key={i} x1={a!.x} y1={a!.y} x2={b!.x} y2={b!.y} className="nc-sky-const" vectorEffect="non-scaling-stroke" />
          ))}
          {constellations.map((c) => (
            <text key={c.id} x={c.p.x} y={c.p.y} fontSize={0.03 * zt} textAnchor="middle" className="nc-sky-const-name" pointerEvents="none">
              {c.fr}
            </text>
          ))}

          {stars.map((s, i) => (
            <g key={i}>
              {s.mag <= 1.6 && <circle cx={s.p!.x} cy={s.p!.y} r={starR(s.mag) * 3.2} fill="url(#nc-sky-glow)" className="nc-sky-star-glow" />}
              <circle cx={s.p!.x} cy={s.p!.y} r={starR(s.mag)} opacity={starOpacity(s.mag)} fill={s.color} className="nc-sky-star" />
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

          {/* L'horizon masque, par-dessus le ciel qu'il cache. */}
          <path d={silhouette.ground} fillRule="evenodd" className="nc-sky-ground" />
          <path d={silhouette.crest} className="nc-sky-crest" vectorEffect="non-scaling-stroke" />
          {silhouette.veils.map((d, i) => (
            <path key={i} d={d} fill="url(#nc-sky-hatch)" className="nc-sky-veil" />
          ))}
        </g>

        {/* Noms apres les marques, pour rester lisibles par-dessus. La cible
            choisie d'abord : elle est toujours nommee. */}
        {labels.map((l) => (
          <text key={l.key} x={l.tx} y={l.y + l.size * 0.35} fontSize={l.size} textAnchor={l.anchor} className={l.className} pointerEvents="none"
            style={{ strokeWidth: 0.012 * zt }}>
            {l.text}
          </text>
        ))}

        <circle cx={0} cy={0} r={1} className="nc-sky-horizon" vectorEffect="non-scaling-stroke" />
        {CARDINALS.map(([label, az]) => {
          const p = domeProject({ alt: 0, az }, rotation)!;
          const main = label.length === 1;
          return (
            <text key={label} x={p.x * 1.075} y={p.y * 1.075 + 0.018 * zt} fontSize={(main ? 0.058 : 0.036) * zt} textAnchor="middle"
              className={main ? "nc-sky-cardinal" : "nc-sky-cardinal nc-sky-cardinal-minor"} pointerEvents="none">
              {label}
            </text>
          );
        })}
      </svg>
      {view.s > 1 && (
        <button onClick={() => setView({ s: 1, cx: 0, cy: 0 })} className="nc-chip nc-sky-zoom-reset">
          Vue entière
        </button>
      )}
    </div>
  );
}
