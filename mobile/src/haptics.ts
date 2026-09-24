/** Petite vibration de confirmation : avec des gants, dans le noir, on ne
 * voit pas toujours qu'un appui a ete pris. Silencieux la ou l'API manque
 * (iOS Safari notamment). */
export function tap(): void {
  try {
    navigator.vibrate?.(12);
  } catch {
    /* rien : l'appui a fonctionne, seule la confirmation manque */
  }
}
