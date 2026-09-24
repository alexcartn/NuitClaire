import { useState, type Dispatch, type SetStateAction } from "react";

/** Etat d'ecran qui survit au demontage : filtres, « voir plus ».
 *
 * Ouvrir une fiche puis revenir recreait l'ecran de liste, filtres remis a
 * zero et liste repliee -- il fallait tout refaire a chaque cible consultee.
 * Garde en memoire de module (pas localStorage) : l'etat tient le temps de
 * l'ouverture de l'appli, pas d'une nuit a l'autre, ou les cibles changent. */
const memory = new Map<string, unknown>();

export function useRemembered<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => (memory.has(key) ? (memory.get(key) as T) : initial));
  const set: Dispatch<SetStateAction<T>> = (next) => {
    setValue((cur) => {
      const resolved = typeof next === "function" ? (next as (c: T) => T)(cur) : next;
      memory.set(key, resolved);
      return resolved;
    });
  };
  return [value, set];
}
