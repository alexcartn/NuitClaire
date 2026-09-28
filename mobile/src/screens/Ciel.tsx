import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { isBody } from "../solarSystem";
import { useFetch } from "../useFetch";
import { useRemembered } from "../useRemembered";
import { useCompass } from "../useCompass";
import { fmtHM } from "../format";
import { NightToggle } from "../components/NightToggle";
import { TabIcon } from "../components/TabIcon";
import { SkyDome, type SkyPick, type SkyTarget } from "../sky/SkyDome";
import { SkyLegend } from "../sky/SkyLegend";
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
  const [picked, setPicked] = useState<SkyPick | null>(null);
  const [full, setFull] = useState(false);
  // Plein ecran du navigateur en plus (barre d'adresse et barre d'etat
  // masquees) quand il le permet ; sinon (iPhone dans Safari) la carte
  // couvre seulement la page. Quitter par le geste retour ou Echap referme.
  useEffect(() => {
    if (!full) return;
    const root = document.documentElement;
    if (!document.fullscreenElement && root.requestFullscreen) {
      root.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
    }
    let entered = false;
    const onChange = () => {
      if (document.fullscreenElement) entered = true;
      else if (entered) setFull(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [full]);
  const [playing, setPlaying] = useState(false);
  // Lecture : le ciel tourne, un quart d'heure toutes les 120 ms, jusqu'au
  // bout de la nuit.
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setOffsetMin((m) => {
        if (m >= 8 * 60) {
          setPlaying(false);
          return m;
        }
        return m + 15;
      });
    }, 120);
    return () => window.clearInterval(id);
  }, [playing]);
  const [oriented, setOriented] = useRemembered("ciel:oriented", false);
  const compass = useCompass();

  const fetchTargets = useCallback(() => api.targets(), []);
  const targets = useFetch(fetchTargets, [], "targets");
  // Meme cle que la carte « En attendant le Seestar » : une seule requete.
  const binocularsLabel = state?.binoculars?.label;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchBinoculars = useCallback(() => api.binocularsNow(), [binocularsLabel]);
  const binoculars = useFetch(fetchBinoculars, [binocularsLabel], `binoculars-now:${binocularsLabel ?? ""}`);
  const fetchBodies = useCallback(() => api.skyBodies(), []);
  const bodies = useFetch(fetchBodies, [], "sky-bodies");
  // La cible choisie peut ne pas etre dans la liste de ce soir : sa fiche
  // donne ses coordonnees.
  // La Lune et les planetes n'ont pas de fiche catalogue : leur position
  // vient de `bodies`, deja chargees pour les dessiner.
  const fetchSelected = useCallback(
    () => (selected && !isBody(selected) ? api.targetDetail(selected) : Promise.resolve(null)),
    [selected],
  );
  const selectedDetail = useFetch(fetchSelected, [selected], selected ? `sky-target:${selected}` : undefined);

  const site = state?.site ?? null;
  const fov = state?.binoculars?.fovDeg ?? 6.5;

  const mapTargets: SkyTarget[] = useMemo(() => {
    const rows: TargetRow[] = (targets.data ?? []).slice(0, MAP_TARGETS);
    const list: SkyTarget[] = rows.map((r) => ({ designation: r.designation, raDeg: r.ra * 15, decDeg: r.dec, kind: r.typeCode || r.type }));
    // Les cibles jumelles des boutons, meme hors de la liste Seestar.
    for (const p of binoculars.data?.picks ?? []) {
      if (!list.some((t) => t.designation === p.designation)) {
        list.push({ designation: p.designation, raDeg: p.raDeg, decDeg: p.decDeg, kind: p.type });
      }
    }
    const sel = selectedDetail.data;
    if (sel && !list.some((t) => t.designation === sel.designation)) {
      list.push({ designation: sel.designation, raDeg: sel.ra * 15, decDeg: sel.dec, kind: sel.typeCode || sel.type });
    }
    if (selected && isBody(selected) && bodies.data) {
      const b = selected === "Lune" ? bodies.data.moon : bodies.data.planets.find((p) => p.name === selected);
      if (b) list.push({ designation: selected, raDeg: b.raDeg, decDeg: b.decDeg });
    }
    return list;
  }, [targets.data, binoculars.data, selectedDetail.data, selected, bodies.data]);

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

      {/* Rappel des cibles faciles aux jumelles en ce moment (celles de
          « En attendant le Seestar ») : un appui la montre sur la carte ou
          la vise. */}
      {(binoculars.data?.picks.length ?? 0) > 0 && (
        <div className="nc-stack-xs">
          <span className="nc-caption">Faciles aux jumelles {binoculars.data!.at}</span>
          <div className="nc-row nc-hscroll">
            {binoculars.data!.picks.map((p) => (
              <button
                key={p.designation}
                onClick={() => setSelected(p.designation === selected ? null : p.designation)}
                className={`nc-chip nc-none ${p.designation === selected ? "nc-chip-active" : ""}`}
                aria-pressed={p.designation === selected}
              >
                <span className="nc-num">{p.designation}</span>
                {p.name ? ` · ${p.name}` : ""}
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === "carte" ? (
        <>
          {/* Plein ecran : la carte et l'heure seules, par-dessus tout. */}
          <div className={full ? "nc-sky-full" : "nc-stack"}>
            {full && (
              <div className="nc-row nc-between">
                <span className="nc-eyebrow">Carte du ciel</span>
                <button onClick={() => setFull(false)} className="nc-link nc-link-accent">Fermer</button>
              </div>
            )}
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
              onPick={setPicked}
            />
            <div className="nc-stack-xs">
              <div className="nc-row nc-between">
                <span className="nc-caption nc-num">
                  {offsetMin === 0 ? "Maintenant" : `À ${fmtHM(when.toISOString())}`}
                </span>
                <span className="nc-row nc-none" style={{ gap: "var(--space-xs)" }}>
                  <button onClick={() => { if (offsetMin >= 8 * 60) setOffsetMin(0); setPlaying((v) => !v); }} className="nc-link nc-link-accent"
                    aria-label={playing ? "Arrêter la lecture" : "Faire tourner le ciel"}>
                    {playing ? "❚❚ Pause" : "▶ Lecture"}
                  </button>
                  {offsetMin !== 0 && (
                    <button onClick={() => { setPlaying(false); setOffsetMin(0); }} className="nc-link">Maintenant</button>
                  )}
                  {!full && (
                    <button onClick={() => setFull(true)} className="nc-link nc-link-accent">Plein écran</button>
                  )}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={8 * 60}
                step={15}
                value={offsetMin}
                onChange={(e) => { setPlaying(false); setOffsetMin(Number(e.target.value)); }}
                aria-label="Heure affichée"
                className="nc-sky-time"
              />
              {/* Un repere par heure pleine sous le curseur. */}
              <div className="nc-sky-ticks nc-num" aria-hidden="true">
                {Array.from({ length: 9 }, (_, i) => {
                  const t = new Date(Date.now() + i * 3_600_000);
                  return <span key={i}>{i === 0 ? "maint." : `${String(t.getHours()).padStart(2, "0")}h`}</span>;
                })}
              </div>
            </div>
            {picked && picked.kind !== "cible" && (
              <div className="nc-card nc-row nc-between">
                <span style={{ fontSize: "var(--text-sm)" }}>
                  <strong style={{ fontWeight: 600 }}>{picked.name}</strong>
                  <span className="nc-caption nc-num"> · {picked.detail} · {Math.round(picked.alt)}° · {sectorOf(picked.az)}</span>
                </span>
                {(picked.kind === "planete" || picked.kind === "lune") && (
                  <button onClick={() => onOpenTarget(picked.name)} className="nc-chip nc-none">Fiche</button>
                )}
              </div>
            )}
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
          <SkyLegend />
          {/* Repliee : utile la premiere fois, encombrante ensuite. */}
          <details className="nc-caption">
            <summary style={{ cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center" }}>Lire la carte</summary>
            <p style={{ margin: 0 }}>
              Tenue au-dessus de la tête : zénith au centre, horizon au bord, est à gauche. En ombre, la cime de
              vos arbres et toits ; hachuré, un secteur bouché (Réglages). Pincez pour zoomer, glissez pour vous
              déplacer, touchez une étoile ou une planète pour la nommer ; double-appui pour revenir à la vue
              entière.
            </p>
          </details>
        </>
      ) : compass.orientation ? (
        <>
          <SkyViewfinder
            orientation={compass.orientation}
            site={site}
            target={selectedTarget}
            targetLabel={selectedTarget?.designation ?? null}
            targetKind={selectedTarget?.kind}
            fovDeg={fov}
            horizon={state.horizon}
            horizonAlt={state.horizonAlt ?? {}}
            bodies={bodies.data}
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
