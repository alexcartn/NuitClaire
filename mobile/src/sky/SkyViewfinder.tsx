import { useEffect, useMemo, useRef } from "react";
import skyData from "./skyData.json";
import { altAz, bvColor, guidance, guidanceText, horizonFloor, lstDeg, pointing, sectorOf, symbolOf, viewProject, type AltAz } from "./sky";
import { TargetMark } from "./SkyDome";
import type { Orientation } from "../useCompass";
import type { SkyBodies } from "./types";
import { tap } from "../haptics";

/** Demi-largeur de la vue, en degres : assez pour voir ou l'on est dans le
 * ciel, assez serre pour que le champ des jumelles y ait sa vraie taille. */
const HALF = 32;

const CARDINAL_NAMES: [number, string][] = [
  [0, "N"], [45, "NE"], [90, "E"], [135, "SE"], [180, "S"], [225, "SO"], [270, "O"], [315, "NO"],
];

const PLANET_COLORS: Record<string, string> = {
  Mercure: "#d9cfc1", Vénus: "#fff6d8", Mars: "#ff8a5c", Jupiter: "#f2dcb3",
  Saturne: "#eed590", Uranus: "#aee7ea", Neptune: "#8fb1ff",
};

/** Bande de cap, comme en haut d'un viseur de camera : la direction regardee
 * au milieu, les points cardinaux qui defilent. */
function HeadingTape({ az }: { az: number }) {
  const span = 70; // degres visibles de part et d'autre
  const ticks = [];
  for (let a = Math.ceil((az - span) / 5) * 5; a <= az + span; a += 5) {
    const x = ((a - az) / span) * 50 + 50;
    const norm = ((a % 360) + 360) % 360;
    const name = CARDINAL_NAMES.find(([deg]) => deg === norm)?.[1];
    ticks.push(
      <g key={a}>
        <line x1={x} x2={x} y1={name ? 0 : norm % 15 === 0 ? 3 : 5} y2={8} className="nc-vf-tick" vectorEffect="non-scaling-stroke" />
        {name && (
          <text x={x} y={17} textAnchor="middle" fontSize={name.length === 1 ? 7 : 5.5} className={name.length === 1 ? "nc-vf-tape-main" : "nc-vf-tape-minor"}>
            {name}
          </text>
        )}
      </g>,
    );
  }
  return (
    <svg viewBox="0 0 100 20" preserveAspectRatio="none" className="nc-vf-tape" aria-hidden="true">
      {ticks}
      <path d="M48.5 0 L50 3 L51.5 0Z" className="nc-vf-tape-pointer" />
    </svg>
  );
}

/** Viseur : on tient le telephone contre les jumelles, dans le meme axe. La
 * vue suit le telephone : ciel sombre au-dessus de l'horizon (celui des
 * reglages, arbres compris), sol en ombre dessous, reperes de hauteur, cap
 * en haut. Le cercle est le champ des jumelles a sa vraie taille ; la
 * cible y apparait nommee, sinon un chevron au bord montre ou tourner.
 * La boussole d'un telephone se trompe de 5 a 10 deg, pres d'une
 * voiture ou d'un trepied metallique : le viseur amene dans la bonne region
 * du ciel, le chemin d'etoiles de la fiche fait les derniers degres. */
