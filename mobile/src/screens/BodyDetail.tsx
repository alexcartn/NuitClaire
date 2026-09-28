import { useCallback, useState } from "react";
import { api } from "../api";
import { mutate } from "../useSessions";
import { newOp } from "../sessionQueue";
import { tap } from "../haptics";
import { useFetch } from "../useFetch";
import { fmtHM } from "../format";
import { ErrorNotice } from "../components/ErrorNotice";
import { NightToggle } from "../components/NightToggle";
import { StatCard } from "../components/StatCard";
import { TabIcon } from "../components/TabIcon";
import { JupiterMoons } from "../components/NightExtras";
import { MoonPhase } from "../components/MoonPhase";
import type { BodyDetail as Body } from "../types";

const dec = (x: number, digits = 1) => x.toFixed(digits).replace(".", ",");

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

/** Taille apparente : en minutes d'arc pour la Lune, en secondes sinon. */
function fmtSize(b: Body): string {
  return b.sizeArcsec >= 120 ? `${dec(b.sizeArcsec / 60, 1)}′` : `${dec(b.sizeArcsec, 1)}″`;
}

/** Hauteur sur la nuit : toute la courbe en trait fin, en accent quand
 * l'astre est assez haut dans un secteur degage. */
function HeightCurve({ body }: { body: Body }) {
  const pts = body.series;
  const W = 300;
  const H = 70;
  const x = (i: number) => (i / (pts.length - 1)) * W;
  const y = (alt: number) => H - (Math.max(0, Math.min(90, alt)) / 90) * H;
  const path = (keep: (i: number) => boolean) =>
    pts.map((p, i) => (keep(i) ? `${i && keep(i - 1) ? "L" : "M"} ${x(i).toFixed(1)} ${y(p.alt).toFixed(1)}` : "")).join(" ");
  return (
    <div className="nc-stack-xs" style={{ gap: "var(--space-2xs)" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img"
        aria-label={`Hauteur de ${body.name} pendant la nuit, au plus haut ${body.bestAlt}°`}>
        <line x1={0} x2={W} y1={H} y2={H} stroke="var(--line)" vectorEffect="non-scaling-stroke" />
        <path d={path(() => true)} fill="none" stroke="var(--ink3)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <path d={path((i) => pts[i].clear && pts[i].night)} fill="none" stroke="var(--accent)" strokeWidth={2.5}
          strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="nc-num" style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)", color: "var(--ink3)" }}>
        <span>{fmtHM(pts[0].time)}</span>
        <span>au plus haut {body.bestAlt}° ({body.bestSector})</span>
        <span>{fmtHM(pts[pts.length - 1].time)}</span>
      </div>
    </div>
  );
}

/** Fiche de la Lune ou d'une planete : ce soir, ou et quand, et de quoi
 * savoir a quoi s'attendre a l'oculaire ou au Seestar. */
export function BodyDetail({ name, onBack, onOpenSky }: {
  name: string;
  onBack: () => void;
  onOpenSky: () => void;
}) {
  const fetchBody = useCallback(() => api.bodyDetail(name), [name]);
  const { data, loading, error, reload } = useFetch(fetchBody, [name], `body:${name}`);
  const [added, setAdded] = useState(false);
  // Par la file du journal, comme depuis une fiche du catalogue : pris en
  // compte tout de suite, meme hors ligne.
  const addToJournal = () => {
    mutate(newOp({ kind: "addItem", designation: name }));
    tap();
    setAdded(true);
  };

  return (
    <div className="nc-screen">
      <div className="nc-row nc-between">
        <button onClick={onBack} className="nc-link nc-link-accent">
          <TabIcon name="back" />
          Retour
        </button>
        <NightToggle />
      </div>

      {loading && !data && <p className="nc-caption">Chargement…</p>}
      {error && !data && <ErrorNotice message="Impossible de charger cette fiche." onRetry={reload} />}

      {data && (
        <>
          <div>
            <div className="nc-eyebrow">{data.kind}</div>
            <div className="nc-row" style={{ gap: "var(--space-sm)", alignItems: "center" }}>
              <div style={{ fontSize: "var(--text-xl)", fontWeight: 500, letterSpacing: "-.02em" }}>{data.name}</div>
              {data.name === "Lune" && <MoonPhase illum={data.phase} waxing={data.nextFull != null && data.nextNew != null && data.nextFull < data.nextNew} size={34} />}
            </div>
            <div className="nc-sub">{data.englishName} · {data.constellation}</div>
          </div>

          <div className="nc-card nc-stack-xs">
            <div className="nc-eyebrow">Ce soir</div>
            <span style={{ fontSize: "var(--text-sm)" }}>
              {data.visibleFrom && data.visibleTo
                ? <>Visible <span className="nc-num">{fmtHM(data.visibleFrom)}–{fmtHM(data.visibleTo)}</span>, au mieux vers <span className="nc-num">{fmtHM(data.bestTime)}</span></>
                : "Pas visible cette nuit d'ici : trop bas, trop près du Soleil ou derrière l'horizon bouché."}
            </span>
            <span className="nc-caption nc-num">
              {[data.rise && `lever ${fmtHM(data.rise)}`, data.transit && `au méridien ${fmtHM(data.transit)}`, data.set && `coucher ${fmtHM(data.set)}`]
                .filter(Boolean).join(" · ")}
            </span>
            <HeightCurve body={data} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "var(--space-xs)" }}>
            <StatCard label="Magnitude" value={dec(data.mag)} sub={data.mag < 0 ? "très brillante" : data.mag < 6 ? "à l'œil nu" : "aux jumelles"} />
            <StatCard label="Taille" value={fmtSize(data)} sub="apparente" />
            <StatCard
              label="Distance"
              value={data.distanceKm != null ? (data.distanceKm / 1000).toFixed(0) : dec(data.distanceAu ?? 0, 2)}
              sub={data.distanceKm != null ? "milliers de km" : "unités astro."}
            />
          </div>

          {data.name === "Lune" && (
            <div className="nc-card nc-stack-xs">
              <div className="nc-eyebrow">Lune</div>
              <span style={{ fontSize: "var(--text-sm)" }}>Éclairée à <span className="nc-num">{data.phase} %</span></span>
              {data.terminatorFeatures && data.terminatorFeatures.length > 0 && (
                <span className="nc-caption">Le long du terminateur ce soir : {data.terminatorFeatures.join(", ")}.</span>
              )}
              {data.nextNew && data.nextFull && (
                <span className="nc-caption nc-num">
                  Nouvelle Lune {fmtDay(data.nextNew)} · pleine Lune {fmtDay(data.nextFull)}
                </span>
              )}
            </div>
          )}

          {data.moons && (
            <div className="nc-card nc-stack-xs">
              <div className="nc-eyebrow">Les quatre grandes lunes vers {fmtHM(data.bestTime)}</div>
              <JupiterMoons moons={data.moons} />
            </div>
          )}

          {data.ringTiltDeg != null && (
            <p className="nc-caption" style={{ margin: 0 }}>
              Anneaux inclinés de {dec(data.ringTiltDeg)}° vus d'ici{data.ringTiltDeg < 4 ? " : presque par la tranche, ils se voient à peine" : ""}.
            </p>
          )}
          {(data.name === "Mercure" || data.name === "Vénus") && (
            <p className="nc-caption" style={{ margin: 0 }}>Éclairée à {data.phase} % : une phase, comme la Lune.</p>
          )}

          <div className="nc-card nc-stack-xs">
            <div className="nc-eyebrow">À l'oculaire</div>
            <span style={{ fontSize: "var(--text-sm)", lineHeight: 1.45 }}>{data.tip}</span>
          </div>

          <div className="nc-row">
            <button onClick={onOpenSky} className="nc-btn nc-grow">Sur la carte du ciel</button>
            <button onClick={addToJournal} disabled={added} className="nc-btn nc-grow">
              {added ? "Ajouté ✓" : "Ajouter au journal"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
