import { useEffect, useRef, useState } from "react";

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/** Petit hook fetch generique : pas de bibliotheque de cache/requetes (voir
 * le plan d'implementation mobile -- empreinte de dependances minimale pour
 * une petite appli personnelle). `fn` doit etre stable (useCallback) sinon
 * elle re-declenche une requete a chaque rendu. */
export function useFetch<T>(fn: () => Promise<T>, deps: unknown[]): FetchState<T> & { reload: () => void } {
  const [state, setState] = useState<FetchState<T>>({ data: null, loading: true, error: null });
  const gen = useRef(0);

  useEffect(() => {
    const myGen = ++gen.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn()
      .then((data) => {
        if (myGen === gen.current) setState({ data, loading: false, error: null });
      })
      .catch((err: Error) => {
        if (myGen === gen.current) setState({ data: null, loading: false, error: err.message });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, reload: () => setState((s) => ({ ...s })) };
}
