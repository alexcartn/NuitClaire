import { useSyncExternalStore } from "react";
import { readText, writeText } from "./storage";

/** « En attendant le Seestar » : aux jumelles ou a l'oeil nu. Le meme choix
 * vaut pour la carte de Ce soir, les suggestions de l'ecran Ciel et le
 * viseur ; garde d'une nuit a l'autre (on a ses jumelles, ou pas). */
export type WatchMode = "jumelles" | "oeil";

const KEY = "nc-watch-mode";
const listeners = new Set<() => void>();

function read(): WatchMode {
  return readText(KEY) === "oeil" ? "oeil" : "jumelles";
}

/** Le mode en cours, hors d'un composant (a l'ouverture d'une fiche). */
export function getWatchMode(): WatchMode {
  return read();
}

export function setWatchMode(mode: WatchMode): void {
  writeText(KEY, mode === "oeil" ? "oeil" : null);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useWatchMode(): [WatchMode, (mode: WatchMode) => void] {
  return [useSyncExternalStore(subscribe, read, read), setWatchMode];
}
