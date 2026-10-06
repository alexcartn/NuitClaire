import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { isBody } from "../solarSystem";
import { useFetch } from "../useFetch";
import { useRemembered } from "../useRemembered";
import { useCompass } from "../useCompass";
import { useTheme } from "../useTheme";
import { useWatchMode } from "../useWatchMode";
import { fmtHM } from "../format";
import { NightToggle } from "../components/NightToggle";
import { TabIcon } from "../components/TabIcon";
import { SkyDome, type SkyPick, type SkyProjection, type SkyTarget } from "../sky/SkyDome";
import { SkyInfoCard } from "../sky/SkyInfoCard";
import { SkyLegend } from "../sky/SkyLegend";
import { SkySearch, type SkyFound } from "../sky/SkySearch";
import { SkyViewfinder } from "../sky/SkyViewfinder";
import { namedStar } from "../sky/skyNames";
import { altAz, lstDeg, sectorOf } from "../sky/sky";
import type { SkyBodies } from "../sky/types";
import type { AppState, TargetRow } from "../types";

/** Cibles marquees sur la carte : les premieres de la liste de ce soir. Au-
 * dela, la carte devient illisible ; la cible choisie y est toujours. */
const MAP_TARGETS = 30;

/** La Lune avance d'environ 0,55 deg/h sur le ciel : sur une nuit, de quoi
 * la decaler de plusieurs diametres si on ne la fait pas suivre. */
const MOON_RA_RATE = 0.55;

const pad2 = (n: number) => String(n).padStart(2, "0");
/** Valeur d'un champ datetime-local (heure locale, a la minute). */
const toLocalInput = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

/** Carte du ciel (dome ou face a l'horizon) et viseur, pour trouver ses
 * cibles aux jumelles. Calcule sur le telephone (voir sky/sky.ts) : marche
 * hors ligne, une fois la liste de la nuit et la position de la Lune gardees
 * sur l'appareil. */
