import { api } from "./api";
import { isIOS } from "./pwa";

/** Abonnement de ce telephone aux notifications push (voir notifications.py
 * et public/sw.js).
 *
 * Etats possibles, du moins au plus avance :
 * - "unsupported" : navigateur sans Web Push, ou appli lancee sans service
 *   worker (en developpement, il n'est enregistre qu'au build) ;
 * - "needs-install" : iPhone/iPad, ou Safari ne livre les notifications
 *   qu'a une appli posee sur l'ecran d'accueil (iOS 16.4 et plus) ;
 * - "denied" : refusees dans les reglages du navigateur -- l'appli ne peut
 *   plus redemander, seul l'utilisateur peut revenir dessus ;
 * - "off" / "on" : pas encore abonne / abonne. */
export type PushState = "unsupported" | "needs-install" | "denied" | "off" | "on";

function standalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

async function registration(): Promise<ServiceWorkerRegistration | undefined> {
  if (!("serviceWorker" in navigator)) return undefined;
  return navigator.serviceWorker.getRegistration();
}

export async function pushState(): Promise<PushState> {
  if (isIOS() && !standalone()) return "needs-install";
  if (!("PushManager" in window) || !("Notification" in window)) return "unsupported";
  const reg = await registration();
  if (!reg) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const sub = await reg.pushManager.getSubscription();
  return sub ? "on" : "off";
}

/** La cle publique VAPID arrive en base64url ; `subscribe` veut des octets. */
function keyBytes(base64url: string): ArrayBuffer {
  const padded = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

/** Demande l'autorisation (depuis un geste de l'utilisateur, exige par
 * Safari), abonne le telephone et transmet l'abonnement au serveur. */
export async function enablePush(): Promise<PushState> {
  const reg = await registration();
  if (!reg) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";
  const { publicKey } = await api.pushKey();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
  }
  await api.pushSubscribe(sub.toJSON());
  return "on";
}

export async function disablePush(): Promise<PushState> {
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    // Le serveur d'abord : si le reseau manque, on reste abonne des deux
    // cotes plutot que de laisser au serveur une adresse morte.
    await api.pushUnsubscribe(sub.endpoint);
    await sub.unsubscribe();
  }
  return "off";
}
