import { useMemo } from "react";
import { fmtHM } from "../format";
import { sectorOf, visibility } from "./sky";

const hm = (d: Date) => fmtHM(d.toISOString());

/** Ce qu'on veut savoir d'un astre touche sur la carte : ou il est, quand
 * il se leve, passe au plus haut et se couche, et surtout quand il depasse
 * les arbres et les toits de ce site. Calcule sur le telephone. */
export function SkyInfoCard({
  name, detail, raDeg, decDeg, raRate = 0, when, isNow, site, horizon, horizonAlt, compact = false, notes, onAim, onFiche, onLegend, onClose,
}: {
  name: string;
  detail: string;
  raDeg: number;
  decDeg: number;
  /** Deg/h : la Lune avance sur le ciel. */
  raRate?: number;
  when: Date;
  isNow: boolean;
  site: { lat: number; lon: number };
  horizon: Record<string, boolean>;
  horizonAlt: Record<string, number>;
  /** Plein ecran : l'essentiel sur deux lignes, pour laisser voir la carte. */
  compact?: boolean;
  /** Precisions sous les horaires (hors plein ecran), une ligne chacune. */
  notes?: string[];
  onAim?: () => void;
  onFiche?: () => void;
  /** Legende de la constellation (ecran Legende). */
  onLegend?: () => void;
  /** Une constellation n'est pas une cible : on la referme au lieu de la
   * viser. */
  onClose?: () => void;
}) {
  // A la minute pres : inutile de refaire 288 pas a chaque rendu.
  const minute = Math.floor(when.getTime() / 60000);
  const v = useMemo(
    () => visibility(raDeg, decDeg, site, new Date(minute * 60000), horizon, horizonAlt, raRate),
    [raDeg, decDeg, site, minute, horizon, horizonAlt, raRate],
  );

  const where = v.now.alt <= 0
    ? "sous l'horizon"
    : `${Math.round(v.now.alt)}° · ${sectorOf(v.now.az)}${v.hiddenNow ? ", caché par les arbres ou les toits" : ""}`;

  let path: string;
  if (v.neverUp) path = "Ne se lève pas d'ici.";
  else {
    const culm = `plus haut à ${hm(v.culmination.time)} (${Math.round(v.culmination.alt)}°, ${sectorOf(v.culmination.az)})`;
    if (v.circumpolar) path = `Ne se couche pas · ${culm}`;
    else {
      const events = [
        ...(v.rise ? [{ t: v.rise, s: `lever ${hm(v.rise)}` }] : []),
        { t: v.culmination.time, s: culm },
        ...(v.set ? [{ t: v.set, s: `coucher ${hm(v.set)}` }] : []),
      ].sort((a, b) => a.t.getTime() - b.t.getTime());
      path = events.map((e) => e.s).join(" · ");
      path = path.charAt(0).toUpperCase() + path.slice(1);
    }
  }

  let clear: string | null = null;
  if (!v.neverUp) {
    const start = minute * 60000;
    if (!v.clear) clear = "Jamais dégagé d'ici en 24 h (arbres, toits ou secteur bouché).";
    else if (v.clear.from.getTime() <= start && v.clear.to.getTime() >= start + 24 * 3600000 - 5 * 60000) clear = "Dégagé en permanence.";
    else if (v.clear.from.getTime() <= start) clear = `Dégagé jusqu'à ${hm(v.clear.to)}.`;
    else clear = `Dégagé de ${hm(v.clear.from)} à ${hm(v.clear.to)}.`;
  }

  return (
    <div className={compact ? "nc-card nc-stack-xs nc-sky-info-compact" : "nc-card nc-stack-xs"}>
      <div className="nc-row nc-between" style={{ alignItems: "flex-start" }}>
        <span style={{ fontSize: "var(--text-sm)" }}>
          <strong style={{ fontWeight: 600 }}>{name}</strong>
          {detail && <span className="nc-caption"> · {detail}</span>}
        </span>
        {(onAim || onFiche || onLegend || onClose) && (
          <span className="nc-row nc-none" style={{ gap: "var(--space-xs)" }}>
            {onAim && <button onClick={onAim} className="nc-chip nc-chip-active">Viser</button>}
            {onFiche && <button onClick={onFiche} className="nc-chip">Fiche</button>}
            {onLegend && <button onClick={onLegend} className="nc-chip nc-chip-active">Légende</button>}
            {onClose && <button onClick={onClose} className="nc-chip">Fermer</button>}
          </span>
        )}
      </div>
      <span style={{ fontSize: "var(--text-sm)" }}>
        {isNow ? "Maintenant" : `À ${hm(when)}`} : {where}
        {compact && clear && <span className="nc-caption"> · {clear}</span>}
      </span>
      {!compact && <span className="nc-caption">{path}</span>}
      {!compact && clear && <span className="nc-caption">{clear}</span>}
      {!compact && notes?.map((n) => <span key={n} className="nc-caption">{n}</span>)}
    </div>
  );
}
