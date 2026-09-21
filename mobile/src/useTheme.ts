import { useCallback, useState } from "react";
import { readText, writeText } from "./storage";

/** "night" est le mode vision nocturne (rouge sur noir, tailles augmentees
 * -- voir theme.css) : un theme a part entiere, pas une variante de
 * "dark", parce qu'il change aussi les tailles et qu'on veut pouvoir y
 * entrer et en sortir d'un geste sans perdre le theme de jour choisi. */
type Theme = "dark" | "light" | "night";

const THEME_KEY = "nc-theme";
const BEFORE_NIGHT_KEY = "nc-theme-before-night";

const BAR_COLOR: Record<Theme, string> = {
  dark: "#0a090c",
  light: "#f6f4f8",
  night: "#000000",
};

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Couleur de la barre systeme quand l'appli est installee (PWA) : elle est
 * posee une premiere fois par le script inline de index.html, avant le
 * rendu, puis suivie ici a chaque changement de theme. */
function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", BAR_COLOR[theme]);
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(
    () => (document.documentElement.getAttribute("data-theme") as Theme | null) ?? systemTheme(),
  );
  const [isSystem, setIsSystem] = useState(() => readText(THEME_KEY) === null);

  const setTheme = useCallback((next: Theme | "system") => {
    if (next === "system") {
      writeText(THEME_KEY, null);
      const resolved = systemTheme();
      applyTheme(resolved);
      setThemeState(resolved);
      setIsSystem(true);
    } else {
      writeText(THEME_KEY, next);
      applyTheme(next);
      setThemeState(next);
      setIsSystem(false);
    }
  }, []);

  /** Bascule vision nocturne, pensee pour le terrain : un appui pour y
   * entrer, un appui pour revenir exactement au theme d'avant (et non a
   * un "Systeme" par defaut qui rallumerait un ecran blanc en plein
   * champ). */
  const toggleNight = useCallback(() => {
    if (theme === "night") {
      const before = readText(BEFORE_NIGHT_KEY);
      setTheme(before === "dark" || before === "light" ? before : "system");
      writeText(BEFORE_NIGHT_KEY, null);
      return;
    }
    writeText(BEFORE_NIGHT_KEY, isSystem ? "system" : theme);
    setTheme("night");
  }, [theme, isSystem, setTheme]);

  return { theme, isSystem, setTheme, toggleNight, isNight: theme === "night" };
}
