import type { Screen } from "../types";

const TABS: { key: Screen; label: string }[] = [
  { key: "soir", label: "Ce soir" },
  { key: "cibles", label: "Cibles" },
  { key: "messier", label: "Messier" },
  { key: "reglages", label: "Réglages" },
];

export function TabBar({ screen, onChange }: { screen: Screen; onChange: (s: Screen) => void }) {
  return (
    <div className="nc-tabbar">
      {TABS.map((t) => {
        const active =
          screen === t.key ||
          (screen === "detail" && t.key === "cibles") ||
          (screen === "recherche" && t.key === "soir");
        return (
          <button
            key={t.key}
            className={`nc-tab ${active ? "nc-tab-active" : ""}`}
            onClick={() => onChange(t.key)}
          >
            <span className="nc-tab-dot" />
            <span className="nc-tab-label">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
