/** Empeche l'ecran de s'eteindre tant que `active` est vrai.
 *
 * Une session d'observation, c'est deux heures a poser le telephone, le
 * reprendre, noter trois mots. Avec la veille automatique, chaque note
 * commence par rallumer et deverrouiller l'ecran, une main occupee par la
 * lampe : de quoi renoncer a noter. Le verrou n'est pris que pendant une
 * session en cours, pas sur tout l'ecran Journal -- inutile de vider la
 * batterie pour relire une sortie passee au chaud.
 *
 * Le systeme relache le verrou de lui-meme des que la page passe en
 * arriere-plan (ecran verrouille, changement d'appli), d'ou la reprise sur
 * `visibilitychange`. Une demande peut aussi etre refusee (batterie faible,
 * API absente -- elle n'existe que depuis Safari 16.4 cote iOS) : dans ce
 * cas l'appli fonctionne comme avant, sans verrou. */
import { useEffect } from "react";

export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (document.visibilityState !== "visible" || sentinel !== null) return;
      try {
        const granted = await navigator.wakeLock.request("screen");
        if (cancelled) {
          void granted.release();
          return;
        }
        // Le systeme peut relacher le verrou sans nous prevenir autrement :
        // sans ca, on croirait le tenir encore et on ne le redemanderait
        // jamais au retour au premier plan.
        granted.addEventListener("release", () => {
          if (sentinel === granted) sentinel = null;
        });
        sentinel = granted;
      } catch {
        /* refus (batterie faible, page masquee) : on s'en passe */
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel?.release().catch(() => {});
      sentinel = null;
    };
  }, [active]);
}
