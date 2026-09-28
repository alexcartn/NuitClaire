import { test } from "node:test";
import assert from "node:assert/strict";
import { inTheNews, mentionsOf, mustSee, orderForTonight, sinceLabel, visibility, type Tonight } from "./newsView.ts";
import type { NewsItem, NewsObject, TargetRow } from "./types";

const NOW = new Date("2026-09-28T18:00:00Z");
const target = (designation: string, ngc: string | null = null, messier: string | null = null): NewsObject =>
  ({ kind: "target", designation, label: designation, ngc, messier });
const planet = (name: string): NewsObject => ({ kind: "planet", designation: name, label: name, ngc: null, messier: null });
const article = (title: string, objects: NewsObject[], date = "2026-09-20T10:00:00+00:00", kind: NewsItem["kind"] = "observer") =>
  ({ title, link: `https://ex/${title}`, source: "X", date, summary: "", image: null, kind, objects }) as NewsItem;
const row = (designation: string, start: string | null, extra: Partial<TargetRow> = {}) =>
  ({ designation, ngc: null, messierId: null, start, end: start ? "03:00" : null, ...extra }) as TargetRow;

const tonight: Tonight = {
  targets: [row("NGC7331", "21:10"), row("NGC0224", "20:00", { ngc: "NGC0224", messierId: "31" }), row("NGC2748", null)],
  planets: [{ name: "Saturne", from: "2026-09-28T19:50:00", to: "2026-09-29T04:30:00" }] as Tonight["planets"],
  comets: null,
};

test("un objet du catalogue se retrouve par son nom, son NGC ou son numero Messier", () => {
  assert.deepEqual(visibility(target("NGC7331"), tonight), { text: "visible 21:10–03:00", visible: true });
  assert.equal(visibility(target("M31", "NGC0224", "31"), tonight)?.visible, true);
  assert.equal(visibility(target("NGC2748"), tonight)?.visible, false);
  assert.equal(visibility(planet("Neptune"), tonight), null);
});

test("a ne pas manquer : objets rares visibles d'abord, planetes seulement a defaut", () => {
  const items = [
    article("Saturne a l'opposition", [planet("Saturne")]),
    article("Supernova dans NGC 7331", [target("NGC7331")]),
    article("Supernova dans NGC 2748", [target("NGC2748")]),
    article("Vieille supernova", [target("NGC7331")], "2026-07-01T10:00:00+00:00"),
    article("Lancement", [target("NGC7331")], "2026-09-27T10:00:00+00:00", "espace"),
  ];
  assert.deepEqual(mustSee(items, tonight, NOW).map((m) => m.item.title), ["Supernova dans NGC 7331"]);
  assert.deepEqual(mustSee(items.slice(0, 1), tonight, NOW).map((m) => m.object.label), ["Saturne"]);
});

test("les articles d'une fiche et le badge du plan de nuit", () => {
  const items = [article("Supernova dans NGC 7331", [target("NGC7331")]), article("Andromede", [target("M31", "NGC0224", "31")])];
  assert.equal(mentionsOf(items, { designation: "NGC0224", ngc: "NGC0224", messierId: "31" }, NOW)[0].title, "Andromede");
  assert.deepEqual([...inTheNews(items, tonight.targets!, NOW)].sort(), ["NGC0224", "NGC7331"]);
});

test("ce qui se voit ce soir passe en tete, la science en dernier", () => {
  const items = [
    article("Science recente", [], "2026-09-27T10:00:00+00:00", "espace"),
    article("A observer sans objet", [], "2026-09-26T10:00:00+00:00"),
    article("Supernova dans NGC 7331", [target("NGC7331")], "2026-09-06T10:00:00+00:00"),
  ];
  assert.deepEqual(orderForTonight(items, tonight).map((i) => i.title),
    ["Supernova dans NGC 7331", "A observer sans objet", "Science recente"]);
});

test("fraicheur des actualites", () => {
  assert.equal(sinceLabel("2026-09-28T17:59:30Z", NOW), "à l'instant");
  assert.equal(sinceLabel("2026-09-28T17:35:00Z", NOW), "il y a 25 min");
  assert.equal(sinceLabel("2026-09-28T16:00:00Z", NOW), "il y a 2 h");
});
