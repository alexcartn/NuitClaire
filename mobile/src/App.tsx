import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { api, UNAUTHORIZED_EVENT } from "./api";
import { useFetch } from "./useFetch";
import { applyUpdate, usePwa } from "./pwa";
import { readCache, readText, writeText } from "./storage";
import { windowLabel } from "./format";
import { remember } from "./useRemembered";
import { autoNightAction } from "./autoNight";
import { autoEnterNight, autoLeaveNight, useTheme } from "./useTheme";
import type { Night, Screen } from "./types";
import { TabBar } from "./components/TabBar";
import { TokenGate } from "./components/TokenGate";
import { CeSoir } from "./screens/CeSoir";
import { Cibles } from "./screens/Cibles";
import { Detail } from "./screens/Detail";
import { Messier } from "./screens/Messier";
import { Recherche } from "./screens/Recherche";
import { Reglages } from "./screens/Reglages";
import { Journal } from "./screens/Journal";

// Carte du ciel et viseur : charges a la demande (catalogue d'etoiles
// compris), pour ne pas alourdir l'ouverture de l'appli. Le service worker
// met ce morceau en cache comme le reste : il marche hors ligne.
const Ciel = lazy(() => import("./screens/Ciel"));

const SCREENS: Screen[] = ["soir", "cibles", "messier", "journal", "reglages"];

/** Ou l'on est, et comment on y est arrive. Pose tel quel dans
 * `history.state` : le bouton retour d'Android (ou le geste retour d'iOS)
 * rejoue ces etats au lieu de fermer l'appli.
 *
 * `depth` compte les entrees d'historique empilees par l'appli au-dessus de
 * la premiere : 0 sur "Ce soir", 1 sur un autre onglet, +1 par fiche ou
 * recherche ouverte. C'est ce qui permet de revenir a "Ce soir" depuis
 * n'importe ou sans empiler des onglets a l'infini. */
interface Nav {
  screen: Screen;
  selected: string | null;
  backTo: Screen;
  depth: number;
  /** Ecran Ciel : carte ou viseur. */
  skyMode?: "carte" | "viseur";
}

/** Ecran d'ouverture : "soir" par defaut, ou celui demande par l'URL. Sert
 * au raccourci "Journal" du manifeste (appui long sur l'icone de l'appli
 * installee) : la nuit commence en general par une note, pas par la meteo. */
function initialNav(): Nav {
  let screen: Screen = "soir";
  try {
    const asked = new URLSearchParams(window.location.search).get("ecran");
    if (SCREENS.includes(asked as Screen)) screen = asked as Screen;
  } catch {
    /* URL illisible : ecran par defaut */
  }
  return { screen, selected: null, backTo: screen, depth: 0 };
}

function isNav(value: unknown): value is Nav {
  return typeof value === "object" && value !== null && "screen" in value && "depth" in value;
}

/** Cle de position de defilement : une par onglet, une par fiche. */
function scrollKey(nav: Nav): string {
  return nav.screen === "detail" ? `detail:${nav.selected}` : nav.screen;
}

const AUTO_DONE_KEY = "nc-night-auto-done";

/** Passage automatique en vision nocturne a la nuit tombee (voir
 * autoNight.ts), verifie chaque minute et au retour au premier plan. */
function useAutoNight(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const check = () => {
      const action = autoNightAction(readCache<Night>("night"), new Date(), readText(AUTO_DONE_KEY));
      if (action === "enter") {
        autoEnterNight();
        writeText(AUTO_DONE_KEY, readCache<Night>("night")?.date ?? null);
      } else if (action === "leave") {
        autoLeaveNight();
      }
    };
    check();
    const timer = window.setInterval(check, 60_000);
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled]);
}

