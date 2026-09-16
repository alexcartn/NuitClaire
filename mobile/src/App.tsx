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

export default function App() {
  const [screen, setScreen] = useState<Screen>("soir");
  const [selected, setSelected] = useState<string | null>(null);

  const fetchState = useCallback(() => api.state(), []);
  const { data: state } = useFetch(fetchState, []);
  const captured = new Set(state?.messierCaptured ?? []);

  const openTarget = (designation: string) => {
    setSelected(designation);
    setScreen("detail");
  };

  return (
    <div className="nc-app">
      <div className="nc-scroll" style={{ flex: 1, overflow: "auto" }}>
        {screen === "soir" && (
          <CeSoir onGoTargets={() => setScreen("cibles")} onSearch={() => setScreen("recherche")} />
        )}
        {screen === "cibles" && <Cibles captured={captured} onOpenTarget={openTarget} />}
        {screen === "detail" && selected && (
          <Detail designation={selected} captured={captured} onBack={() => setScreen("cibles")} />
        )}
        {screen === "messier" && <Messier captured={captured} onOpenTarget={openTarget} />}
        {screen === "recherche" && <Recherche onOpenTarget={openTarget} onCancel={() => setScreen("soir")} />}
        {screen === "reglages" && <Reglages />}
      </div>
      <TabBar screen={screen} onChange={setScreen} />
    </div>
  );
}
