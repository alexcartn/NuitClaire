import { useEffect, useRef, useState } from "react";
import { useTheme, type Theme } from "../useTheme";
import { TabIcon, type TabIconName } from "./TabIcon";

const THEMES: { theme: Theme; label: string; icon: TabIconName; hint: string }[] = [
  { theme: "light", label: "Clair", icon: "sun", hint: "en journée" },
  { theme: "dark", label: "Sombre", icon: "contrast", hint: "le soir" },
  { theme: "night", label: "Nuit", icon: "moon", hint: "rouge sur noir, dehors" },
];

/** Choix du theme, dans l'en-tete de chaque ecran : le bouton rond montre
 * l'icone du theme en cours (comme ses voisins, sans texte : un libelle
 * faisait casser l'intitule de l'ecran), un appui ouvre les trois.
 *
 * Un menu plutot qu'un bouton qui fait defiler Clair, Sombre, Nuit : en
 * boucle, l'appui suivant la Nuit rallumerait un ecran blanc en plein
 * champ, et l'oeil perdrait vingt minutes d'adaptation a l'obscurite. Ici
 * chaque theme est a un appui de plus, sans passer par les autres.
 * */
export function NightToggle() {
  const { theme, chooseTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = THEMES.find((t) => t.theme === theme) ?? THEMES[1];

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="nc-theme-menu">
      <button
        onClick={() => setOpen((v) => !v)}
        className="nc-round-btn nc-night-toggle"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Thème ${current.label} : changer de thème`}
        title={`Thème : ${current.label}`}
      >
        <TabIcon name={current.icon} />
      </button>
      {open && (
        <div role="menu" className="nc-theme-menu-list">
          {THEMES.map((t) => (
            <button
              key={t.theme}
              role="menuitemradio"
              aria-checked={t.theme === theme}
              onClick={() => {
                chooseTheme(t.theme);
                setOpen(false);
              }}
              className={`nc-theme-menu-item ${t.theme === theme ? "nc-theme-menu-item-active" : ""}`}
            >
              <TabIcon name={t.icon} />
              <span className="nc-stack-xs" style={{ gap: 0, textAlign: "left" }}>
                <span>{t.label}</span>
                <span className="nc-caption" style={{ margin: 0 }}>{t.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
