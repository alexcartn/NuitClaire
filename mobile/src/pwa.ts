/** Cycle de vie de l'appli installee : enregistrement du service worker,
 * proposition d'installation, et prise en compte d'une nouvelle version.
 *
 * Trois comportements qu'une page web n'a pas besoin d'avoir, mais qu'une
 * appli posee sur l'ecran d'accueil doit avoir :
 *
 *  - s'installer : Chrome/Android previent qu'il peut le faire
 *    (`beforeinstallprompt`) et attend qu'on le lui demande ; iOS n'a pas
 *    d'API du tout, seule une marche a suivre manuelle existe (voir
 *    `canPromptInstall`/`isIOS`, utilises par l'ecran Reglages) ;
 *  - se mettre a jour sans surprise : le nouveau service worker reste en
 *    attente au lieu de prendre la main tout seul, et l'appli propose de
 *    recharger. Une prise de controle automatique en pleine saisie ferait
 *    perdre la note en cours de frappe, ce que ce journal ne doit jamais
 *    faire ;
 *  - savoir qu'elle est deja installee, pour ne plus proposer de l'installer.
 *
 * Meme forme que sessionStore.ts (module + useSyncExternalStore) : l'etat
 * est global par nature, il ne peut pas vivre dans un composant. */
import { useSyncExternalStore } from "react";

/** L'evenement Chrome qui annonce qu'une installation est possible. Absent
 * de la definition DOM standard : il n'est pas specifie ailleurs que chez
 * les navigateurs Chromium. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export interface PwaSnapshot {
  /** Une installation peut etre proposee en un appui (Chromium). */
  canPromptInstall: boolean;
  /** L'appli tourne depuis l'ecran d'accueil, pas dans un onglet. */
  installed: boolean;
  /** Une nouvelle version est prete et attend un rechargement. */
  updateReady: boolean;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let waiting: ServiceWorker | null = null;
let reloading = false;

const listeners = new Set<() => void>();

function detectInstalled(): boolean {
  try {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      // Safari iOS, qui ne rapporte pas display-mode.
      (navigator as unknown as { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

let snapshot: PwaSnapshot = {
  canPromptInstall: false,
  installed: detectInstalled(),
  updateReady: false,
};

function emit(next: Partial<PwaSnapshot>): void {
  snapshot = { ...snapshot, ...next };
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): PwaSnapshot {
  return snapshot;
}

export function usePwa(): PwaSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** iOS n'expose aucune API d'installation : la seule voie est Partager puis
 * "Sur l'ecran d'accueil", d'ou la marche a suivre affichee en clair. Le
 * test inclut l'iPad recent, qui se presente comme un Mac tactile. */
export function isIOS(): boolean {
  const ua = navigator.userAgent;
  return (
    /iphone|ipad|ipod/i.test(ua) ||
    (/Macintosh/.test(ua) && typeof navigator.maxTouchPoints === "number" && navigator.maxTouchPoints > 1)
  );
}

/** Declenche la boite d'installation du navigateur. Renvoie false si elle
 * n'est pas disponible (deja installee, iOS, ou proposition deja consommee :
 * l'evenement ne se rejoue pas). */
export async function promptInstall(): Promise<boolean> {
  const event = deferredPrompt;
  if (!event) return false;
  deferredPrompt = null;
  emit({ canPromptInstall: false });
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome === "accepted";
}

/** Fait passer la version en attente au premier plan, puis recharge. Le
 * rechargement se fait sur `controllerchange`, une fois le nouveau worker
 * aux commandes : recharger avant ferait revenir l'ancienne version. */
export function applyUpdate(): void {
  if (!waiting) {
    window.location.reload();
    return;
  }
  waiting.postMessage({ type: "SKIP_WAITING" });
}

function watchWaiting(reg: ServiceWorkerRegistration): void {
  const candidate = reg.waiting;
  // Sans controleur, c'est la toute premiere installation : rien a proposer,
  // l'appli qui tourne est deja la bonne.
  if (candidate && navigator.serviceWorker.controller) {
    waiting = candidate;
    emit({ updateReady: true });
  }
}

export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("beforeinstallprompt", (e) => {
    // Sans preventDefault, Chrome affiche sa propre invite au moment qui
    // l'arrange ; on prefere la proposer depuis Reglages.
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    emit({ canPromptInstall: true });
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    emit({ canPromptInstall: false, installed: true });
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        watchWaiting(reg);
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed") watchWaiting(reg);
          });
        });
      })
      .catch(() => {
        // Enregistrement refuse (contexte non securise, navigation privee) :
        // l'appli marche sans, elle perd l'ouverture hors ligne.
      });
  });
}
