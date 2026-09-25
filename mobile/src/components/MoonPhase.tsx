/** La Lune telle qu'on la verra ce soir : partie eclairee a droite quand
 * elle croit (hemisphere nord), a gauche quand elle decroit. Le terminateur
 * est une demi-ellipse dont la largeur depend de la fraction eclairee. */
export function MoonPhase({ illum, waxing, size = 64 }: { illum: number; waxing: boolean; size?: number }) {
  const k = Math.max(0, Math.min(1, illum / 100));
  const rx = Math.abs(1 - 2 * k);
  const litRight = waxing;
  // Bord eclaire : du haut vers le bas en passant par le cote eclaire.
  const limb = litRight ? "A1 1 0 0 1 0 1" : "A1 1 0 0 0 0 1";
  // Terminateur : du bas vers le haut, bombe vers le cote eclaire pour un
  // croissant, vers le cote sombre pour une Lune gibbeuse.
  const bulgeLit = k < 0.5;
  const sweep = litRight === bulgeLit ? 0 : 1;
  const d = `M0 -1 ${limb} A${rx} 1 0 0 ${sweep} 0 -1 Z`;
  return (
    <svg viewBox="-1.1 -1.1 2.2 2.2" width={size} height={size} role="img" aria-label={`Lune éclairée à ${Math.round(illum)} %`} className="nc-moon">
      <circle cx={0} cy={0} r={1} className="nc-moon-dark" />
      {k > 0.01 && <path d={d} className="nc-moon-lit" />}
      <circle cx={0} cy={0} r={1} className="nc-moon-edge" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
