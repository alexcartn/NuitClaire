/** Etat partage du journal de session : dernier etat serveur connu +
 * operations locales en attente rejouees par-dessus (voir sessionQueue.ts
 * pour le pourquoi de la file).
 *
 * Volontairement un module, pas un hook a etat local : deux ecrans ecrivent
 * dans la session (le Journal et la fiche detail, via "Ajouter au journal"),
 * et la file d'envoi doit survivre a un changement d'ecran. Avec un etat par
 * composant, quitter le Journal pendant qu'une note part laisserait
 * l'operation dans localStorage alors qu'elle a bien ete enregistree : elle
 * serait renvoyee au retour sur l'ecran, en double.
 *
 * L'ecran lit cet etat via `useSessions()` (useSyncExternalStore) et ecrit
 * via `mutate()`, qui est synchrone : l'affichage bouge tout de suite,
 * l'envoi se fait en fond, une operation a la fois et dans l'ordre. */
import { ApiError, api } from "./api";
import type { Sessions } from "./types";
import {
  applyOp,
  enqueue,
  loadCache,
  loadQueue,
  localId,
  pendingNoteIds,
  saveCache,
  saveQueue,
  type SessionOp,
} from "./sessionQueue";

// --- Envoi -------------------------------------------------------------
//
// Les appels reseau vivent ici et non dans sessionQueue.ts : ce module-la
// reste purement local (types, application optimiste, persistance), donc
// testable sans navigateur ni API (voir sessionQueue.test.ts).

export function sendOp(op: SessionOp): Promise<Sessions> {
  switch (op.kind) {
    case "addItem":
      return api.addSessionItem(op.designation, op.at);
    case "removeItem":
      return api.deleteSessionItem(op.designation);
    case "setDone":
      return api.updateSessionItem(op.designation, { done: op.done });
    case "setExposure":
      return api.updateSessionItem(op.designation, { exposureMin: op.minutes });
    case "setItemRating":
      return api.updateSessionItem(op.designation, { rating: op.rating });
    case "setFeeling":
      return api.updateFeeling(op.patch);
    case "addItemNote":
      return api.addItemNote(op.designation, op.text, op.at, op.context);
    case "removeItemNote":
      return api.deleteItemNote(op.designation, op.noteId);
    case "addFreeNote":
      return api.addFreeNote(op.text, op.at, op.context);
    case "removeFreeNote":
      return api.deleteFreeNote(op.noteId);
    case "closeSession":
      return api.closeSession();
  }
}

/** Une operation refusee par le serveur (4xx) est definitive : la rejouer
 * echouera pareil, il faut l'abandonner pour ne pas bloquer la file. Tout
 * le reste (fetch qui rejette faute de reseau, 5xx, timeout) est temporaire
 * et se rejoue. */
export function isPermanentFailure(err: unknown): boolean {
  return err instanceof ApiError && err.status >= 400 && err.status < 500;
}

/** Repli quand le serveur refuse definitivement une note rattachee a une
 * cible : la meme note, reposee en note libre avec la cible en tete.
 *
 * Un refus arrive quand la cible n'est pas (ou plus) dans la session -- par
 * exemple une designation detectee en tete de note (voir
 * `parseTargetPrefix`) que le catalogue ne connait pas. Abandonner
 * l'operation effacerait un texte que l'utilisateur a ecrit, dehors, la
 * nuit : c'est exactement ce que ce journal ne doit jamais faire. L'attache
 * a la cible est perdue, le texte non. On garde `noteId` et `at` d'origine
 * pour que l'entree deja affichee ne bouge pas dans le fil.  */
function rescueNote(op: SessionOp): SessionOp | null {
  if (op.kind !== "addItemNote") return null;
  return {
    kind: "addFreeNote",
    noteId: op.noteId,
    text: `${op.designation} : ${op.text}`,
    id: localId(),
    at: op.at,
  };
}

const RETRY_BASE_MS = 2000;
const RETRY_MAX_MS = 60000;

