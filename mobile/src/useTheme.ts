import { useSyncExternalStore } from "react";
import { readText, writeText } from "./storage";

/** "night" est le mode vision nocturne (rouge sur noir, tailles augmentees
 * -- voir theme.css) : un theme a part entiere, pas une variante de
 * "dark", parce qu'il change aussi les tailles et qu'on veut pouvoir y
 * entrer et en sortir d'un geste sans perdre le theme de jour choisi.
 *
 * Etat de module plutot qu'etat de composant : la bascule existe maintenant
 * sur plusieurs ecrans a la fois (en-tetes, Reglages, passage automatique
 * dans App), et chaque `useState` aurait garde sa propre idee du theme. */
export type Theme = "dark" | "light" | "night";

const THEME_KEY = "nc-theme";
const BEFORE_NIGHT_KEY = "nc-theme-before-night";
/** "1" : passer seul en vision nocturne a la nuit tombee (voir autoNight.ts). */
const AUTO_KEY = "nc-night-auto";
/** "1" tant que la vision nocturne en cours a ete posee par le passage
 * automatique : c'est seulement dans ce cas qu'on la leve seul au matin. Une
 * bascule a la main l'efface -- l'appli ne reprend pas la main sur un choix
 * qu'on vient de faire. */
const AUTO_ENTERED_KEY = "nc-night-auto-entered";

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

interface ThemeSnapshot {
  theme: Theme;
  isSystem: boolean;
  auto: boolean;
}

let snapshot: ThemeSnapshot | null = null;
const listeners = new Set<() => void>();

function read(): ThemeSnapshot {
  return {
    theme: (document.documentElement.getAttribute("data-theme") as Theme | null) ?? systemTheme(),
    isSystem: readText(THEME_KEY) === null,
    auto: readText(AUTO_KEY) === "1",
  };
}

function getSnapshot(): ThemeSnapshot {
  if (!snapshot) snapshot = read();
  return snapshot;
}

function emit(): void {
  snapshot = read();
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setTheme(next: Theme | "system"): void {
  if (next === "system") {
    writeText(THEME_KEY, null);
    applyTheme(systemTheme());
  } else {
    writeText(THEME_KEY, next);
    applyTheme(next);
  }
  emit();
}

function enterNight(): void {
  const { theme, isSystem } = getSnapshot();
  if (theme === "night") return;
  writeText(BEFORE_NIGHT_KEY, isSystem ? "system" : theme);
  setTheme("night");
}

function leaveNight(): void {
  const before = readText(BEFORE_NIGHT_KEY);
  writeText(BEFORE_NIGHT_KEY, null);
  setTheme(before === "dark" || before === "light" ? before : "system");
}

/** Bascule vision nocturne, pensee pour le terrain : un appui pour y
 * entrer, un appui pour revenir exactement au theme d'avant (et non a
 * un "Systeme" par defaut qui rallumerait un ecran blanc en plein
 * champ). */
export function toggleNight(): void {
  writeText(AUTO_ENTERED_KEY, null);
  if (getSnapshot().theme === "night") leaveNight();
  else enterNight();
}

/** Choix direct d'un theme depuis l'en-tete (voir NightToggle). Entrer en
 * vision nocturne par la retient le theme d'avant, comme `toggleNight` ; en
 * sortir vers un theme choisi l'oublie. Un choix a la main, comme la
 * bascule : le passage automatique ne le defait pas au matin. */
export function chooseTheme(next: Theme): void {
  writeText(AUTO_ENTERED_KEY, null);
  if (next === "night") {
    enterNight();
  } else {
    writeText(BEFORE_NIGHT_KEY, null);
    setTheme(next);
  }
}

export function setAutoNight(on: boolean): void {
  writeText(AUTO_KEY, on ? "1" : null);
  if (!on) writeText(AUTO_ENTERED_KEY, null);
  emit();
}

/** Appele par le passage automatique (voir useAutoNight dans App.tsx). */
export function autoEnterNight(): void {
  if (getSnapshot().theme === "night") return;
  enterNight();
  writeText(AUTO_ENTERED_KEY, "1");
}

export function autoLeaveNight(): void {
  if (readText(AUTO_ENTERED_KEY) !== "1") return;
  writeText(AUTO_ENTERED_KEY, null);
  if (getSnapshot().theme === "night") leaveNight();
}

export function useTheme() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    ...snap,
    setTheme,
    toggleNight,
    chooseTheme,
    setAutoNight,
    isNight: snap.theme === "night",
  };
}
