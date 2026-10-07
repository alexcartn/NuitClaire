import { test } from "node:test";
import assert from "node:assert/strict";
import { engravingUrl, LEGENDS } from "./legends.ts";

test("l'adresse de la gravure encode le nom du fichier et demande une largeur", () => {
  const url = engravingUrl("Sidney Hall - Urania's Mirror - Orion (x).jpg");
  assert.ok(url.startsWith("https://commons.wikimedia.org/wiki/Special:FilePath/"));
  assert.ok(!url.includes(" "), url);
  assert.ok(url.endsWith("?width=800"));
  assert.ok(url.includes("Urania's"), url);
});

test("chaque legende a un recit, une source et une origine connue", () => {
  for (const [id, l] of Object.entries(LEGENDS)) {
    assert.ok(l.tagline.length > 0, id);
    assert.ok(l.text.length > 0 && l.text.every((p) => p.trim().length > 40), id);
    assert.ok(l.source.length > 0, id);
    assert.ok(l.origin === "antique" || l.origin === "moderne", id);
  }
});

test("une gravure a des dimensions et une mention, pour reserver la place et crediter", () => {
  for (const [id, l] of Object.entries(LEGENDS)) {
    if (!l.engraving) continue;
    assert.ok(l.engraving.width > 0 && l.engraving.height > 0, id);
    assert.ok(l.engraving.credit.length > 0, id);
    assert.ok(l.engraving.file.endsWith(".jpg"), id);
  }
});

test("les constellations modernes ne racontent pas de mythe", () => {
  for (const [id, l] of Object.entries(LEGENDS)) {
    if (l.origin !== "moderne") continue;
    assert.ok(/pas de l[ée]gende|aucun mythe|sans mythe/i.test(`${l.tagline} ${l.text.join(" ")}`), id);
  }
});
