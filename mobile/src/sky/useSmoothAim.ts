import { useEffect, useRef, useState } from "react";
import { separation, smoothAim, type AltAz } from "./sky";

/** Temps de reponse du lissage : assez court pour que la carte suive le
 * geste, assez long pour gommer le tremblement de la boussole. */
const TAU_MS = 140;

/** Suit en douceur une direction donnee par les capteurs (20 mesures par
 * seconde au plus, qui tremblent d'un ou deux degres) : la carte glisse a
 * chaque image au lieu de sauter a chaque mesure, comme dans Star Walk ou
 * SkySafari. Null tant que `target` l'est ; la premiere mesure est prise
 * telle quelle. Se tait quand la direction ne bouge plus : pas de rendu
 * inutile. */
export function useSmoothAim(target: AltAz | null): AltAz | null {
  const [aim, setAim] = useState<AltAz | null>(target);
  const goal = useRef(target);
  goal.current = target;
  const cur = useRef<AltAz | null>(target);
  const active = target != null;

  useEffect(() => {
    if (!active) {
      cur.current = null;
      setAim(null);
      return;
    }
    let raf = 0;
    let last = performance.now();
    const step = (t: number) => {
      const g = goal.current;
      if (g) {
        const k = 1 - Math.exp(-(t - last) / TAU_MS);
        const next = cur.current ? smoothAim(cur.current, g, k) : g;
        if (!cur.current || separation(next, cur.current) > 0.01) {
          cur.current = next;
          setAim(next);
        }
      }
      last = t;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return active ? aim ?? target : null;
}
