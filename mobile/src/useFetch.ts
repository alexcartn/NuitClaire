import { useCallback, useEffect, useRef, useState } from "react";
import { CACHE_PREFIX, readCache, readJson, writeJson, type Cached } from "./storage";

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** Heure du chargement reseau dont proviennent ces donnees, ou null si
   * elles n'ont jamais ete chargees. Sert a dire depuis quand ce qui est
   * affiche date, quand le reseau manque. */
  fetchedAt: string | null;
}

/** Petit hook fetch generique : pas de bibliotheque de cache/requetes (voir
 * le plan d'implementation mobile -- empreinte de dependances minimale pour
 * une petite appli personnelle). `fn` doit etre stable (useCallback) sinon
 * elle re-declenche une requete a chaque rendu. `reload()` relance `fn()`
 * sans attendre un changement de `deps` -- utilise apres une mutation
 * (ex. cocher une capture Messier) pour refleter l'etat serveur a jour.
 *
 * En cas d'erreur, `data` conserve la derniere valeur chargee au lieu de
 * repasser a null : un `reload()` qui echoue (reseau faible sur le terrain,
 * cold start de la fonction serverless) ne doit pas vider un ecran deja
 * rempli -- l'appelant affiche `error` a cote des donnees devenues
 * potentiellement perimees, ce qui est plus utile qu'un ecran blanc au
 * milieu d'une session d'observation.
 *
 * `cacheKey` etend ce principe d'une session a l'autre : la derniere reponse
 * reussie est gardee sur l'appareil et reaffichee immediatement au
 * demarrage, avant meme la requete. C'est ce qui permet d'ouvrir l'appli
 * installee sans reseau et d'y voir quelque chose. Les donnees d'un ciel
 * sont datees par nature (prevision horaire, fenetres de visibilite) : la
 * cle est celle de la requete exacte, et l'appelant doit afficher
 * `fetchedAt` des que `error` est non nul, sinon il montre la nuit
 * d'avant en la faisant passer pour ce soir. */
export function useFetch<T>(
  fn: () => Promise<T>,
  deps: unknown[],
  cacheKey?: string,
): FetchState<T> & { reload: () => void } {
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: true,
    error: null,
    fetchedAt: null,
  });
  const gen = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(() => {
    const myGen = ++gen.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    fnRef
      .current()
      .then((data) => {
        const at = new Date().toISOString();
        if (cacheKey) writeJson(CACHE_PREFIX + cacheKey, { at, data } satisfies Cached<T>);
        if (myGen === gen.current) setState({ data, loading: false, error: null, fetchedAt: at });
      })
      .catch((err: Error) => {
        if (myGen === gen.current) setState((s) => ({ ...s, loading: false, error: err.message }));
      });
  }, [cacheKey]);

  useEffect(() => {
    // Copie locale d'abord : elle s'affiche sans attendre le reseau, et
    // reste a l'ecran si la requete echoue. Ecrasee des qu'une reponse
    // arrive.
    if (cacheKey) {
      const cached = readJson<Cached<T>>(CACHE_PREFIX + cacheKey);
      if (cached) {
        setState({ data: cached.data, loading: true, error: null, fetchedAt: cached.at });
      }
    }
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, reload: run };
}

/** "Donnees du 21/09 a 21:04" : ce que l'appelant affiche quand la requete a
 * echoue mais qu'une copie locale reste a l'ecran. */
export function staleLabel(fetchedAt: string | null): string {
  if (!fetchedAt) return "Données indisponibles";
  const d = new Date(fetchedAt);
  const date = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `Hors ligne : données du ${date} à ${time}`;
}

export { readCache };
