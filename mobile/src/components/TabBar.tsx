import type { Screen } from "../types";

const TABS: { key: Screen; label: string }[] = [
  { key: "soir", label: "Ce soir" },
  { key: "cibles", label: "Cibles" },
  { key: "messier", label: "Messier" },
  { key: "journal", label: "Journal" },
  { key: "reglages", label: "Réglages" },
];

/** `active` est l'onglet a surligner (pas forcement `screen` : "detail" et
 * "recherche" ne sont pas des onglets -- voir App.tsx qui calcule quel
 * onglet d'origine surligner). */
export function TabBar({ active, onChange }: { active: Screen; onChange: (s: Screen) => void }) {
  return (
    <div className="nc-tabbar">
      {TABS.map((t) => {
        const isActive = active === t.key;
        return (
          <button
            key={t.key}
            className={`nc-tab ${isActive ? "nc-tab-active" : ""}`}
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
