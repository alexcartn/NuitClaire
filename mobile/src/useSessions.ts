/** Acces React a l'etat partage du journal de session (voir
 * sessionStore.ts). `mutate`, `applyServer` et `refresh` sont des fonctions
 * de module, donc stables : elles peuvent etre passees telles quelles a des
 * composants enfants. */
import { useSyncExternalStore } from "react";
import { applyServer, getSnapshot, mutate, refresh, subscribe } from "./sessionStore";
import type { SessionsSnapshot } from "./sessionStore";

export function useSessions(): SessionsSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export { applyServer, mutate, refresh };
