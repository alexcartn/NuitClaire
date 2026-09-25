import { useCallback, useMemo, useState } from "react";
import { api } from "../api";
import { useFetch } from "../useFetch";
import { useRemembered } from "../useRemembered";
import { useCompass } from "../useCompass";
import { fmtHM } from "../format";
import { NightToggle } from "../components/NightToggle";
import { TabIcon } from "../components/TabIcon";
import { SkyDome, type SkyTarget } from "../sky/SkyDome";
import { SkyViewfinder } from "../sky/SkyViewfinder";
import { altAz, lstDeg, sectorOf } from "../sky/sky";
import type { AppState, TargetRow } from "../types";

/** Cibles marquees sur la carte : les premieres de la liste de ce soir. Au-
 * dela, la carte devient illisible ; la cible choisie y est toujours. */
const MAP_TARGETS = 30;

/** Carte du ciel (dome) et viseur, pour trouver ses cibles aux jumelles.
 * Calcule sur le telephone (voir sky/sky.ts) : marche hors ligne, une fois
 * la liste de la nuit et la position de la Lune gardees sur l'appareil. */
export default function Ciel({ state, initialTarget, initialMode, onOpenTarget, onBack }: {
  state: AppState | null;
  initialTarget: string | null;
  initialMode: "carte" | "viseur";
  onOpenTarget: (designation: string) => void;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<"carte" | "viseur">(initialMode);
  const [selected, setSelected] = useState<string | null>(initialTarget);
  const [offsetMin, setOffsetMin] = useState(0);
  const [oriented, setOriented] = useRemembered("ciel:oriented", false);
  const compass = useCompass();

  const fetchTargets = useCallback(() => api.targets(), []);
  const targets = useFetch(fetchTargets, [], "targets");
  const fetchBodies = useCallback(() => api.skyBodies(), []);
  const bodies = useFetch(fetchBodies, [], "sky-bodies");
  // La cible choisie peut ne pas etre dans la liste de ce soir : sa fiche
  // donne ses coordonnees.
  const fetchSelected = useCallback(
    () => (selected ? api.targetDetail(selected) : Promise.resolve(null)),
    [selected],
  );
  const selectedDetail = useFetch(fetchSelected, [selected], selected ? `sky-target:${selected}` : undefined);

  const site = state?.site ?? null;
  const fov = state?.binoculars?.fovDeg ?? 6.5;

  const mapTargets: SkyTarget[] = useMemo(() => {
    const rows: TargetRow[] = (targets.data ?? []).slice(0, MAP_TARGETS);
    const list = rows.map((r) => ({ designation: r.designation, raDeg: r.ra * 15, decDeg: r.dec }));
    const sel = selectedDetail.data;
    if (sel && !list.some((t) => t.designation === sel.designation)) {
      list.push({ designation: sel.designation, raDeg: sel.ra * 15, decDeg: sel.dec });
    }
    return list;
  }, [targets.data, selectedDetail.data]);

  const selectedTarget = mapTargets.find((t) => t.designation === selected) ?? null;
  const when = new Date(Date.now() + offsetMin * 60000);
  const selectedPos = selectedTarget && site
    ? altAz(selectedTarget.raDeg, selectedTarget.decDeg, site.lat, lstDeg(when, site.lon))
    : null;

  if (!site || !state) {
    return (
      <div className="nc-screen">
        <p className="nc-caption">Chargement…</p>
      </div>
    );
  }

  const rotation = oriented && compass.heading != null ? compass.heading + 180 : 0;

  return (
    <div className="nc-screen">
      <div className="nc-row nc-between">
        <button onClick={onBack} className="nc-link nc-link-accent">
          <TabIcon name="back" />
          Retour
        </button>
        <NightToggle />
      </div>
      <div>
        <div className="nc-eyebrow">Ciel</div>
        <div className="nc-title">{mode === "carte" ? "Carte du ciel" : "Viseur"}</div>
      </div>

      <div className="nc-segmented" role="radiogroup" aria-label="Vue">
        {(["carte", "viseur"] as const).map((m) => (
          <button
            key={m}
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={mode === m ? "nc-segment nc-segment-active" : "nc-segment"}
          >
            {m === "carte" ? "Carte" : "Viseur"}
          </button>
        ))}
      </div>

      {/* Cible : celle venue de la fiche, ou a choisir parmi celles de ce soir. */}
      <div className="nc-row nc-hscroll">
        {mapTargets.slice(0, 12).map((t) => (
          <button
            key={t.designation}
            onClick={() => setSelected(t.designation === selected ? null : t.designation)}
            className={`nc-chip nc-num nc-none ${t.designation === selected ? "nc-chip-active" : ""}`}
            aria-pressed={t.designation === selected}
          >
            {t.designation}
          </button>
        ))}
      </div>

      {mode === "carte" ? (
        <>
          <SkyDome
            when={when}
            site={site}
            horizon={state.horizon}
            horizonAlt={state.horizonAlt ?? {}}
            rotation={rotation}
            bodies={bodies.data}
            targets={mapTargets}
            selected={selected}
            onSelect={(d) => setSelected(d)}
          />
          <div className="nc-stack-xs">
            <div className="nc-row nc-between">
              <span className="nc-caption nc-num">
                {offsetMin === 0 ? "Maintenant" : `À ${fmtHM(when.toISOString())}`}
              </span>
              {offsetMin !== 0 && (
                <button onClick={() => setOffsetMin(0)} className="nc-link">Maintenant</button>
              )}
            </div>
            <input
              type="range"
              min={0}
              max={8 * 60}
              step={15}
              value={offsetMin}
              onChange={(e) => setOffsetMin(Number(e.target.value))}
              aria-label="Heure affichée"
              className="nc-sky-time"
            />
          </div>
          {compass.heading != null && (
            <button
              onClick={() => setOriented((v) => !v)}
              role="switch"
              aria-checked={oriented}
              className="nc-row nc-between"
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", minHeight: 44, color: "var(--ink)", textAlign: "left" }}
            >
              <span style={{ fontSize: "var(--text-sm)" }}>Tourner avec la boussole (direction regardée en bas)</span>
              <span className={`nc-switch ${oriented ? "nc-switch-on" : ""}`} aria-hidden="true"><span /></span>
            </button>
          )}
          {compass.needsPermission && (
            <button onClick={() => void compass.start()} className="nc-btn">Activer la boussole</button>
          )}
          {selectedTarget && selectedPos && (
            <div className="nc-card nc-row nc-between">
              <span className="nc-num" style={{ fontSize: "var(--text-sm)" }}>
                {selectedTarget.designation} · {Math.round(selectedPos.alt)}° · {sectorOf(selectedPos.az)}
                {selectedPos.alt < 0 && " (sous l'horizon)"}
              </span>
              <span className="nc-row nc-none">
                <button onClick={() => setMode("viseur")} className="nc-chip nc-chip-active">Viser</button>
                <button onClick={() => onOpenTarget(selectedTarget.designation)} className="nc-chip">Fiche</button>
              </span>
            </div>
          )}
          <p className="nc-caption" style={{ margin: 0 }}>
            Tenue au-dessus de la tête : zénith au centre, horizon au bord, est à gauche. Zones grisées : ce
            que cache votre horizon (Réglages). Carrés : cibles de ce soir.
          </p>
        </>
      ) : compass.orientation ? (
        <>
          <SkyViewfinder
            orientation={compass.orientation}
            site={site}
            target={selectedTarget}
            targetLabel={selectedTarget?.designation ?? null}
            fovDeg={fov}
          />
          <p className="nc-caption" style={{ margin: 0 }}>
            Tenez le téléphone contre les jumelles, écran vers vous. La boussole se trompe de quelques degrés :
            dessinez un 8 avec le téléphone pour la calibrer, loin de la voiture. Le chemin d'étoiles de la fiche
            fait les derniers degrés.
          </p>
        </>
      ) : compass.needsPermission ? (
        <button onClick={() => void compass.start()} disabled={compass.state === "asking"} className="nc-btn nc-btn-primary">
          {compass.state === "asking" ? "…" : "Activer l'orientation du téléphone"}
        </button>
      ) : (
        <div className="nc-card nc-stack-xs">
          <p className="nc-caption" style={{ margin: 0 }}>
            {compass.state === "unsupported" || compass.state === "denied"
              ? "Pas de capteur d'orientation utilisable : le viseur a besoin d'un téléphone avec boussole."
              : "En attente des capteurs…"}
          </p>
          {selectedTarget && selectedPos && (
            <p className="nc-num" style={{ margin: 0, fontSize: "var(--text-sm)" }}>
              {selectedTarget.designation} maintenant : hauteur {Math.round(selectedPos.alt)}°, azimut{" "}
              {Math.round(selectedPos.az)}° ({sectorOf(selectedPos.az)}).
            </p>
          )}
        </div>
      )}
    </div>
  );
}
