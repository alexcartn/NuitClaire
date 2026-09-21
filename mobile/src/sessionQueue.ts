/** File d'attente des ecritures du journal de session.
 *
 * Le journal se remplit a chaud, dehors, pendant l'observation : reseau
 * faible ou absent, fonction serverless froide. Une note qui part en
 * requete bloquante et echoue en silence est une note perdue, au moment
 * precis ou l'appli sert a quelque chose. D'ou ce module :
 *
 *  - chaque geste de l'utilisateur devient une operation (`SessionOp`)
 *    appliquee immediatement a l'etat affiche (`applyOp`, purement locale)
 *    et empilee dans une file persistee en localStorage ;
 *  - la file part vers l'API une operation a la fois, dans l'ordre
 *    (`sendOp`) ; l'etat affiche reste l'etat serveur connu + les
 *    operations encore en attente rejouees par-dessus, ce qui evite tout
 *    rollback : une operation disparait de la file exactement quand sa
 *    reponse serveur, qui l'inclut deja, devient le nouvel etat de base.
 *
 * `applyOp` reproduit volontairement la logique de `sessions.py` (ouverture
 * et fermeture implicites de la session, cloture) -- c'est de la
 * duplication assumee : l'alternative serait de n'afficher la note qu'apres
 * l'aller-retour, soit exactement le probleme qu'on corrige. La reponse du
 * serveur reste autoritaire des qu'elle arrive et ecrase cet etat local :
 * les valeurs que le client ne peut pas connaitre (`scoreAtOpen`, les
 * identifiants et horodatages de notes cotes serveur, la date de la nuit a
 * la cloture) sont approximees ici puis corrigees a la synchronisation.
 *
 * Rien n'est fabrique au sens de l'en-tete de `sessions.py` : la file ne
 * cree aucune donnee, elle differe seulement l'envoi de ce que
 * l'utilisateur a saisi. */
// Extension explicite : ce module est importe tel quel par le lanceur de
// tests de Node (voir sessionQueue.test.ts), dont la resolution ESM ne
// devine pas les extensions, contrairement a Vite.
import { readJson, writeJson } from "./storage.ts";
import { captureContext } from "./nightContext.ts";
import type {
  CurrentSession,
  Feeling,
  Note,
  NoteContext,
  Sessions,
  SessionItem,
  TimelineEntry,
} from "./types";

const QUEUE_KEY = "nc-sessions-queue";
const CACHE_KEY = "nc-sessions-cache";

/** Le geste lui-meme, sans son identite ni son horodatage. */
export type SessionOpBody =
  | { kind: "addItem"; designation: string }
  | { kind: "removeItem"; designation: string }
  | { kind: "setDone"; designation: string; done: boolean }
  | { kind: "setExposure"; designation: string; minutes: number }
  | { kind: "setItemRating"; designation: string; rating: number | null }
  | { kind: "setFeeling"; patch: Partial<Feeling> }
  | { kind: "addItemNote"; designation: string; noteId: string; text: string; context?: NoteContext | null }
  | { kind: "removeItemNote"; designation: string; noteId: string }
  | { kind: "addFreeNote"; noteId: string; text: string; context?: NoteContext | null }
  | { kind: "removeFreeNote"; noteId: string }
  | { kind: "closeSession" };

/** `id` identifie l'operation dans la file (pour la retirer une fois
 * acceptee), `at` est l'heure de saisie cote client : c'est elle qui
 * horodate la note tant qu'elle n'est pas partie, remplacee par celle du
 * serveur a la synchronisation. */
export type SessionOp = SessionOpBody & { id: string; at: string };

/** Identifiant local d'operation ou de note en attente. `crypto.randomUUID`
 * n'existe pas hors contexte securise (http:// sur le LAN, typiquement le
 * telephone qui teste le serveur de dev) : repli sur un identifiant
 * aleatoire simple, qui n'a besoin d'etre unique que dans cette file. */