export default function App() {
  const [nav, setNav] = useState<Nav>(initialNav);
  const navRef = useRef(nav);
  navRef.current = nav;
  const { updateReady } = usePwa();
  const { auto } = useTheme();
  useAutoNight(auto);

  const [needToken, setNeedToken] = useState(false);
  useEffect(() => {
    const onUnauthorized = () => setNeedToken(true);
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  // Position de defilement par ecran. Revenir d'une fiche ramenait en haut
  // d'une liste de cinquante cibles.
  const scroller = useRef<HTMLDivElement>(null);
  /** Onglet a appliquer une fois l'historique rembobine (voir changeTab). */
  const pendingTab = useRef<Nav | null>(null);
  const positions = useRef(new Map<string, number>());
  const saveScroll = () => {
    if (scroller.current) positions.current.set(scrollKey(navRef.current), scroller.current.scrollTop);
  };

  useEffect(() => {
    window.history.replaceState(navRef.current, "");
    const onPop = (e: PopStateEvent) => {
      if (!isNav(e.state)) return;
      saveScroll();
      const pending = pendingTab.current;
      pendingTab.current = null;
      if (pending) {
        window.history.replaceState(pending, "");
        setNav(pending);
      } else {
        setNav(e.state);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Le contenu arrive parfois un instant apres l'ecran (copie locale lue dans
  // un effet) : tant que la page n'est pas assez haute, on retente a
  // l'image suivante, sans insister au-dela d'une demi-seconde.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const target = positions.current.get(scrollKey(nav)) ?? 0;
    let frames = 0;
    let raf = 0;
    const apply = () => {
      el.scrollTop = target;
      if (Math.abs(el.scrollTop - target) > 2 && frames++ < 30) raf = requestAnimationFrame(apply);
    };
    apply();
    return () => cancelAnimationFrame(raf);
  }, [nav]);

  const push = (next: Nav) => {
    saveScroll();
    positions.current.delete(scrollKey(next));
    window.history.pushState(next, "");
    setNav(next);
  };
  const replace = (next: Nav) => {
    saveScroll();
    window.history.replaceState(next, "");
    setNav(next);
  };

  const changeTab = (tab: Screen) => {
    const current = navRef.current;
    if (tab === current.screen) {
      // Toucher l'onglet courant remonte en haut, comme ailleurs sur mobile.
      scroller.current?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const next: Nav = { screen: tab, selected: null, backTo: tab, depth: tab === "soir" ? 0 : 1 };
    if (current.depth > next.depth) {
      // Depuis une fiche ou un autre onglet : on rembobine l'historique
      // jusqu'au bon niveau, pour que « retour » ne fasse pas revisiter
      // chaque ecran traverse.
      saveScroll();
      pendingTab.current = next;
      window.history.go(next.depth - current.depth);
    } else if (current.depth === next.depth) {
      replace(next);
    } else {
      push(next);
    }
  };

  const openTarget = (designation: string) => {
    const current = navRef.current;
    push({
      screen: "detail",
      selected: designation,
      backTo: current.screen === "detail" || current.screen === "recherche" ? current.backTo : current.screen,
      depth: current.depth + 1,
    });
  };

  const openSky = (designation: string | null, mode: "carte" | "viseur") => {
    const current = navRef.current;
    push({
      screen: "ciel",
      selected: designation,
      skyMode: mode,
      backTo: current.screen === "detail" || current.screen === "recherche" ? current.backTo : current.screen,
      depth: current.depth + 1,
    });
  };

  const openSearch = () => {
    const current = navRef.current;
    push({ screen: "recherche", selected: null, backTo: current.screen, depth: current.depth + 1 });
  };

  const back = () => {
    const current = navRef.current;
    if (current.depth > 0) window.history.back();
    else replace({ screen: "soir", selected: null, backTo: "soir", depth: 0 });
  };

  const fetchState = useCallback(() => api.state(), []);
  const { data: state, reload: reloadState } = useFetch(fetchState, [], "state");
  // Aux jumelles, l'objectif Messier est visuel : « vu », pas « capture ».
  const instrument = state?.instrument ?? "seestar";
  const captured = new Set((instrument === "jumelles" ? state?.messierSeen : state?.messierCaptured) ?? []);

  const { screen, selected } = nav;

  return (
    <div className="nc-app">
      {updateReady && (
        // Proposee, jamais imposee : recharger en pleine saisie ferait
        // perdre la note en cours de frappe (voir pwa.ts).
        <div className="nc-update">
          <span>Nouvelle version disponible.</span>
          <button onClick={applyUpdate} className="nc-chip nc-chip-active">
            Recharger
          </button>
        </div>
      )}
      {needToken && <TokenGate />}
      <div ref={scroller} className="nc-scroll" style={{ flex: 1, overflow: "auto" }}>
        {screen === "soir" && (
          <CeSoir
            instrument={instrument}
            onGoTargets={() => changeTab("cibles")}
            onSearch={openSearch}
            onOpenSky={() => openSky(null, "carte")}
            onOpenTarget={openTarget}
          />
        )}
        {screen === "cibles" && (
          <Cibles
            captured={captured}
            instrument={instrument}
            binocularsLabel={state?.binoculars?.label}
            onInstrumentChange={reloadState}
            windowLabel={windowLabel(state?.windowMode, state?.viewWindow)}
            onOpenTarget={openTarget}
          />
        )}
        {screen === "detail" && selected && (
          <Detail
            designation={selected}
            captured={captured}
            instrument={instrument}
            horizon={state?.horizon}
            horizonAlt={state?.horizonAlt}
            onOpenSky={(mode) => openSky(selected, mode)}
            windowMode={state?.windowMode}
            viewWindow={state?.viewWindow}
            onBack={back}
            onCaptureChange={reloadState}
          />
        )}
        {screen === "messier" && (
          <Messier
            captured={captured}
            instrument={instrument}
            binocularsLabel={state?.binoculars?.label}
            onInstrumentChange={reloadState}
            onOpenTarget={openTarget}
          />
        )}
        {screen === "journal" && <Journal instrument={instrument} onOpenTarget={openTarget} onCaptureChange={reloadState} />}
        {screen === "ciel" && (
          <Suspense fallback={<div className="nc-screen"><p className="nc-caption">Chargement de la carte…</p></div>}>
            <Ciel
              state={state}
              initialTarget={selected}
              initialMode={nav.skyMode ?? "carte"}
              onOpenTarget={openTarget}
              onBack={back}
            />
          </Suspense>
        )}
        {screen === "recherche" && (
          <Recherche
            onOpenTarget={openTarget}
            onBrowseType={(type) => {
              // « Cibles » s'ouvre deja filtree (voir useRemembered).
              remember("cibles:types", [type]);
              remember("cibles:hour", null);
              changeTab("cibles");
            }}
            onCancel={back}
          />
        )}
        {screen === "reglages" && <Reglages onChange={reloadState} />}
      </div>
      <TabBar
        active={screen === "detail" || screen === "recherche" || screen === "ciel" ? nav.backTo : screen}
        onChange={changeTab}
      />
    </div>
  );
}
