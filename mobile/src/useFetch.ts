import { useCallback, useEffect, useRef, useState } from "react";

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/** Petit hook fetch generique : pas de bibliotheque de cache/requetes (voir
 * le plan d'implementation mobile -- empreinte de dependances minimale pour
 * une petite appli personnelle). `fn` doit etre stable (useCallback) sinon
 * elle re-declenche une requete a chaque rendu. `reload()` relance `fn()`
 * sans attendre un changement de `deps` -- utilise apres une mutation
 * (ex. cocher une capture Messier) pour refleter l'etat serveur a jour. */
export function useFetch<T>(fn: () => Promise<T>, deps: unknown[]): FetchState<T> & { reload: () => void } {
  const [state, setState] = useState<FetchState<T>>({ data: null, loading: true, error: null });
  const gen = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(() => {
    const myGen = ++gen.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    fnRef
      .current()
      .then((data) => {
        if (myGen === gen.current) setState({ data, loading: false, error: null });
      })
      .catch((err: Error) => {
        if (myGen === gen.current) setState({ data: null, loading: false, error: err.message });
      });
  }, []);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, reload: run };
}
