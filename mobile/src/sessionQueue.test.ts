/** Tests de l'application locale des operations du journal (sessionQueue.ts).
 *
 * C'est la piece risquee du dispositif hors ligne : elle rejoue localement
 * ce que fera `sessions.py`, et une divergence se verrait comme une note qui
 * bouge ou disparait apres synchronisation, en pleine nuit. Les cas couverts
 * sont ceux ou les deux implementations doivent se comporter pareil :
 * ouverture et fermeture implicites de la session, fil chronologique trie,
 * cloture, et annulation d'une note supprimee avant son envoi.
 *
 * Tourne sur le lanceur integre de Node (types effaces nativement), sans
 * framework de test a installer :
 *
 *     npm test        # depuis mobile/
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyOp,
  enqueue,
  localIsoNow,
  newOp,
  parseTargetPrefix,
  pendingNoteIds,
} from "./sessionQueue.ts";
import type { SessionOp, SessionOpBody } from "./sessionQueue.ts";
import type { Sessions } from "./types.ts";

function emptySessions(): Sessions {
  return {
    current: { openedAt: null, scoreAtOpen: null, items: [], freeNotes: [], timeline: [] },
    past: [],
  };
}

/** Operation horodatee explicitement, pour tester le tri du fil. */
function op(body: SessionOpBody, at: string): SessionOp {
  return { ...body, id: `op-${at}`, at };
}

function replay(ops: SessionOp[], from: Sessions = emptySessions()): Sessions {
  return ops.reduce(applyOp, from);
}

test("une note libre ouvre la session et apparait dans le fil", () => {
  const data = replay([op({ kind: "addFreeNote", noteId: "n1", text: "ciel voile" }, "2026-09-21T21:00:00")]);

  assert.equal(data.current.openedAt, "2026-09-21T21:00:00");
  assert.equal(data.current.freeNotes.length, 1);
  assert.deepEqual(
    data.current.timeline.map((e) => [e.target, e.text]),
    [[null, "ciel voile"]],
  );
});

test("le score de la nuit n'est pas invente localement", () => {
  // Il est calcule par l'API a l'ouverture de la session : tant que la
  // reponse n'est pas revenue, l'ecran affiche l'heure sans score.
  const data = replay([op({ kind: "addFreeNote", noteId: "n1", text: "debut" }, "2026-09-21T21:00:00")]);
  assert.equal(data.current.scoreAtOpen, null);
});

test("une note par cible est rattachee a sa cible dans le fil", () => {
  const data = replay([
    op({ kind: "addItem", designation: "M31" }, "2026-09-21T21:05:00"),
    op({ kind: "addItemNote", designation: "M31", noteId: "n1", text: "bonne mise au point" }, "2026-09-21T21:20:00"),
  ]);

  assert.equal(data.current.items.length, 1);
  assert.equal(data.current.items[0].notes.length, 1);
  assert.deepEqual(data.current.timeline.map((e) => e.target), ["M31"]);
});

test("le fil est trie par horodatage, pas par ordre de saisie", () => {
  const data = replay([
    op({ kind: "addItem", designation: "M31" }, "2026-09-21T21:00:00"),
    op({ kind: "addFreeNote", noteId: "n2", text: "tardive" }, "2026-09-21T23:30:00"),
    op({ kind: "addItemNote", designation: "M31", noteId: "n1", text: "precoce" }, "2026-09-21T21:10:00"),
  ]);

  assert.deepEqual(data.current.timeline.map((e) => e.text), ["precoce", "tardive"]);
});

test("les cibles sont triees par designation, comme cote serveur", () => {
  // Sinon la cible ajoutee s'affiche en bas de liste puis saute a sa place
  // des que la reponse du serveur arrive.
  const data = replay([
    op({ kind: "addItem", designation: "M31" }, "2026-09-21T21:00:00"),
    op({ kind: "addItem", designation: "IC0434" }, "2026-09-21T21:05:00"),
    op({ kind: "addItem", designation: "M42" }, "2026-09-21T21:10:00"),
  ]);

  assert.deepEqual(data.current.items.map((i) => i.designation), ["IC0434", "M31", "M42"]);
});

test("ajouter deux fois la meme cible ne la duplique pas", () => {
  const data = replay([
    op({ kind: "addItem", designation: "M31" }, "2026-09-21T21:00:00"),
    op({ kind: "addItem", designation: "M31" }, "2026-09-21T21:02:00"),
  ]);

  assert.equal(data.current.items.length, 1);
  assert.equal(data.current.items[0].addedAt, "2026-09-21T21:00:00");
});

