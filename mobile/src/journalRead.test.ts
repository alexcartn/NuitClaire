/** Tests des vues de relecture (journalRead.ts) : historique d'une cible et
 * export Markdown. Deux vues derivees du journal, donc entierement
 * verifiables sans navigateur ni API.
 *
 *     npm test        # depuis mobile/
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { journalToMarkdown, outingToMarkdown, targetHistory } from "./journalRead.ts";
import type { Feeling, PastSession, SessionItem, Sessions } from "./types.ts";

const noFeeling: Feeling = { rating: null, skyQuality: null, highlight: "", nextTime: "" };

function item(designation: string, over: Partial<SessionItem> = {}): SessionItem {
  return {
    designation,
    addedAt: "2026-09-21T21:00:00.000000",
    done: false,
    notes: [],
    exposureMin: null,
    rating: null,
    ...over,
  };
}

function outing(date: string, over: Partial<PastSession> = {}): PastSession {
  return {
    date,
    score: 80,
    targets: [],
    note: "",
    closedAt: `${date}T23:59:00.000000`,
    items: [],
    timeline: [],
    feeling: noFeeling,
    conditions: null,
    ...over,
  };
}

function journal(past: PastSession[], current: Partial<Sessions["current"]> = {}): Sessions {
  return {
    current: {
      openedAt: null, scoreAtOpen: null, items: [], freeNotes: [], timeline: [],
      feeling: noFeeling, ...current,
    },
    past,
  };
}

test("l'historique d'une cible rassemble toutes les nuits ou elle a ete pointee", () => {
  const data = journal([
    outing("2026-09-20", {
      targets: ["M31"],
      items: [item("M31", { exposureMin: 30, rating: 4, done: true,
                            notes: [{ id: "n1", text: "bien haute", at: "2026-09-20T22:00:00", context: null }] })],
    }),
    outing("2026-08-12", { targets: ["M31", "M42"], items: [item("M31", { exposureMin: 45, rating: 2 })] }),
    outing("2026-07-01", { targets: ["M42"], items: [item("M42")] }),
  ]);

  const h = targetHistory(data, "M31");

  assert.equal(h.nightCount, 2);
  assert.equal(h.totalExposureMin, 75);
  assert.equal(h.avgRating, 3);
  assert.deepEqual(h.nights.map((n) => n.date), ["2026-09-20", "2026-08-12"]);
  assert.deepEqual(h.nights[0].notes.map((n) => n.text), ["bien haute"]);
});

test("la session en cours compte comme une nuit, en tete", () => {
  const data = journal(
    [outing("2026-09-20", { targets: ["M31"], items: [item("M31", { exposureMin: 30 })] })],
    { items: [item("M31", { exposureMin: 10 })], openedAt: "2026-09-21T21:00:00" },
  );

  const h = targetHistory(data, "M31");

  assert.equal(h.nightCount, 2);
  assert.equal(h.nights[0].date, null, "la sortie en cours n'a pas encore de date");
  assert.equal(h.totalExposureMin, 40);
});

test("une cible jamais pointee n'invente pas d'historique", () => {
  const h = targetHistory(journal([outing("2026-09-20")]), "NGC7000");
  assert.deepEqual(h, {
    designation: "NGC7000", nights: [], nightCount: 0, totalExposureMin: 0, avgRating: null,
  });
  assert.equal(targetHistory(null, "M31").nightCount, 0);
});

test("l'export d'une nuit reprend conditions, cibles, fil et ressenti", () => {
  const md = outingToMarkdown(outing("2026-09-21", {
    targets: ["M31"],
    items: [item("M31", { exposureMin: 30 })],
    conditions: {
      tempMinC: 6.1, tempMaxC: 9.4, cloudAvgPct: 5, seeingAvg: 2,
      transparencyAvg: 2, dewSpreadC: 1.5, moonIllum: 77,
    },
    timeline: [{
      id: "n1", at: "2026-09-21T22:40:00", text: "ca bave un peu", target: "M31",
      context: { temperatureC: 8.2, cloudCoverPct: 5, seeing: 3, transparency: 2, score: 0.8, moonIllum: 77 },
    }],
    feeling: { rating: 4, skyQuality: 2, highlight: "premiere lumiere", nextTime: "arriver plus tot" },
    note: "belle soiree",
  }));

  assert.match(md, /## lundi 21 septembre 2026/);
  assert.match(md, /score 80\/100/);
  assert.match(md, /6,1 a 9,4 °C/);
  assert.match(md, /Lune 77 %/);
  assert.match(md, /\*\*Temps de pose\.\*\* M31 30 min/);
  assert.match(md, /22:40 · \*\*M31\*\* : ca bave un peu/);
  assert.match(md, /8,2 °C · 5 % nuages · seeing 3/);
  assert.match(md, /satisfaction 4\/5 · ciel percu 2\/5/);
  assert.match(md, /premiere lumiere/);
  assert.match(md, /> belle soiree/);
});

test("l'export n'ecrit pas les rubriques qui n'ont rien a dire", () => {
  const md = outingToMarkdown(outing("2026-09-21"));
  assert.doesNotMatch(md, /Temps de pose/);
  assert.doesNotMatch(md, /Journal de la nuit/);
  assert.doesNotMatch(md, /satisfaction/);
  assert.match(md, /## lundi 21 septembre 2026/);
});

test("l'export complet garde l'ordre du journal et ignore la session en cours", () => {
  const data = journal(
    [outing("2026-09-20"), outing("2026-08-12")],
    { items: [item("M31")], openedAt: "2026-09-21T21:00:00" },
  );

  const md = journalToMarkdown(data, "Marson");

  assert.match(md, /# Carnet d'observation/);
  assert.match(md, /2 sortie\(s\) · Marson/);
  // `toLocaleDateString("fr-FR")` accentue les mois : « août », pas « aout ».
  assert.ok(md.indexOf("20 septembre") < md.indexOf("12 août"), "la plus recente en tete");
  assert.doesNotMatch(md, /Session en cours/);
});