export function SkyViewfinder({ orientation, site, target, targetLabel, targetKind, fovDeg, horizon, horizonAlt, bodies }: {
  orientation: Orientation;
  site: { lat: number; lon: number };
  target: { raDeg: number; decDeg: number } | null;
  targetLabel: string | null;
  targetKind?: string;
  fovDeg: number;
  horizon?: Record<string, boolean>;
  horizonAlt?: Record<string, number>;
  bodies?: SkyBodies | null;
}) {
  const now = new Date();
  const lst = lstDeg(now, site.lon);
  const aim = pointing(orientation.alpha, orientation.beta, orientation.gamma);
  const targetPos: AltAz | null = target ? altAz(target.raDeg, target.decDeg, site.lat, lst) : null;
  const g = targetPos ? guidance(targetPos, aim) : null;
  const tolerance = Math.max(2, fovDeg / 3);
  const aligned = !!g && g.separation <= tolerance;

  // Une vibration en entrant dans l'axe, pas une en continu.
  const wasAligned = useRef(false);
  useEffect(() => {
    if (aligned && !wasAligned.current) tap();
    wasAligned.current = aligned;
  }, [aligned]);

  const key = [Math.round(aim.alt * 2), Math.round(aim.az * 2), Math.round(lst * 4)];
  const stars = useMemo(
    () =>
      (skyData.stars as [number, number, number, string, number][])
        .filter(([, , mag]) => mag <= 4.8)
        .map(([ra, dec, mag, label, bv]) => ({ p: viewProject(altAz(ra, dec, site.lat, lst), aim), mag, label, color: bvColor(bv ?? 0.6) }))
        .filter((s) => s.p && Math.abs(s.p.x) <= HALF * 1.2 && Math.abs(s.p.y) <= HALF * 1.2),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    key,
  );
  const lines = useMemo(
    () =>
      (skyData.lines as number[][])
        .map(([r1, d1, r2, d2]) => [
          viewProject(altAz(r1, d1, site.lat, lst), aim),
          viewProject(altAz(r2, d2, site.lat, lst), aim),
        ])
        .filter(([a, b]) => a && b && Math.abs(a.x) < HALF * 2 && Math.abs(b.x) < HALF * 2),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    key,
  );
  const constellations = useMemo(
    () =>
      (skyData.constellations as { id: string; fr: string; ra: number; dec: number; rank: number }[])
        .map((c) => ({ ...c, p: viewProject(altAz(c.ra, c.dec, site.lat, lst), aim) }))
        .filter((c) => c.p && Math.abs(c.p.x) < HALF * 0.9 && Math.abs(c.p.y) < HALF * 0.9),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    key,
  );

  // Sol : sous la ligne d'horizon reelle (hauteur des arbres et toits par
  // direction), d'un bord a l'autre de la vue.
  const ground = useMemo(() => {
    const pts: { x: number; y: number }[] = [];
    for (let d = -80; d <= 80; d += 2) {
      const az = aim.az + d;
      const floor = horizon && horizonAlt ? horizonFloor(az, horizon, horizonAlt) ?? 0 : 0;
      const p = viewProject({ alt: floor, az }, aim);
      if (p) pts.push(p);
    }
    if (pts.length < 2) return aim.alt < 0 ? "full" : null;
    const line = pts.map((p) => `${p.x.toFixed(2)},${(-p.y).toFixed(2)}`).join("L");
    const first = pts[0];
    const last = pts[pts.length - 1];
    return `M${first.x},${4 * HALF}L${line}L${last.x},${4 * HALF}Z`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, key.concat([horizon ? 1 : 0]));
  const horizonLine = useMemo(() => {
    const pts: string[] = [];
    for (let d = -80; d <= 80; d += 2) {
      const p = viewProject({ alt: 0, az: aim.az + d }, aim);
      if (p) pts.push(`${p.x.toFixed(2)},${(-p.y).toFixed(2)}`);
    }
    return pts.length > 1 ? `M${pts.join("L")}` : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, key);
  // Reperes de hauteur : 30 et 60 deg, en pointille.
  const altRings = [30, 60].map((alt) => {
    const pts: string[] = [];
    for (let d = -80; d <= 80; d += 2) {
      const p = viewProject({ alt, az: aim.az + d }, aim);
      if (p) pts.push(`${p.x.toFixed(2)},${(-p.y).toFixed(2)}`);
    }
    const mid = viewProject({ alt, az: aim.az + 18 }, aim);
    return { alt, d: pts.length > 1 ? `M${pts.join("L")}` : null, mid };
  });

  const moon = bodies ? viewProject(altAz(bodies.moon.raDeg, bodies.moon.decDeg, site.lat, lst), aim) : null;
  const planets = (bodies?.planets ?? [])
    .filter((pl) => pl.mag <= 6)
    .map((pl) => ({ pl, p: viewProject(altAz(pl.raDeg, pl.decDeg, site.lat, lst), aim) }))
    .filter((x) => x.p && Math.abs(x.p.x) <= HALF && Math.abs(x.p.y) <= HALF);

  const tp = targetPos ? viewProject(targetPos, aim) : null;
  const onScreen = tp && Math.abs(tp.x) <= HALF - 2 && Math.abs(tp.y) <= HALF - 2;
  // Chevron vers la cible, au bord de la vue quand elle est hors champ.
  const arrowAngle = g ? Math.atan2(g.right, g.up) : 0;
  const edge = HALF - 5;
  const ax = Math.sin(arrowAngle) * edge;
  const ay = -Math.cos(arrowAngle) * edge;

  return (
    <div className="nc-stack">
      <div className="nc-vf-frame">
        <HeadingTape az={aim.az} />
        <svg viewBox={`${-HALF} ${-HALF} ${2 * HALF} ${2 * HALF}`} className="nc-sky nc-viewfinder" role="img" aria-label="Viseur">
          <defs>
            <linearGradient id="nc-vf-sky" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" className="nc-sky-grad-edge" />
              <stop offset="100%" className="nc-sky-grad-top" />
            </linearGradient>
            <radialGradient id="nc-vf-glow">
              <stop offset="0%" className="nc-sky-glow-in" />
              <stop offset="100%" className="nc-sky-glow-out" />
            </radialGradient>
          </defs>
          <rect x={-HALF} y={-HALF} width={2 * HALF} height={2 * HALF} fill="url(#nc-vf-sky)" className="nc-sky-bg-grad" />

          {altRings.map((r) => r.d && (
            <g key={r.alt}>
              <path d={r.d} className="nc-vf-altring" vectorEffect="non-scaling-stroke" />
              {r.mid && Math.abs(r.mid.y) < HALF - 2 && (
                <text x={r.mid.x} y={-r.mid.y - 0.8} fontSize={2} className="nc-vf-altlabel">{r.alt}°</text>
              )}
            </g>
          ))}

          {lines.map(([a, b], i) => (
            <line key={i} x1={a!.x} y1={-a!.y} x2={b!.x} y2={-b!.y} className="nc-sky-const" vectorEffect="non-scaling-stroke" />
          ))}
          {constellations.map((c) => (
            <text key={c.id} x={c.p!.x} y={-c.p!.y} fontSize={1.9} textAnchor="middle" className="nc-sky-const-name">{c.fr}</text>
          ))}
          {stars.map((s, i) => (
            <g key={i}>
              {s.mag <= 1.6 && <circle cx={s.p!.x} cy={-s.p!.y} r={(5 - s.mag) * 0.6} fill="url(#nc-vf-glow)" className="nc-sky-star-glow" />}
              <circle cx={s.p!.x} cy={-s.p!.y} r={Math.max(0.22, (5 - s.mag) * 0.28)} fill={s.color} className="nc-sky-star" />
            </g>
          ))}
          {stars
            .filter((s) => s.label && s.mag <= 3)
            .map((s, i) => (
              <text key={`l${i}`} x={s.p!.x + 1} y={-s.p!.y - 0.8} fontSize={2.2} className="nc-sky-label">{s.label}</text>
            ))}
          {planets.map(({ pl, p }) => (
            <g key={pl.name}>
              <circle cx={p!.x} cy={-p!.y} r={1.8} fill="url(#nc-vf-glow)" className="nc-sky-planet-glow" />
              <circle cx={p!.x} cy={-p!.y} r={0.7} fill={PLANET_COLORS[pl.name] ?? "#f3d9a4"} className="nc-sky-planet" />
              <text x={p!.x + 1.2} y={-p!.y - 0.8} fontSize={2.2} className="nc-sky-planet-label">{pl.name}</text>
            </g>
          ))}
          {moon && Math.abs(moon.x) <= HALF && Math.abs(moon.y) <= HALF && (
            <g>
              <circle cx={moon.x} cy={-moon.y} r={1.6} className="nc-sky-moon" />
              <text x={moon.x + 2} y={-moon.y - 1.2} fontSize={2.2} className="nc-sky-planet-label">Lune</text>
            </g>
          )}

          {/* Sol et ligne d'horizon par-dessus le ciel qu'ils cachent. */}
          {ground === "full" && <rect x={-HALF} y={-HALF} width={2 * HALF} height={2 * HALF} className="nc-vf-ground" />}
          {ground && ground !== "full" && <path d={ground} className="nc-vf-ground" />}
          {horizonLine && <path d={horizonLine} className="nc-vf-horizon" vectorEffect="non-scaling-stroke" />}

          {/* Champ des jumelles a sa vraie taille, et reticule au centre. */}
          <circle cx={0} cy={0} r={fovDeg / 2} className={aligned ? "nc-vf-field nc-vf-field-ok" : "nc-vf-field"} vectorEffect="non-scaling-stroke" />
          {aligned && <circle cx={0} cy={0} r={fovDeg / 2} className="nc-vf-field-glow" />}
          <path d="M-1.4 0H-0.5M0.5 0H1.4M0 -1.4V-0.5M0 0.5V1.4" className="nc-vf-cross" vectorEffect="non-scaling-stroke" />

          {tp && onScreen && (
            <g>
              <TargetMark x={tp.x} y={-tp.y} s={1.3} symbol={symbolOf(targetKind)} className="nc-sky-target nc-sky-target-sel" />
              <text x={tp.x + 2} y={-tp.y - 1.6} fontSize={2.6} className="nc-sky-target-label-sel">{targetLabel}</text>
            </g>
          )}
          {g && !onScreen && (
            <g transform={`translate(${ax} ${ay}) rotate(${(arrowAngle * 180) / Math.PI})`}>
              <circle r={3.6} className="nc-vf-chevron-bg" />
              <path d="M-1.8 1.2 L0 -1.2 L1.8 1.2" className="nc-vf-chevron" vectorEffect="non-scaling-stroke" />
            </g>
          )}
          {g && !onScreen && (
            <text x={ax - Math.sin(arrowAngle) * 5.5} y={ay + Math.cos(arrowAngle) * 5.5 + 0.8} fontSize={2.4} textAnchor="middle" className="nc-vf-distance">
              {Math.round(g.separation)}°
            </text>
          )}
        </svg>
      </div>

      <div className={aligned ? "nc-vf-status nc-vf-status-ok" : "nc-vf-status"} role="status">
        {!g
          ? "Choisissez une cible pour être guidé."
          : aligned
            ? `Dans l'axe : ${targetLabel} est dans le champ.`
            : aim.alt < -5 && targetPos && targetPos.alt > 0
              ? `Vous visez le sol : relevez. ${guidanceText(g)}`
              : guidanceText(g)}
      </div>
      <p className="nc-caption nc-num" style={{ margin: 0 }}>
        Visée : hauteur {Math.round(aim.alt)}°, azimut {Math.round(aim.az)}° ({sectorOf(aim.az)})
        {targetPos && ` · ${targetLabel} : ${Math.round(targetPos.alt)}°, ${Math.round(targetPos.az)}° (${sectorOf(targetPos.az)})`}
      </p>
    </div>
  );
}