export function localId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `loc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Une note creee localement se reconnait a son id : tant qu'elle n'est pas
 * partie, l'ecran l'affiche en attente (voir `pendingNoteIds`). */
const LOCAL_NOTE_PREFIX = "local:";

export function localNoteId(): string {
  return LOCAL_NOTE_PREFIX + localId();
}


/** Heure locale au format ISO sans fuseau ("2026-09-21T21:05:00"), comme
 * l'ecrit le serveur (`datetime.isoformat()` sur l'heure du site, voir
 * sessions.py).
 *
 * `toISOString()` donnerait de l'UTC suffixe d'un "Z" : l'affichage serait
 * juste, mais pas le tri. Le fil chronologique compare les horodatages
 * comme des chaines (voir `rebuildTimeline`), donc melanger "19:00:00.000Z"
 * et "21:00:00" rangerait une note en attente deux heures trop tot. La date
 * de la nuit a la cloture souffrirait du meme decalage apres minuit.
 *
 * Les millisecondes sont completees a six chiffres pour la meme raison :
 * Python ecrit des microsecondes, et comparees comme des chaines,
 * "17:04:05" passerait avant "17:04:05.123456" -- une note saisie dans la
 * meme seconde qu'une autre se rangerait avant elle. */
export function localIsoNow(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  return `${date}T${time}.${String(now.getMilliseconds()).padStart(3, "0")}000`;
}

/** Complete un geste avec son identite, son heure de saisie et -- pour une
 * note -- les conditions annoncees a cette heure-la.
 *
 * Le contexte est releve ici plutot que par l'appelant pour qu'il porte
 * exactement l'horodatage de l'operation, et pour qu'aucun point de saisie
 * ne puisse l'oublier. */
export function newOp(body: SessionOpBody): SessionOp {
  const at = localIsoNow();
  const op = { ...body, id: localId(), at };
  if ((op.kind === "addItemNote" || op.kind === "addFreeNote") && op.context === undefined) {
    return { ...op, context: captureContext(at) };
  }
  return op;
}

// --- Detection d'une cible en tete de note ----------------------------

/** Une note qui commence par une designation ("M31 tres contraste ce soir")
 * parle de cette cible : elle lui est rattachee plutot que posee en note
 * libre. Taper deux caracteres de plus evite d'ouvrir la fiche de la cible
 * pour y saisir la note, ce qui compte a 23h avec les doigts gelés.
 *
 * Volontairement limite aux trois prefixes que portent les catalogues
 * embarques (M, NGC, IC) et a une note non vide : "M31" seul reste une note
 * libre, pour ne pas creer une cible sur un mot isole. */
const TARGET_PREFIX = /^(M|NGC|IC)\s*0*(\d{1,4}[A-Za-z]?)\s+(\S.*)$/i;

/** Met une designation a la forme du catalogue : Messier sans zeros de tete
 * ("M31"), NGC et IC completes a quatre chiffres ("NGC0520", "IC0434").
 *
 * Fait ici plutot que cote serveur parce que la saisie doit marcher hors
 * ligne, sans catalogue sous la main. Sans ca, une note prefixee "ic434"
 * creerait une cible "IC434" a cote de la "IC0434" du catalogue : deux
 * entrees pour le meme objet, et un temps d'expo cumule coupe en deux. */
export function canonicalDesignation(prefix: string, digits: string): string {
  const cat = prefix.toUpperCase();
  const letter = digits.slice(-1).match(/[A-Za-z]/) ? digits.slice(-1).toUpperCase() : "";
  const num = letter ? digits.slice(0, -1) : digits;
  const padded = cat === "M" ? num : num.padStart(4, "0");
  return `${cat}${padded}${letter}`;
}

export interface TargetPrefix {
  designation: string;
  text: string;
}

/** Decoupe "ngc 7380 belle nebuleuse" en cible + note, ou null si la note
 * ne commence pas par une designation. */
export function parseTargetPrefix(input: string): TargetPrefix | null {
  const m = TARGET_PREFIX.exec(input.trim());
  if (!m) return null;
  return { designation: canonicalDesignation(m[1], m[2]), text: m[3].trim() };
}

// --- Application locale (optimiste) -----------------------------------

function rebuildTimeline(cur: CurrentSession): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...cur.items.flatMap((item) =>
      item.notes.map((n) => ({
        id: n.id, at: n.at, text: n.text, target: item.designation, context: n.context,
      })),
    ),
    ...cur.freeNotes.map((n) => ({
      id: n.id, at: n.at, text: n.text, target: null, context: n.context,
    })),
  ];
  entries.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  return entries;
}

export function emptyFeeling(): Feeling {
  return { rating: null, skyQuality: null, highlight: "", nextTime: "" };
}

function isActive(cur: CurrentSession): boolean {
  return cur.items.length > 0 || cur.freeNotes.length > 0;
}

/** Ferme la session si elle est devenue vide, ouvre-la si c'est sa premiere
 * entree -- meme regle que `add_item`/`remove_item` cote serveur.
 * `scoreAtOpen` reste null a l'ouverture locale : le score de la nuit est
 * calcule par l'API, le client ne l'invente pas ; il arrive avec la
 * reponse. */
function reconcileOpen(cur: CurrentSession, at: string): CurrentSession {
  // Vidée de sa derniere entree, la session redevient non ouverte : ni
  // heure, ni score, ni ressenti (meme regle que sessions._close_if_empty).
  if (!isActive(cur)) return { ...cur, openedAt: null, scoreAtOpen: null, feeling: emptyFeeling() };
  if (cur.openedAt === null) return { ...cur, openedAt: at };
  return cur;
}

function withCurrent(data: Sessions, cur: CurrentSession, at: string): Sessions {
  const reconciled = reconcileOpen(cur, at);
  return { ...data, current: { ...reconciled, timeline: rebuildTimeline(reconciled) } };
}

function mapItem(
  cur: CurrentSession,
  designation: string,
  fn: (item: SessionItem) => SessionItem,
): CurrentSession {
  return { ...cur, items: cur.items.map((i) => (i.designation === designation ? fn(i) : i)) };
}

export function applyOp(data: Sessions, op: SessionOp): Sessions {
  const cur = data.current;
  switch (op.kind) {
    case "addItem": {
      if (cur.items.some((i) => i.designation === op.designation)) return data;
      const item: SessionItem = {
        designation: op.designation,
        addedAt: op.at,
        done: false,
        notes: [],
        exposureMin: null,
        rating: null,
      };
      // Triees par designation, comme les renvoie l'API (voir
      // api/translate.sessions_to_out) : en les ajoutant simplement a la
      // suite, une cible s'afficherait en bas de liste puis sauterait a sa
      // place a la synchronisation.
      const items = [...cur.items, item].sort((a, b) =>
        a.designation < b.designation ? -1 : a.designation > b.designation ? 1 : 0,
      );
      return withCurrent(data, { ...cur, items }, op.at);
    }
    case "removeItem":
      return withCurrent(
        data,
        { ...cur, items: cur.items.filter((i) => i.designation !== op.designation) },
        op.at,
      );
    case "setDone":
      return withCurrent(data, mapItem(cur, op.designation, (i) => ({ ...i, done: op.done })), op.at);
    case "setExposure":
      return withCurrent(
        data,
        mapItem(cur, op.designation, (i) => ({ ...i, exposureMin: op.minutes })),
        op.at,
      );
    case "setItemRating":
      return withCurrent(
        data,
        mapItem(cur, op.designation, (i) => ({ ...i, rating: op.rating })),
        op.at,
      );
    case "setFeeling":
      // Champ par champ, comme le serveur : deux saisies successives sur des
      // champs differents ne s'effacent pas l'une l'autre.
      return withCurrent(data, { ...cur, feeling: { ...cur.feeling, ...op.patch } }, op.at);
    case "addItemNote": {
      const note: Note = { id: op.noteId, text: op.text, at: op.at, context: op.context ?? null };
      return withCurrent(
        data,
        mapItem(cur, op.designation, (i) => ({ ...i, notes: [...i.notes, note] })),
        op.at,
      );
    }
    case "removeItemNote":
      return withCurrent(
        data,
        mapItem(cur, op.designation, (i) => ({ ...i, notes: i.notes.filter((n) => n.id !== op.noteId) })),
        op.at,
      );
    case "addFreeNote":
      return withCurrent(
        data,
        {
          ...cur,
          freeNotes: [...cur.freeNotes, {
            id: op.noteId, text: op.text, at: op.at, context: op.context ?? null,
          }],
        },
        op.at,
      );
    case "removeFreeNote":
      return withCurrent(
        data,
        { ...cur, freeNotes: cur.freeNotes.filter((n) => n.id !== op.noteId) },
        op.at,
      );
    case "closeSession": {
      if (!isActive(cur)) return data;
      // Meme resume qu'a la cloture serveur (sessions.close_session) : notes
      // par cible puis notes libres, jointes par "; ". La date de la nuit est
      // celle du serveur (elle tient compte de la nuit selectionnee) ; en
      // local on prend la date du jour, corrigee a la synchronisation.
      const texts = [
        ...cur.items.flatMap((i) => i.notes.map((n) => n.text)),
        ...cur.freeNotes.map((n) => n.text),
      ];
      const entry = {
        date: op.at.slice(0, 10),
        score: cur.scoreAtOpen,
        targets: cur.items.map((i) => i.designation).sort(),
        note: texts.join("; "),
        closedAt: op.at,
        timeline: cur.timeline,
        feeling: cur.feeling,
      };
      return {
        past: [entry, ...data.past],
        current: {
          openedAt: null, scoreAtOpen: null, items: [], freeNotes: [], timeline: [],
          feeling: emptyFeeling(),
        },
      };
    }
  }
}

// --- Empilement --------------------------------------------------------

/** Ajoute `op` a la file, en annulant la paire creation/suppression quand
 * l'utilisateur supprime une note qui n'est pas encore partie.
 *
 * Sans ca, la suppression porterait sur un identifiant local que le serveur
 * n'a jamais vu : cote serveur elle ne supprime rien (voir
 * `remove_item_note`/`remove_free_note`, qui filtrent sans erreur) et la
 * note reapparaitrait a la synchronisation suivante, alors que
 * l'utilisateur l'a effacee. */
export function enqueue(queue: SessionOp[], op: SessionOp): SessionOp[] {
  if (op.kind === "removeItemNote" || op.kind === "removeFreeNote") {
    const addKind = op.kind === "removeItemNote" ? "addItemNote" : "addFreeNote";
    const idx = queue.findIndex((q) => q.kind === addKind && "noteId" in q && q.noteId === op.noteId);
    if (idx !== -1) return [...queue.slice(0, idx), ...queue.slice(idx + 1)];
  }
  return [...queue, op];
}

/** Identifiants des notes encore en attente d'envoi, pour les signaler a
 * l'ecran. */
export function pendingNoteIds(queue: SessionOp[]): Set<string> {
  const ids = new Set<string>();
  for (const op of queue) {
    if (op.kind === "addItemNote" || op.kind === "addFreeNote") ids.add(op.noteId);
  }
  return ids;
}

// --- Persistance locale ------------------------------------------------

// Ecritures tolerantes a un localStorage indisponible (voir storage.ts) :
// le journal continue en memoire, avec pour seule consequence la perte de
// la file si l'onglet est ferme.

export function loadQueue(): SessionOp[] {
  const q = readJson<SessionOp[]>(QUEUE_KEY);
  return Array.isArray(q) ? q : [];
}

export function saveQueue(queue: SessionOp[]): void {
  writeJson(QUEUE_KEY, queue);
}

export function loadCache(): Sessions | null {
  const data = readJson<Sessions>(CACHE_KEY);
  if (!data || typeof data !== "object" || !data.current || !Array.isArray(data.past)) return null;
  return data;
}

export function saveCache(data: Sessions): void {
  writeJson(CACHE_KEY, data);
}
