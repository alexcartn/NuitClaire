/** Passage automatique en vision nocturne.
 *
 * Entre le crepuscule nautique du soir et celui du matin, le ciel est assez
 * noir pour que l'oeil commence a s'adapter : c'est a partir de la qu'un
 * ecran clair coute vingt minutes de vision. On s'appuie sur la nuit gardee
 * sur l'appareil (cle "night", voir useFetch) : aucune requete, et ca marche
 * hors ligne une fois la nuit chargee au moins une fois.
 *
 * Une seule entree automatique par nuit : si on repasse en theme de jour a
 * la main en pleine nuit, l'appli ne nous y renvoie pas une minute plus tard.
 * Pur et sans DOM, pour etre teste sous Node. */
export interface NightBounds {
  date: string;
  nauticalDusk: string;
  nauticalDawn: string;
}

export function isDarkNow(night: NightBounds, now: Date): boolean {
  const t = now.getTime();
  return t >= new Date(night.nauticalDusk).getTime() && t < new Date(night.nauticalDawn).getTime();
}

export type AutoNightAction = "enter" | "leave" | null;

/** Que faire maintenant, sachant la nuit connue et la derniere nuit pour
 * laquelle l'entree automatique a deja eu lieu (`doneFor`). */
export function autoNightAction(night: NightBounds | null, now: Date, doneFor: string | null): AutoNightAction {
  if (!night) return null;
  if (isDarkNow(night, now)) return doneFor === night.date ? null : "enter";
  return "leave";
}
