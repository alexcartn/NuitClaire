import { useCallback, useState } from "react";
import { api } from "./api";
import { useFetch } from "./useFetch";
import { applyUpdate, usePwa } from "./pwa";
import type { Screen } from "./types";
import { TabBar } from "./components/TabBar";
import { CeSoir } from "./screens/CeSoir";
import { Cibles } from "./screens/Cibles";
import { Detail } from "./screens/Detail";
import { Messier } from "./screens/Messier";
import { Recherche } from "./screens/Recherche";
import { Reglages } from "./screens/Reglages";
import { Journal } from "./screens/Journal";

const SCREENS: Screen[] = ["soir", "cibles", "messier", "journal", "reglages"];

/** Ecran d'ouverture : "soir" par defaut, ou celui demande par l'URL. Sert
 * au raccourci "Journal" du manifeste (appui long sur l'icone de l'appli
 * installee) : la nuit commence en general par une note, pas par la meteo. */
function initialScreen(): Screen {
  try {
    const asked = new URLSearchParams(window.location.search).get("ecran");
    return SCREENS.includes(asked as Screen) ? (asked as Screen) : "soir";
  } catch {
    return "soir";
  }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const { updateReady } = usePwa();
  const [selected, setSelected] = useState<string | null>(null);
  const [backTo, setBackTo] = useState<Screen>("cibles");

  const fetchState = useCallback(() => api.state(), []);
  const { data: state, reload: reloadState } = useFetch(fetchState, [], "state");
  const captured = new Set(state?.messierCaptured ?? []);

  const openTarget = (designation: string, from: Screen = screen) => {
    setSelected(designation);
    setBackTo(from === "detail" ? backTo : from);
    setScreen("detail");
  };

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
      <div className="nc-scroll" style={{ flex: 1, overflow: "auto" }}>
        {screen === "soir" && (
          <CeSoir onGoTargets={() => setScreen("cibles")} onSearch={() => setScreen("recherche")} />
        )}
        {screen === "cibles" && (
          <Cibles captured={captured} onOpenTarget={(d) => openTarget(d, "cibles")} />
        )}
        {screen === "detail" && selected && (
          <Detail
            designation={selected}
            captured={captured}
            horizon={state?.horizon}
            windowMode={state?.windowMode}
            viewWindow={state?.viewWindow}
            onBack={() => setScreen(backTo)}
            onCaptureChange={reloadState}
          />
        )}
        {screen === "messier" && (
          <Messier captured={captured} onOpenTarget={(d) => openTarget(d, "messier")} onCaptureChange={reloadState} />
        )}
        {screen === "journal" && <Journal onOpenTarget={(d) => openTarget(d, "journal")} />}
        {screen === "recherche" && (
          <Recherche onOpenTarget={(d) => openTarget(d, "recherche")} onCancel={() => setScreen("soir")} />
        )}
        {screen === "reglages" && <Reglages />}
      </div>
      <TabBar
        active={screen === "detail" ? backTo : screen === "recherche" ? "soir" : screen}
        onChange={setScreen}
      />
    </div>
  );
}