export default function Ciel({ state, initialTarget, initialMode, onOpenTarget, onBack }: {
  state: AppState | null;
  initialTarget: string | null;
  initialMode: "carte" | "viseur";
  onOpenTarget: (designation: string) => void;
  /** Absent quand la carte est l'onglet lui-meme : rien vers quoi revenir. */
  onBack?: () => void;
}) {
  const [mode, setMode] = useState<"carte" | "viseur">(initialMode);
  const [selected, setSelected] = useState<string | null>(initialTarget);
  const [offsetMin, setOffsetMin] = useState(0);
  // Date choisie (autre nuit) ; null : maintenant.
  const [base, setBase] = useState<Date | null>(null);
  const [picked, setPicked] = useState<SkyPick | null>(null);
  const [full, setFull] = useState(false);
  const [projection, setProjection] = useRemembered<SkyProjection>("ciel:projection", "dome");
  const [showGrid, setShowGrid] = useRemembered("ciel:grid", false);
  const [showConst, setShowConst] = useRemembered("ciel:constellations", true);
  // Le masque d'horizon (arbres, toits) vient de Reglages ; on peut le
  // couper ici pour voir tout le ciel, sans toucher a ce qui y est regle.
  const [showHorizon, setShowHorizon] = useRemembered("ciel:horizon", true);
  const [hlConst, setHlConst] = useState<string | null>(null);
  const [focusReq, setFocusReq] = useState<{ name: string; n: number; raDeg?: number; decDeg?: number } | null>(null);
  const { isNight, toggleNight } = useTheme();
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
  // Jumelles ou oeil nu : le choix fait sur la carte « En attendant le
  // Seestar », qui vaut aussi pour les suggestions et le viseur.
  const [watchMode, setWatchMode] = useWatchMode();
  const eye = watchMode === "oeil";
  // Meme cle que la carte « En attendant le Seestar » : une seule requete.
  const binocularsLabel = state?.binoculars?.label;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchBinoculars = useCallback(() => api.binocularsNow(watchMode), [binocularsLabel, watchMode]);
  const binocularsRes = useFetch(
    fetchBinoculars,
    [binocularsLabel, watchMode],
    eye ? "binoculars-now:oeil" : `binoculars-now:${binocularsLabel ?? ""}`,
  );
  const binoculars = {
    data: binocularsRes.data && (binocularsRes.data.binoculars.label === "œil nu") === eye ? binocularsRes.data : null,
  };
  const fetchBodies = useCallback(() => api.skyBodies(), []);
  const bodiesNow = useFetch(fetchBodies, [], "sky-bodies");
  // A une autre date, la Lune et les planetes y sont redemandees (a l'heure
  // pres) ; hors ligne, elles manquent plutot que d'etre fausses.
  const baseHour = base ? new Date(Math.floor(base.getTime() / 3600000) * 3600000).toISOString() : null;
  const fetchBodiesAt = useCallback(
    () => (baseHour ? api.skyBodies(baseHour) : Promise.resolve(null)),
    [baseHour],
  );
  const bodiesAt = useFetch(fetchBodiesAt, [baseHour]);
  const bodiesRaw: SkyBodies | null = base ? bodiesAt.data : bodiesNow.data;

  // La cible choisie peut ne pas etre dans la liste de ce soir : sa fiche
  // donne ses coordonnees. La Lune, les planetes et les etoiles nommees n'ont
  // pas de fiche catalogue : leur position est deja sur le telephone.
  const localOnly = selected != null && (isBody(selected) || namedStar(selected) != null);
  const fetchSelected = useCallback(
    () => (selected && !localOnly ? api.targetDetail(selected) : Promise.resolve(null)),
    [selected, localOnly],
  );
  const selectedDetail = useFetch(fetchSelected, [selected], selected && !localOnly ? `sky-target:${selected}` : undefined);

  const site = state?.site ?? null;
  const fov = state?.binoculars?.fovDeg ?? 6.5;

  const now = Date.now();
  const when = new Date((base?.getTime() ?? now) + offsetMin * 60000);
  const isNow = !base && offsetMin === 0;
  const whenMinute = Math.floor(when.getTime() / 60000);

  // La Lune suit l'heure affichee au lieu de rester ou elle etait au
  // chargement.
  const bodies: SkyBodies | null = useMemo(() => {
    if (!bodiesRaw) return null;
    const hours = (whenMinute * 60000 - new Date(bodiesRaw.time).getTime()) / 3600000;
    return { ...bodiesRaw, moon: { ...bodiesRaw.moon, raDeg: bodiesRaw.moon.raDeg + MOON_RA_RATE * hours } };
  }, [bodiesRaw, whenMinute]);

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
    if (sel && sel.designation === selected && !list.some((t) => t.designation === sel.designation)) {
      list.push({ designation: sel.designation, raDeg: sel.ra * 15, decDeg: sel.dec, kind: sel.typeCode || sel.type });
    }
    // Une cible de la liste complete (au-dela des 30 marquees).
    const row = (targets.data ?? []).find((r) => r.designation === selected);
    if (row && !list.some((t) => t.designation === row.designation)) {
      list.push({ designation: row.designation, raDeg: row.ra * 15, decDeg: row.dec, kind: row.typeCode || row.type });
    }
    if (selected && isBody(selected) && bodies) {
      const b = selected === "Lune" ? bodies.moon : bodies.planets.find((p) => p.name === selected);
      if (b) list.push({ designation: selected, raDeg: b.raDeg, decDeg: b.decDeg });
    }
    const star = namedStar(selected);
    if (star) list.push({ designation: star.name, raDeg: star.raDeg, decDeg: star.decDeg, kind: "étoile" });
    return list;
  }, [targets.data, binoculars.data, selectedDetail.data, selected, bodies]);

  const selectedTarget = mapTargets.find((t) => t.designation === selected) ?? null;

  // Centrer la carte sur ce qu'on vient de chercher, des que sa position
  // est connue (une cible du catalogue arrive avec sa fiche).
  const focusAt = focusReq
    ? focusReq.raDeg != null && focusReq.decDeg != null
      ? { raDeg: focusReq.raDeg, decDeg: focusReq.decDeg }
      : mapTargets.find((t) => t.designation === focusReq.name) ?? null
    : null;
  const focus = focusReq && focusAt ? { raDeg: focusAt.raDeg, decDeg: focusAt.decDeg, n: focusReq.n } : null;

  const onFound = (f: SkyFound) => {
    setPicked(null);
    if (f.constellation) {
      setHlConst(f.constellation.id ?? null);
      setFocusReq((r) => ({ name: f.name, n: (r?.n ?? 0) + 1, ...f.constellation }));
      return;
    }
    setSelected(f.name);
    setFocusReq((r) => ({ name: f.name, n: (r?.n ?? 0) + 1 }));
  };

  if (!site || !state) {
    return (
      <div className="nc-screen">
        <p className="nc-caption">Chargement…</p>
      </div>
    );
  }

  const horizonView = projection === "horizon";
  const OPEN_SECTORS = { N: true, NE: true, E: true, SE: true, S: true, SW: true, W: true, NW: true };
  const skyHorizon = showHorizon ? state.horizon : OPEN_SECTORS;
  const skyHorizonAlt = showHorizon ? (state.horizonAlt ?? {}) : {};
  const heading = oriented && compass.heading != null ? compass.heading : null;
  const rotation = heading != null ? heading + 180 : 0;

  // Fiche de ce qu'on a touche : un astre nomme devient la selection ; une
  // etoile sans nom se decrit seulement.
  const info = (() => {
    if (picked) {
      return { name: picked.name, detail: picked.detail, raDeg: picked.raDeg, decDeg: picked.decDeg, raRate: 0, aim: false, fiche: false };
    }
    if (!selectedTarget) return null;
    const d = selectedTarget.designation;
    const star = namedStar(d);
    let detail = "";
    if (d === "Lune" && bodies) detail = `éclairée à ${Math.round(bodies.moon.illum)} %`;
    else if (isBody(d)) {
      const pl = bodies?.planets.find((p) => p.name === d);
      detail = pl ? `magnitude ${pl.mag.toFixed(1).replace(".", ",")}` : "planète";
    } else if (star) detail = `étoile, magnitude ${(star.mag ?? 0).toFixed(1).replace(".", ",")}`;
    else {
      const row = (targets.data ?? []).find((r) => r.designation === d) ?? selectedDetail.data;
      detail = row ? row.commonName || row.type : "";
    }
    return {
      name: d, detail, raDeg: selectedTarget.raDeg, decDeg: selectedTarget.decDeg,
      raRate: d === "Lune" ? MOON_RA_RATE : 0, aim: true, fiche: !star,
    };
  })();

  const whenLabel = isNow
    ? "Maintenant"
    : base
      ? `${when.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })} à ${fmtHM(when.toISOString())}`
      : `À ${fmtHM(when.toISOString())}`;
  const tickBase = base?.getTime() ?? now;

  // Vue et options : sous la carte ; en plein ecran, en haut avec la
  // recherche, pour laisser le bas a l'heure et a la fiche.
  const optionsRow = (
    <div className="nc-sky-options" role="group" aria-label="Affichage">
      <div className="nc-segmented nc-sky-projection" role="radiogroup" aria-label="Projection">
        {(["dome", "horizon"] as const).map((p) => (
          <button
            key={p}
            role="radio"
            aria-checked={projection === p}
            onClick={() => setProjection(p)}
            className={projection === p ? "nc-segment nc-segment-active" : "nc-segment"}
          >
            {p === "dome" ? "Dôme" : "Horizon"}
          </button>
        ))}
      </div>
      <div className="nc-sky-toggles">
        {([
          ["Grille", showGrid, setShowGrid],
          ["Constellations", showConst, setShowConst],
          ["Horizon dégagé", showHorizon, setShowHorizon],
        ] as const).map(([label, on, set]) => (
          <button
            key={label}
            onClick={() => set((v: boolean) => !v)}
            role="switch"
            aria-checked={on}
            className="nc-sky-toggle"
          >
            <span>{label}</span>
            <span className={`nc-switch ${on ? "nc-switch-on" : ""}`} aria-hidden="true"><span /></span>
          </button>
        ))}
      </div>
    </div>
  );


  // Rappel des cibles faciles en ce moment (celles de « En attendant le
  // Seestar ») : un appui la montre sur la carte ou la vise, donc utile aussi
  // dans le viseur.
  const pickChips =
    (binoculars.data?.picks.length ?? 0) > 0 && (
    <div className="nc-stack-xs">
      <span className="nc-caption">Faciles {eye ? "à l'œil nu" : "aux jumelles"} {binoculars.data!.at}</span>
      <div className="nc-row nc-hscroll">
        {binoculars.data!.picks.map((p) => (
          <button
            key={p.designation}
            onClick={() => { setPicked(null); setSelected(p.designation === selected ? null : p.designation); }}
            className={`nc-chip nc-none ${p.designation === selected ? "nc-chip-active" : ""}`}
            aria-pressed={p.designation === selected}
          >
            <span className="nc-num">{p.designation}</span>
            {p.name ? ` · ${p.name}` : ""}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="nc-screen">
      {/* Une seule ligne de commandes : la carte passe avant tout le reste. */}
      <div className="nc-row" style={{ gap: "var(--space-sm)" }}>
        {onBack && (
          <button onClick={onBack} className="nc-link nc-link-accent nc-none" aria-label="Retour">
            <TabIcon name="back" />
            Retour
          </button>
        )}
        <div className="nc-segmented nc-grow nc-sky-mode" role="radiogroup" aria-label="Vue">
          {(["carte", "viseur"] as const).map((m) => (
            <button
              key={m}
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={mode === m ? "nc-segment nc-segment-active" : "nc-segment"}
            >
              {m === "carte" ? "Carte du ciel" : "Viseur"}
            </button>
          ))}
        </div>
        <NightToggle />
      </div>

      {mode === "carte" ? (
        <>
          {/* Plein ecran : la carte seule, les commandes par-dessus. */}
          <div className={full ? "nc-sky-full" : "nc-stack"}>
            <div className={full ? "nc-stack-xs nc-sky-full-top" : "nc-stack-xs"}>
              {full && (
                <div className="nc-row nc-between">
                  <span className="nc-eyebrow">Carte du ciel</span>
                  <span className="nc-row nc-none" style={{ gap: "var(--space-sm)" }}>
                    {/* Tout au rouge d'un appui, sans quitter la carte. */}
                    <button onClick={toggleNight} className="nc-link" aria-pressed={isNight}>
                      {isNight ? "Couleurs" : "Rouge"}
                    </button>
                    <button onClick={() => setFull(false)} className="nc-link nc-link-accent">Fermer</button>
                  </span>
                </div>
              )}
              <div className="nc-row" style={{ alignItems: "flex-start", gap: "var(--space-xs)" }}>
                <div className="nc-grow" style={{ minWidth: 0 }}>
                  <SkySearch targets={targets.data ?? []} onChoose={onFound} />
                </div>
                {!full && (
                  <button onClick={() => setFull(true)} className="nc-round-btn nc-none" aria-label="Plein écran" title="Plein écran">
                    <TabIcon name="expand" />
                  </button>
                )}
              </div>
              {full && optionsRow}
            </div>
            <SkyDome
              when={when}
              site={site}
              horizon={skyHorizon}
              horizonAlt={skyHorizonAlt}
              projection={projection}
              rotation={rotation}
              heading={heading}
              bodies={bodies}
              targets={mapTargets}
              selected={selected}
              showGrid={showGrid}
              showConstellations={showConst}
              highlightConstellation={hlConst}
              onConstellation={setHlConst}
              focus={focus}
              onSelect={(d) => setSelected(d)}
              onPick={(p) => {
                // Lune, planete, etoile nommee : elles deviennent la
                // selection (on peut les viser) ; une etoile anonyme se
                // decrit seulement.
                if (p && p.kind !== "cible" && p.name !== "Étoile") {
                  setSelected(p.name);
                  setPicked(null);
                } else {
                  setPicked(p && p.kind !== "cible" ? p : null);
                }
              }}
            />
            {/* En plein ecran, l'heure et la fiche flottent sur le bas de la
                carte au lieu de lui prendre de la hauteur. */}
            <div className={full ? "nc-stack-xs nc-sky-full-bottom" : "nc-stack"}>
              {!full && optionsRow}
              {!full && pickChips}
              <div className="nc-stack-xs">
                <div className="nc-row nc-between">
                  <span className="nc-caption nc-num">{whenLabel}</span>
                  <span className="nc-row nc-none" style={{ gap: "var(--space-sm)" }}>
                    <button onClick={() => { if (offsetMin >= 8 * 60) setOffsetMin(0); setPlaying((v) => !v); }} className="nc-link nc-link-accent"
                      aria-label={playing ? "Arrêter la lecture" : "Faire tourner le ciel"}>
                      {playing ? "❚❚ Pause" : "▶ Lecture"}
                    </button>
                    {!isNow && (
                      <button onClick={() => { setPlaying(false); setOffsetMin(0); setBase(null); }} className="nc-link">Maintenant</button>
                    )}
                    {/* Une autre nuit : le champ de date natif du telephone,
                        pose invisible sur le lien. */}
                    <label className="nc-link nc-sky-date">
                      Date
                      <input
                        type="datetime-local"
                        value={toLocalInput(base ?? new Date(now))}
                        onChange={(e) => {
                          const d = new Date(e.target.value);
                          if (Number.isNaN(d.getTime())) return;
                          setPlaying(false);
                          setOffsetMin(0);
                          setBase(d);
                        }}
                        aria-label="Afficher le ciel à une autre date"
                      />
                    </label>
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
                    const t = new Date(tickBase + i * 3_600_000);
                    return <span key={i}>{i === 0 && !base ? "maint." : `${pad2(t.getHours())}h`}</span>;
                  })}
                </div>
                {base && !bodies && !bodiesAt.loading && (
                  <span className="nc-caption">Lune et planètes indisponibles hors ligne à une autre date.</span>
                )}
              </div>
              {info && (
                <SkyInfoCard
                  name={info.name}
                  detail={info.detail}
                  raDeg={info.raDeg}
                  decDeg={info.decDeg}
                  raRate={info.raRate}
                  when={when}
                  isNow={isNow}
                  site={site}
                  horizon={skyHorizon}
                  horizonAlt={skyHorizonAlt}
                  compact={full}
                  onAim={info.aim ? () => { setFull(false); setMode("viseur"); } : undefined}
                  onFiche={info.fiche ? () => onOpenTarget(info.name) : undefined}
                />
              )}
            </div>
          </div>
          {compass.heading != null && (
            <button
              onClick={() => setOriented((v) => !v)}
              role="switch"
              aria-checked={oriented}
              className="nc-row nc-between"
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", minHeight: 44, color: "var(--ink)", textAlign: "left" }}
            >
              <span style={{ fontSize: "var(--text-sm)" }}>
                {horizonView ? "Suivre la boussole (la vue tourne avec le téléphone)" : "Tourner avec la boussole (direction regardée en bas)"}
              </span>
              <span className={`nc-switch ${oriented ? "nc-switch-on" : ""}`} aria-hidden="true"><span /></span>
            </button>
          )}
          {compass.needsPermission && (
            <button onClick={() => void compass.start()} className="nc-btn">Activer la boussole</button>
          )}
          <SkyLegend />
          {/* Repliee : utile la premiere fois, encombrante ensuite. */}
          <details className="nc-caption">
            <summary style={{ cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center" }}>Lire la carte</summary>
            <p style={{ margin: 0 }}>
              Dôme : la carte tenue au-dessus de la tête, zénith au centre, horizon au bord, est à gauche. Horizon : le
              ciel tel qu'on le voit debout, face à une direction ; glissez pour tourner la tête et lever les yeux. En
              ombre, la cime de vos arbres et toits ; hachuré, un secteur bouché (Réglages). Pincez pour zoomer,
              touchez un astre pour savoir quand il se lève, passe au plus haut et sort des arbres ; une flèche au bord
              montre où est la cible choisie. Double-appui pour revenir à la vue entière.
            </p>
          </details>
        </>
      ) : compass.orientation ? (
        <>
          <div className="nc-segmented nc-sky-mode" role="radiogroup" aria-label="Regarder">
            {(["jumelles", "oeil"] as const).map((m) => (
              <button
                key={m}
                role="radio"
                aria-checked={watchMode === m}
                onClick={() => setWatchMode(m)}
                className={watchMode === m ? "nc-segment nc-segment-active" : "nc-segment"}
              >
                {m === "jumelles" ? "Jumelles" : "Œil nu"}
              </button>
            ))}
          </div>
          {pickChips}
          <SkyViewfinder
            naked={eye}
            orientation={compass.orientation}
            site={site}
            target={selectedTarget}
            targetLabel={selectedTarget?.designation ?? null}
            targetKind={selectedTarget?.kind}
            fovDeg={fov}
            horizon={skyHorizon}
            horizonAlt={skyHorizonAlt}
            bodies={bodiesNow.data}
          />
          <div className="nc-sky-toggles" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
            <button onClick={() => setShowHorizon((v) => !v)} role="switch" aria-checked={showHorizon} className="nc-sky-toggle" style={{ flexDirection: "row", alignItems: "center" }}>
              <span>Horizon dégagé (arbres et toits de Réglages)</span>
              <span className={`nc-switch ${showHorizon ? "nc-switch-on" : ""}`} aria-hidden="true"><span /></span>
            </button>
          </div>
          {/* Repliee : utile la premiere fois, encombrante ensuite. */}
          <details className="nc-caption">
            <summary style={{ cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center" }}>Lire le viseur</summary>
          <p style={{ margin: 0 }}>
            {eye
              ? "Levez le téléphone vers le ciel, écran vers vous : la vue montre ce qui est derrière lui, et nomme étoiles et planètes. Baissez-le pour regarder, votre œil fait le reste. "
              : "Tenez le téléphone contre les jumelles, écran vers vous. "}
            La boussole se trompe de quelques degrés : dessinez un 8 avec le téléphone pour la calibrer, loin de la
            voiture.{eye ? "" : " Le chemin d'étoiles de la fiche fait les derniers degrés."}
          </p>
          </details>
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
          {selectedTarget && (() => {
            const p = altAz(selectedTarget.raDeg, selectedTarget.decDeg, site.lat, lstDeg(new Date(), site.lon));
            return (
              <p className="nc-num" style={{ margin: 0, fontSize: "var(--text-sm)" }}>
                {selectedTarget.designation} maintenant : hauteur {Math.round(p.alt)}°, azimut{" "}
                {Math.round(p.az)}° ({sectorOf(p.az)}).
              </p>
            );
          })()}
        </div>
      )}
    </div>
  );
}
