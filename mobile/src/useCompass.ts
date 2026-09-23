/** Cap magnetique du telephone, pour savoir dans quelle direction on
 * regarde.
 *
 * Sert juste au-dessus de l'horizon degage : on coche les secteurs en
 * tournant sur soi-meme, dehors, et sans reperes une fois la nuit tombee,
 * savoir ou est le nord tient de la devinette.
 *
 * Trois particularites de l'API d'orientation, qui expliquent la forme de ce
 * hook :
 *
 *  - il faut l'orientation *absolue*, rapportee au nord magnetique, pas
 *    l'orientation relative au point de depart. Chrome la publie sur
 *    `deviceorientationabsolute` ; Safari ne la publie pas du tout, mais
 *    ajoute `webkitCompassHeading` a l'evenement ordinaire ;
 *  - iOS exige une autorisation demandee depuis un geste de l'utilisateur
 *    (`DeviceOrientationEvent.requestPermission`), d'ou le bouton
 *    d'activation plutot qu'un demarrage automatique ;
 *  - `alpha` compte dans le sens antihoraire depuis le nord, alors qu'un cap
 *    se lit dans le sens horaire : d'ou le `360 - alpha`.
 *
 * Quand rien de tout cela n'est disponible, le hook le dit (`unsupported`)
 * au lieu d'afficher une aiguille immobile qui ferait croire a une mesure. */
import { useCallback, useEffect, useRef, useState } from "react";

export type CompassState =
  /** Pas encore demarre : en attente du geste d'activation. */
  | "idle"
  /** Autorisation demandee, en attente de reponse. */
  | "asking"
  /** Evenements recus. */
  | "running"
  /** Autorisation refusee par l'utilisateur. */
  | "denied"
  /** Ni capteur ni API : rien a afficher. */
  | "unsupported";

/** Safari expose le cap directement, et hors de la definition standard. */
interface CompassEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

interface PermissionCapableEvent {
  requestPermission?: () => Promise<"granted" | "denied" | "prompt">;
}

function headingFrom(event: CompassEvent): number | null {
  // Safari : deja un cap, dans le bon sens.
  if (typeof event.webkitCompassHeading === "number" && !Number.isNaN(event.webkitCompassHeading)) {
    return event.webkitCompassHeading;
  }
  if (event.alpha == null) return null;
  // Une orientation relative pointerait n'importe ou : mieux vaut ne rien
  // afficher que d'indiquer un nord qui n'en est pas un.
  if (event.absolute === false) return null;
  return (360 - event.alpha) % 360;
}

/** Seul iOS demande une autorisation, via une methode posee sur le
 * constructeur d'evenement. Ailleurs, on peut ecouter directement. */
function permissionRequired(): boolean {
  const ctor = (globalThis as { DeviceOrientationEvent?: PermissionCapableEvent }).DeviceOrientationEvent;
  return typeof ctor?.requestPermission === "function";
}

/** Delai au-dela duquel une ecoute muette signifie qu'il n'y a pas de
 * magnetometre : l'API existe sur tous les navigateurs, le capteur non (un
 * ordinateur de bureau, par exemple). Sans cela, l'ecran resterait
 * indefiniment sur "en attente d'une mesure". */
const SILENCE_MS = 3000;

export function useCompass() {
  const [state, setState] = useState<CompassState>(() =>
    typeof window !== "undefined" && "DeviceOrientationEvent" in window ? "idle" : "unsupported",
  );
  const [heading, setHeading] = useState<number | null>(null);
  const started = useRef(false);
  const silence = useRef<ReturnType<typeof setTimeout> | null>(null);

  const listen = useCallback(() => {
    if (started.current) return;
    started.current = true;
    const onEvent = (raw: Event) => {
      const value = headingFrom(raw as CompassEvent);
      if (value === null) return;
      if (silence.current !== null) {
        clearTimeout(silence.current);
        silence.current = null;
      }
      setHeading(value);
      setState("running");
    };
    // Une mesure doit arriver vite : au-dela, il n'y a pas de capteur.
    silence.current = setTimeout(() => {
      silence.current = null;
      setState((current) => (current === "running" ? current : "unsupported"));
    }, SILENCE_MS);
    // Les deux : Chrome publie l'absolu sur le premier, Safari le cap sur le
    // second. S'abonner aux deux evite de choisir selon le navigateur.
    window.addEventListener("deviceorientationabsolute", onEvent);
    window.addEventListener("deviceorientation", onEvent);
  }, []);

  const start = useCallback(async () => {
    const ctor = window.DeviceOrientationEvent as unknown as PermissionCapableEvent | undefined;
    if (!ctor) {
      setState("unsupported");
      return;
    }
    const ask = ctor.requestPermission;
    if (typeof ask === "function") {
      setState("asking");
      try {
        const answer = await ask.call(ctor);
        if (answer !== "granted") {
          setState("denied");
          return;
        }
      } catch {
        // Hors contexte securise, ou hors geste utilisateur.
        setState("denied");
        return;
      }
    }
    // Pas encore "running" : on attend un evenement exploitable, faute de
    // quoi on annoncerait un cap qu'on n'a pas.
    listen();
  }, [listen]);

  useEffect(() => {
    // Hors iOS, aucune autorisation a demander : on ecoute tout de suite, et
    // l'interface n'affiche rien tant qu'aucun cap n'arrive.
    if ("DeviceOrientationEvent" in window && !permissionRequired()) listen();
  }, [listen]);

  return {
    heading,
    state,
    start,
    // Le bouton d'activation n'a de sens que la ou une autorisation est
    // vraiment demandee : ailleurs il ne ferait rien de plus que l'ecoute
    // deja en cours.
    needsPermission: permissionRequired() && (state === "idle" || state === "asking"),
  };
}
