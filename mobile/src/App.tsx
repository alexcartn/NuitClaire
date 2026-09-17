import { useCallback, useState } from "react";
import { api } from "./api";
import { useFetch } from "./useFetch";
import type { Screen } from "./types";
import { TabBar } from "./components/TabBar";
import { CeSoir } from "./screens/CeSoir";
import { Cibles } from "./screens/Cibles";
import { Detail } from "./screens/Detail";
import { Messier } from "./screens/Messier";
import { Recherche } from "./screens/Recherche";
import { Reglages } from "./screens/Reglages";
import { Journal } from "./screens/Journal";

export default function App() {
  const [screen, setScreen] = useState<Screen>("soir");
  const [selected, setSelected] = useState<string | null>(null);
  const [backTo, setBackTo] = useState<Screen>("cibles");

  const fetchState = useCallback(() => api.state(), []);
  const { data: state, reload: reloadState } = useFetch(fetchState, []);
  const captured = new Set(state?.messierCaptured ?? []);

  const openTarget = (designation: string, from: Screen = screen) => {
    setSelected(designation);
    setBackTo(from === "detail" ? backTo : from);
    setScreen("detail");
  };

  return (
    <div className="nc-app">
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