test("retirer la derniere entree referme la session", () => {
  const data = replay([
    op({ kind: "addFreeNote", noteId: "n1", text: "test" }, "2026-09-21T21:00:00"),
    op({ kind: "removeFreeNote", noteId: "n1" }, "2026-09-21T21:01:00"),
  ]);

  assert.equal(data.current.openedAt, null);
  assert.equal(data.current.scoreAtOpen, null);
  assert.deepEqual(data.current.timeline, []);
});

test("retirer une cible laisse la session ouverte s'il reste une note libre", () => {
  const data = replay([
    op({ kind: "addFreeNote", noteId: "n1", text: "buee" }, "2026-09-21T21:00:00"),
    op({ kind: "addItem", designation: "M31" }, "2026-09-21T21:05:00"),
    op({ kind: "removeItem", designation: "M31" }, "2026-09-21T21:06:00"),
  ]);

  assert.equal(data.current.openedAt, "2026-09-21T21:00:00");
  assert.equal(data.current.items.length, 0);
});

test("coche et temps d'expo se posent sur la cible visee", () => {
  const data = replay([
    op({ kind: "addItem", designation: "M31" }, "2026-09-21T21:00:00"),
    op({ kind: "addItem", designation: "M42" }, "2026-09-21T21:01:00"),
    op({ kind: "setDone", designation: "M42", done: true }, "2026-09-21T22:00:00"),
    op({ kind: "setExposure", designation: "M42", minutes: 45 }, "2026-09-21T22:01:00"),
  ]);

  const [m31, m42] = data.current.items;
  assert.equal(m31.done, false);
  assert.equal(m31.exposureMin, null);
  assert.equal(m42.done, true);
  assert.equal(m42.exposureMin, 45);
});

test("la cloture range la sortie dans l'historique et vide la session", () => {
  const data = replay([
    op({ kind: "addItem", designation: "M31" }, "2026-09-21T21:00:00"),
    op({ kind: "addItemNote", designation: "M31", noteId: "n1", text: "nette" }, "2026-09-21T21:30:00"),
    op({ kind: "addFreeNote", noteId: "n2", text: "vent nul" }, "2026-09-21T22:00:00"),
    op({ kind: "closeSession" }, "2026-09-21T23:59:00"),
  ]);

  assert.equal(data.past.length, 1);
  assert.deepEqual(data.past[0].targets, ["M31"]);
  assert.equal(data.past[0].note, "nette; vent nul");
  assert.equal(data.past[0].date, "2026-09-21");
  assert.equal(data.past[0].timeline.length, 2);
  assert.equal(data.current.items.length, 0);
  assert.equal(data.current.openedAt, null);
});

test("cloturer une session vide ne cree pas de sortie", () => {
  const data = replay([op({ kind: "closeSession" }, "2026-09-21T23:59:00")]);
  assert.deepEqual(data.past, []);
});

test("supprimer une note pas encore envoyee annule aussi son envoi", () => {
  // Sinon la suppression porterait sur un identifiant local inconnu du
  // serveur : elle ne supprimerait rien, et la note reviendrait a la
  // synchronisation suivante.
  const add = newOp({ kind: "addFreeNote", noteId: "local:n1", text: "oups" });
  const remove = newOp({ kind: "removeFreeNote", noteId: "local:n1" });

  const queue = enqueue(enqueue([], add), remove);

  assert.deepEqual(queue, []);
});

test("supprimer une note deja envoyee laisse partir la suppression", () => {
  const remove = newOp({ kind: "removeItemNote", designation: "M31", noteId: "serveur-42" });
  const queue = enqueue([], remove);

  assert.equal(queue.length, 1);
  assert.equal(queue[0].kind, "removeItemNote");
});

test("une saisie est horodatee en heure locale, comme le serveur", () => {
  // Le fil trie sur la chaine : un horodatage UTC suffixe "Z" rangerait une
  // note en attente a cote de la plaque des que le fuseau n'est pas UTC.
  const at = localIsoNow(new Date(2026, 8, 21, 21, 5, 30, 4));

  assert.equal(at, "2026-09-21T21:05:30.004000");
  assert.equal(newOp({ kind: "closeSession" }).at.length, at.length);
});

