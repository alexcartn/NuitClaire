import type { Screen } from "../types";

// Glyphes Unicode (pas de bibliotheque d'icones -- meme approche que le "⌕"
// de recherche sur l'ecran "Ce soir") : lune pour la nuit en cours, reticule
// pour les cibles, grille pour le catalogue Messier (distinct du reticule),
// crayon pour le journal, roue crantee pour les reglages.
const TABS: { key: Screen; label: string; icon: string }[] = [
  { key: "soir", label: "Ce soir", icon: "☾" },
  { key: "cibles", label: "Cibles", icon: "◎" },
  { key: "messier", label: "Messier", icon: "▦" },
  { key: "journal", label: "Journal", icon: "✎" },
  { key: "reglages", label: "Réglages", icon: "⚙" },
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
            <span className="nc-tab-icon" aria-hidden="true">{t.icon}</span>
            <span className="nc-tab-label">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
