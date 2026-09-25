import { useEffect, useMemo, useRef } from "react";
import skyData from "./skyData.json";
import { altAz, guidance, guidanceText, lstDeg, pointing, sectorOf, viewProject, type AltAz } from "./sky";
import type { Orientation } from "../useCompass";
import { tap } from "../haptics";

/** Demi-largeur de la vue, en degres : assez pour voir ou l'on est dans le
 * ciel, assez peu pour que le champ des jumelles reste lisible. */
const HALF = 32;

/** Viseur : on tient le telephone contre les jumelles, dans le meme axe. La
 * vue montre le ciel autour de la direction visee, un cercle du champ des
 * jumelles au centre, et une consigne (« 12° à droite, 8° plus haut ») vers
 * la cible. Dans l'axe, le telephone vibre une fois.
 *
 * Une boussole de telephone se trompe de 5 a 10 deg, davantage pres d'une
 * voiture ou d'un trepied metallique : le viseur amene dans la bonne region
 * du ciel, le chemin d'etoiles de la fiche fait les derniers degres. */
export function SkyViewfinder({ orientation, site, target, targetLabel, fovDeg }: {
  orientation: Orientation;
  site: { lat: number; lon: number };
  target: { raDeg: number; decDeg: number } | null;
  targetLabel: string | null;
  fovDeg: number;
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

  const stars = useMemo(
    () =>
      (skyData.stars as [number, number, number, string][])
        .filter(([, , mag]) => mag <= 4.5)
        .map(([ra, dec, mag, label]) => ({ p: viewProject(altAz(ra, dec, site.lat, lst), aim), mag, label }))
        .filter((s) => s.p && Math.abs(s.p.x) <= HALF * 1.2 && Math.abs(s.p.y) <= HALF * 1.2),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [Math.round(aim.alt * 2), Math.round(aim.az * 2), Math.round(lst * 4)],
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
    [Math.round(aim.alt * 2), Math.round(aim.az * 2), Math.round(lst * 4)],
  );

  const tp = targetPos ? viewProject(targetPos, aim) : null;
  const onScreen = tp && Math.abs(tp.x) <= HALF && Math.abs(tp.y) <= HALF;
  // Fleche vers la cible, en bord de vue quand elle est hors champ.
  const arrowAngle = g ? Math.atan2(g.right, g.up) : 0;

  return (
    <div className="nc-stack">
      <svg viewBox={`${-HALF} ${-HALF} ${2 * HALF} ${2 * HALF}`} className="nc-sky nc-viewfinder" role="img" aria-label="Viseur">
        <rect x={-HALF} y={-HALF} width={2 * HALF} height={2 * HALF} className="nc-sky-bg" />
        {aim.alt < HALF && (
          <rect x={-HALF} y={aim.alt} width={2 * HALF} height={2 * HALF} className="nc-sky-ground" />
        )}
        {lines.map(([a, b], i) => (
          <line key={i} x1={a!.x} y1={-a!.y} x2={b!.x} y2={-b!.y} className="nc-sky-const" vectorEffect="non-scaling-stroke" />
        ))}
        {stars.map((s, i) => (
          <circle key={i} cx={s.p!.x} cy={-s.p!.y} r={Math.max(0.25, (5 - s.mag) * 0.3)} className="nc-sky-star" />
        ))}
        {stars
          .filter((s) => s.label && s.mag <= 3)
          .map((s, i) => (
            <text key={`l${i}`} x={s.p!.x + 0.9} y={-s.p!.y - 0.7} fontSize={2.2} className="nc-sky-label">{s.label}</text>
          ))}

        {/* Champ des jumelles et reticule au centre : c'est la ou l'on vise. */}
        <circle cx={0} cy={0} r={fovDeg / 2} className={aligned ? "nc-vf-field nc-vf-field-ok" : "nc-vf-field"} vectorEffect="non-scaling-stroke" />
        <path d="M-2 0H2M0 -2V2" className="nc-vf-cross" vectorEffect="non-scaling-stroke" />

        {tp && onScreen && (
          <g>
            <rect x={tp.x - 1.2} y={-tp.y - 1.2} width={2.4} height={2.4} className="nc-sky-target nc-sky-target-sel" vectorEffect="non-scaling-stroke" />
            <text x={tp.x + 1.8} y={-tp.y - 1.4} fontSize={2.6} className="nc-sky-target-label-sel">{targetLabel}</text>
          </g>
        )}
        {g && !onScreen && (
          <g transform={`rotate(${(arrowAngle * 180) / Math.PI})`}>
            <path d={`M0 ${-HALF + 3} l-3 5 h6 z`} className="nc-vf-arrow" />
          </g>
        )}
      </svg>

      <div className={aligned ? "nc-vf-status nc-vf-status-ok" : "nc-vf-status"} role="status">
        {!g
          ? "Choisissez une cible pour être guidé."
          : aligned
            ? `Dans l'axe : ${targetLabel} est dans le champ.`
            : guidanceText(g)}
      </div>
      <p className="nc-caption nc-num" style={{ margin: 0 }}>
        Visée : hauteur {Math.round(aim.alt)}°, azimut {Math.round(aim.az)}° ({sectorOf(aim.az)})
        {targetPos && ` · ${targetLabel} : ${Math.round(targetPos.alt)}°, ${Math.round(targetPos.az)}° (${sectorOf(targetPos.az)})`}
      </p>
    </div>
  );
}