test("dans la meme seconde, une saisie passe apres une note deja enregistree", () => {
  // Cote serveur l'horodatage porte des microsecondes ; sans le meme
  // nombre de chiffres, la comparaison de chaines inverserait les deux.
  const server: Sessions = {
    current: {
      openedAt: "2026-09-21T21:05:30.123456",
      scoreAtOpen: 72,
      items: [],
      freeNotes: [{ id: "s1", text: "deja enregistree", at: "2026-09-21T21:05:30.123456" }],
      timeline: [],
    },
    past: [],
  };
  const pending = [op({ kind: "addFreeNote", noteId: "local:n1", text: "en attente" },
                      localIsoNow(new Date(2026, 8, 21, 21, 5, 30, 500)))];

  const shown = replay(pending, server);

  assert.deepEqual(shown.current.timeline.map((e) => e.text), ["deja enregistree", "en attente"]);
});

test("une note en attente se range au bon endroit parmi les notes du serveur", () => {
  const server: Sessions = {
    current: {
      openedAt: "2026-09-21T21:00:00",
      scoreAtOpen: 72,
      items: [],
      freeNotes: [
        { id: "s1", text: "avant", at: "2026-09-21T21:00:00" },
        { id: "s2", text: "apres", at: "2026-09-21T23:00:00" },
      ],
      timeline: [],
    },
    past: [],
  };
  const pending = [op({ kind: "addFreeNote", noteId: "local:n1", text: "entre les deux" },
                      localIsoNow(new Date(2026, 8, 21, 22, 0, 0)))];

  const shown = replay(pending, server);

  assert.deepEqual(shown.current.timeline.map((e) => e.text), ["avant", "entre les deux", "apres"]);
});

test("les notes en attente sont signalables par leur identifiant", () => {
  const queue = [
    newOp({ kind: "addFreeNote", noteId: "local:n1", text: "a" }),
    newOp({ kind: "addItemNote", designation: "M31", noteId: "local:n2", text: "b" }),
    newOp({ kind: "setDone", designation: "M31", done: true }),
  ];

  assert.deepEqual([...pendingNoteIds(queue)].sort(), ["local:n1", "local:n2"]);
});

test("rejouer la file sur une base serveur ne perd pas les saisies en attente", () => {
  // Cas reel : une note part, la reponse serveur (sans les suivantes)
  // devient la base, et les operations encore en file sont rejouees dessus.
  const server: Sessions = {
    current: {
      openedAt: "2026-09-21T21:00:00",
      scoreAtOpen: 72,
      items: [{ designation: "M31", addedAt: "2026-09-21T21:00:00", done: false, notes: [], exposureMin: null }],
      freeNotes: [],
      timeline: [],
    },
    past: [],
  };
  const pending = [
    op({ kind: "addItemNote", designation: "M31", noteId: "local:n1", text: "en attente" }, "2026-09-21T21:40:00"),
  ];

  const shown = replay(pending, server);

  assert.equal(shown.current.scoreAtOpen, 72);
  assert.deepEqual(shown.current.timeline.map((e) => e.text), ["en attente"]);
});

test("une note prefixee d'une designation est rattachee a la cible", () => {
  assert.deepEqual(parseTargetPrefix("M31 tres contraste ce soir"), {
    designation: "M31",
    text: "tres contraste ce soir",
  });
  assert.deepEqual(parseTargetPrefix("ngc 7380 belle nebuleuse"), {
    designation: "NGC7380",
    text: "belle nebuleuse",
  });
});

test("la designation detectee prend la forme du catalogue", () => {
  // Le catalogue zero-padde NGC et IC a quatre chiffres, pas Messier. Sans
  // ca, "ic434" creerait une cible a cote de la "IC0434" du catalogue :
  // deux entrees pour le meme objet, et un temps d'expo coupe en deux.
  assert.equal(parseTargetPrefix("ic434 flamme nette")?.designation, "IC0434");
  assert.equal(parseTargetPrefix("IC0434 flamme nette")?.designation, "IC0434");
  assert.equal(parseTargetPrefix("m031 bien haute")?.designation, "M31");
  assert.equal(parseTargetPrefix("ic4837a faible")?.designation, "IC4837A");
});

test("une note sans designation en tete reste une note libre", () => {
  assert.equal(parseTargetPrefix("buee sur la lentille"), null);
  assert.equal(parseTargetPrefix("vent de nord-ouest, 15 km/h"), null);
  // Une designation seule ne suffit pas : pas de cible creee sur un mot
  // isole, l'utilisateur voulait peut-etre juste noter le nom.
  assert.equal(parseTargetPrefix("M31"), null);
  assert.equal(parseTargetPrefix("  M31  "), null);
});
