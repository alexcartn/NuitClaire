import { TabIcon, type TabIconName } from "./TabIcon";
import type { Screen } from "../types";

// Icones SVG dessinees (voir TabIcon.tsx, qui explique l'abandon des
// glyphes Unicode) : lune pour la nuit en cours, etoile pour la carte du ciel,
// reticule pour les cibles (Messier en est un segment), carnet pour le
// journal, curseurs pour les reglages.
const TABS: { key: Screen; label: string; icon: TabIconName }[] = [
  { key: "soir", label: "Ce soir", icon: "moon" },
  { key: "ciel", label: "Ciel", icon: "sky" },
  { key: "cibles", label: "Cibles", icon: "target" },
  { key: "journal", label: "Journal", icon: "notebook" },
  { key: "reglages", label: "Réglages", icon: "sliders" },
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
            <span className="nc-tab-icon">
              <TabIcon name={t.icon} />
            </span>
            <span className="nc-tab-label">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
