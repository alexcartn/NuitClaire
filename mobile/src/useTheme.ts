import { useCallback, useState } from "react";

type Theme = "dark" | "light";

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
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
      document.documentElement.setAttribute("data-theme", resolved);
      setThemeState(resolved);
      setIsSystem(true);
    } else {
      localStorage.setItem("nc-theme", next);
      document.documentElement.setAttribute("data-theme", next);
      setThemeState(next);
      setIsSystem(false);
    }
  }, []);

  return { theme, isSystem, setTheme };
}
