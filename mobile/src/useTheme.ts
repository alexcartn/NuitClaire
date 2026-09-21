import { useCallback, useState } from "react";

type Theme = "dark" | "light";

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Couleur de la barre systeme quand l'appli est installee (PWA) : elle est
 * posee une premiere fois par le script inline de index.html, avant le
 * rendu, puis suivie ici a chaque changement de theme. */
function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "light" ? "#f6f4f8" : "#0a090c");
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(
    () => (document.documentElement.getAttribute("data-theme") as Theme | null) ?? systemTheme(),
  );
  const [isSystem, setIsSystem] = useState(() => localStorage.getItem("nc-theme") === null);

  const setTheme = useCallback((next: Theme | "system") => {
    if (next === "system") {
      localStorage.removeItem("nc-theme");
      const resolved = systemTheme();
      applyTheme(resolved);
      setThemeState(resolved);
      setIsSystem(true);
    } else {
      localStorage.setItem("nc-theme", next);
      applyTheme(next);
      setThemeState(next);
      setIsSystem(false);
    }
  }, []);

  return { theme, isSystem, setTheme };
}
