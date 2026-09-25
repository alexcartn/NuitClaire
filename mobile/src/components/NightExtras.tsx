import { useCallback } from "react";
import { api } from "../api";
import { useFetch } from "../useFetch";
import { fmtHM, plural } from "../format";
import { Section } from "./Section";
import type { PlanetTonight } from "../sky/types";

const WEEKDAYS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "ce soir";
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()}`;
}

/** Jupiter et ses quatre lunes, alignees comme aux jumelles : est a gauche
 * (on regarde vers le sud), une ligne de points de part et d'autre du disque.
 * Distances a l'echelle ; le texte, lui, garde une taille lisible quelle que
 * soit l'ecartement des lunes (environ 11 px sur un ecran de telephone). */
function JupiterMoons({ moons }: { moons: NonNullable<PlanetTonight["moons"]> }) {
  const span = Math.max(12, ...moons.map((m) => Math.abs(m.x))) + 3;
  const font = span * 0.066;
  const moonR = Math.max(0.45, font * 0.22);
  const charW = font * 0.6;
  // Noms au-dessus du point ; sur une deuxieme ligne, ou dessous (hors du nom
  // de Jupiter), quand ils toucheraient celui d'une lune voisine.
  const jupiterHalf = (7 * charW) / 2;
  const rows: { y: number; end: number; free: (x0: number, x1: number) => boolean }[] = [
    { y: -font * 0.8, end: -Infinity, free: () => true },
    { y: -font * 2, end: -Infinity, free: () => true },
    { y: font * 1.6, end: -Infinity, free: (x0, x1) => x1 < -jupiterHalf - charW || x0 > jupiterHalf + charW },
  ];
  const placed = moons
    .filter((m) => m.visible)
    .map((m) => ({ ...m, px: -m.x }))
    .sort((a, b) => a.px - b.px)
    .map((m) => {
      const half = (m.name.length * charW) / 2;
      const tx = Math.min(span - half, Math.max(-span + half, m.px));
      const row = rows.find((r) => tx - half > r.end + charW && r.free(tx - half, tx + half)) ?? rows[1];
      row.end = tx + half;
      return { ...m, tx, ty: row.y };
    });
  const top = -font * 3.2;
  const height = font * 6.2;
  return (
    <svg viewBox={`${-span} ${top} ${2 * span} ${height}`} className="nc-jupiter" role="img" aria-label="Jupiter et ses lunes">
      <circle cx={0} cy={0} r={1} className="nc-jupiter-disk" />
      <text x={0} y={font * 1.6} fontSize={font} textAnchor="middle" className="nc-jupiter-name">Jupiter</text>
      {placed.map((m) => (
        <g key={m.name}>
          <circle cx={m.px} cy={0} r={moonR} className="nc-jupiter-moon" />
          <text x={m.tx} y={m.ty} fontSize={font} textAnchor="middle" className="nc-jupiter-label">
            {m.name}
          </text>
        </g>
      ))}
      <text x={-span + font * 0.4} y={top + height - font * 0.4} fontSize={font * 0.9} className="nc-jupiter-dir">← est</text>
      <text x={span - font * 0.4} y={top + height - font * 0.4} fontSize={font * 0.9} textAnchor="end" className="nc-jupiter-dir">ouest →</text>
    </svg>
  );
}

/** Planetes et ISS de la nuit : deux sections repliables sur « Ce soir »,
 * utiles surtout aux jumelles. La Lune a sa case en haut de l'ecran (une
 * section ici la repetait). Fermees au depart : le resume
 * a droite dit l'essentiel, ouvertes elles noyaient l'ecran. Gardees sur
 * l'appareil. */
export function NightExtras() {
  const planets = useFetch(useCallback(() => api.planetsTonight(), []), [], "extras-planets");
  const iss = useFetch(useCallback(() => api.iss(), []), [], "extras-iss");

  return (
    <>
      {planets.data && (
        <Section
          id="soir-planetes"
          title="Planètes"
          summary={planets.data.length ? planets.data.map((p) => p.name).join(" · ") : "aucune cette nuit"}
          defaultOpen={false}
        >
          {planets.data.length === 0 && (
            <p className="nc-caption" style={{ margin: 0 }}>Aucune planète assez haute pendant la nuit noire.</p>
          )}
          {planets.data.map((p) => (
            <div key={p.name} className="nc-stack-xs nc-planet">
              <div className="nc-row nc-between nc-baseline">
                <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>{p.name}</span>
                <span className="nc-num nc-caption">mag. {String(p.mag).replace(".", ",")} · {p.constellation}</span>
              </div>
              <span className="nc-caption nc-num" style={{ color: "var(--ink2)" }}>
                visible {fmtHM(p.from)}–{fmtHM(p.to)} · au plus haut {p.bestAlt}° vers {fmtHM(p.bestTime)} ({p.sector})
              </span>
              {p.moons && (
                <>
                  <span className="nc-caption">
                    Ses quatre grandes lunes vers {fmtHM(p.bestTime)} : aux jumelles bien calées (appuyées sur
                    un mur, un toit de voiture), des petits points alignés de part et d'autre de la planète.
                  </span>
                  <JupiterMoons moons={p.moons} />
                </>
              )}
              {p.ringTiltDeg != null && (
                <span className="nc-caption">
                  Anneaux inclinés de {String(p.ringTiltDeg).replace(".", ",")}° : il faut un petit télescope, les
                  jumelles montrent une étoile allongée au mieux.
                </span>
              )}
              {p.name === "Uranus" && (
                <span className="nc-caption">À la limite de l'œil nu : un point vert pâle aux jumelles.</span>
              )}
            </div>
          ))}
        </Section>
      )}

      {iss.data && (
        <Section
          id="soir-iss"
          title="Station spatiale"
          summary={
            iss.data.available
              ? iss.data.passes.length
                ? `${dayLabel(iss.data.passes[0].peak)} ${fmtHM(iss.data.passes[0].peak)}`
                : "aucun passage visible"
              : "indisponible"
          }
          defaultOpen={false}
        >
          {!iss.data.available && <p className="nc-caption" style={{ margin: 0 }}>{iss.data.reason}</p>}
          {iss.data.available && iss.data.passes.length === 0 && (
            <p className="nc-caption" style={{ margin: 0 }}>Aucun passage visible dans les trois prochains jours.</p>
          )}
          {iss.data.passes.map((p) => (
            <div key={p.start} className="nc-plan-row" style={{ cursor: "default" }}>
              <span className="nc-num nc-none" style={{ fontSize: "var(--text-sm)", width: 64 }}>{dayLabel(p.peak)}</span>
              <span className="nc-num nc-none" style={{ fontSize: "var(--text-sm)" }}>
                {fmtHM(p.start)}→{fmtHM(p.end)}
              </span>
              <span className="nc-caption nc-grow">
                {p.peakAlt}° · {p.startDir} → {p.endDir} · {p.brightness}
              </span>
            </div>
          ))}
          {iss.data.available && iss.data.passes.length > 0 && (
            <p className="nc-caption" style={{ margin: 0 }}>
              À l'œil nu : un point brillant qui traverse le ciel en quelques minutes, sans clignoter. Heures
              calculées sur l'orbite du jour ({plural(iss.data.passes.length, "passage", "passages")} sur trois jours).
            </p>
          )}
        </Section>
      )}
    </>
  );
}