export interface SessionsSnapshot {
  /** Etat serveur + operations en attente. null seulement avant le premier
   * chargement reussi, sans copie locale disponible. */
  data: Sessions | null;
  loading: boolean;
  /** Erreur du dernier chargement : ce qui est affiche vient alors de la
   * copie locale et peut etre perime. */
  loadError: string | null;
  /** Nombre d'operations pas encore acceptees par le serveur. */
  pendingCount: number;
  /** Notes encore en attente d'envoi, pour les marquer a l'ecran. */
  pendingNotes: Set<string>;
  /** Derniere erreur de synchronisation (reseau ou refus serveur). */
  syncError: string | null;
  /** Incremente a chaque operation acceptee par le serveur : signal pour
   * rafraichir ce qui derive du journal (les statistiques). */
  syncCount: number;
}

let base: Sessions | null = loadCache();
let queue: SessionOp[] = loadQueue();
let loading = true;
let loadError: string | null = null;
let syncError: string | null = null;
let syncCount = 0;

let sending = false;
let attempts = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;

const listeners = new Set<() => void>();

function build(): SessionsSnapshot {
  return {
    data: base === null ? null : queue.reduce(applyOp, base),
    loading: loading && base === null,
    loadError,
    pendingCount: queue.length,
    pendingNotes: pendingNoteIds(queue),
    syncError,
    syncCount,
  };
}

// useSyncExternalStore compare les instantanes par identite : on en
// reconstruit un seulement quand l'etat change vraiment.
let snapshot: SessionsSnapshot = build();

function emit(): void {
  snapshot = build();
  for (const l of listeners) l();
}

export function getSnapshot(): SessionsSnapshot {
  return snapshot;
}

export function subscribe(listener: () => void): () => void {
  ensureStarted();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setBase(data: Sessions): void {
  base = data;
  saveCache(data);
}

function setQueue(next: SessionOp[]): void {
  queue = next;
  saveQueue(queue);
}

function scheduleRetry(): void {
  const delay = Math.min(RETRY_BASE_MS * 2 ** attempts, RETRY_MAX_MS);
  attempts += 1;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    flush();
  }, delay);
}

function flush(): void {
  if (sending || queue.length === 0 || retryTimer !== null) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;

  const op = queue[0];
  sending = true;
  sendOp(op)
    .then((data) => {
      // La reponse contient deja le journal complet, operation appliquee :
      // elle devient la nouvelle base, sans GET supplementaire.
      setBase(data);
      setQueue(queue.filter((o) => o.id !== op.id));
      syncError = null;
      syncCount += 1;
      attempts = 0;
    })
    .catch((err: Error) => {
      syncError = err.message;
      if (isPermanentFailure(err)) {
        // Refus definitif du serveur : abandonner cette operation, sinon
        // elle bloque toutes les suivantes indefiniment -- mais jamais le
        // texte qu'elle portait (voir rescueNote).
        const rescued = rescueNote(op);
        const rest = queue.filter((o) => o.id !== op.id);
        setQueue(rescued ? [...rest, rescued] : rest);
        attempts = 0;
        return;
      }
      scheduleRetry();
    })
    .finally(() => {
      sending = false;
      emit();
      // Enchaine sur l'operation suivante, sauf si un backoff est en cours.
      flush();
    });
}

function load(): void {
  api
    .sessions()
    .then((data) => {
      setBase(data);
      loadError = null;
    })
    .catch((err: Error) => {
      loadError = err.message;
    })
    .finally(() => {
      loading = false;
      emit();
    });
}

function wakeUp(): void {
  // Retour du reseau ou de l'appli au premier plan : reessayer sans
  // attendre la fin du backoff en cours.
  if (retryTimer !== null) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  attempts = 0;
  flush();
}

function ensureStarted(): void {
  if (started) return;
  started = true;
  window.addEventListener("online", wakeUp);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") wakeUp();
  });
  load();
  flush();
}

/** Enregistre un geste de l'utilisateur : applique localement et empile pour
 * envoi. Synchrone, et sans effet de bord reseau visible par l'appelant. */
export function mutate(op: SessionOp): void {
  ensureStarted();
  setQueue(enqueue(queue, op));
  emit();
  flush();
}

/** Installe comme nouvelle base un etat serveur obtenu hors file (retouche
 * ou reouverture d'une sortie passee). */
export function applyServer(data: Sessions): void {
  setBase(data);
  emit();
}

/** Recharge depuis le serveur. Sans effet tant qu'il reste des ecritures en
 * vol : leurs reponses tiennent deja la base a jour, et un GET concurrent
 * pourrait ramener un etat anterieur et faire clignoter une note deja
 * enregistree. */
export function refresh(): void {
  if (queue.length > 0 || sending) return;
  load();
}
