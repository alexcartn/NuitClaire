import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { engravingOf, engravingUrl, LEGENDS, PLATES, plateCredit, typo } from "./legends.ts";

const skyData = JSON.parse(readFileSync(new URL("./skyData.json", import.meta.url), "utf8")) as { constellations: { id: string }[] };
const IDS = [...new Set(skyData.constellations.map((c) => c.id))];

test("chaque constellation de la carte a sa legende, et rien d'autre", () => {
  assert.equal(IDS.length, 88);
  assert.deepEqual(IDS.filter((id) => !LEGENDS[id]), [], "constellations sans légende");
  assert.deepEqual(Object.keys(LEGENDS).filter((id) => !IDS.includes(id)), [], "légendes d'une constellation inconnue");
});

test("l'adresse de la gravure encode le nom du fichier et demande une largeur", () => {
  const url = engravingUrl("Sidney Hall - Urania's Mirror - Orion (x).jpg");
  assert.ok(url.startsWith("https://commons.wikimedia.org/wiki/Special:FilePath/"));
  assert.ok(!url.includes(" "), url);
  assert.ok(url.endsWith("?width=800"));
  assert.ok(url.includes("Urania's"), url);
  assert.ok(engravingUrl("x.png", 500).endsWith("?width=500"));
});

test("chaque legende a un recit, une source et une origine connue", () => {
  for (const [id, l] of Object.entries(LEGENDS)) {
    assert.ok(l.tagline.length > 0, id);
    assert.ok(l.text.length > 0 && l.text.every((p) => p.trim().length > 30), `${id} : paragraphe trop court`);
    assert.ok(l.source.length > 0, id);
    assert.ok(l.origin === "antique" || l.origin === "moderne", id);
  }
});

test("pas de tiret cadratin ni de texte oublie dans les legendes", () => {
  for (const [id, l] of Object.entries(LEGENDS)) {
    const all = [l.tagline, l.source, ...l.text].join(" ");
    assert.ok(!/—|TODO|XXX|\?\?/.test(all), id);
    assert.ok(l.text.every((p) => p === p.trim() && !/\s{2,}/.test(p)), `${id} : espaces en trop`);
  }
});

test("une legende moderne donne le createur et une date, pas un mythe", () => {
  const moderne = Object.entries(LEGENDS).filter(([, l]) => l.origin === "moderne");
  assert.ok(moderne.length >= 30);
  for (const [id, l] of moderne) {
    assert.ok(/1[5-8]\d\d/.test(l.source), `${id} : pas de date dans la source « ${l.source} »`);
    assert.ok(/(Lacaille|Hevelius|Keyser|Plancius)/.test(l.source), `${id} : pas de créateur`);
  }
});

test("une legende antique cite ses sources", () => {
  for (const [id, l] of Object.entries(LEGENDS).filter(([, x]) => x.origin === "antique")) {
    assert.ok(/(Ovide|Hygin|Ératosthène|Aratos|Hésiode|Apollodore|Apollonios|Callimaque|Ptolémée|tradition gréco-latine)/.test(l.source), `${id} : source « ${l.source} »`);
  }
});

test("chaque planche citee existe, avec des dimensions et un titre", () => {
  for (const [id, l] of Object.entries(LEGENDS)) {
    if (!l.plate) continue;
    assert.ok(PLATES[l.plate], `${id} : planche « ${l.plate} » inconnue`);
  }
  for (const [key, p] of Object.entries(PLATES)) {
    assert.ok(p.width > 0 && p.height > 0, key);
    assert.ok(p.title.length > 0, key);
    assert.ok(/\.(jpe?g|png)$/.test(p.file), key);
    assert.ok(p.source === "urania" || p.source === "bayer", key);
  }
});

test("toutes les planches servent a une legende", () => {
  const used = new Set(Object.values(LEGENDS).map((l) => l.plate));
  assert.deepEqual(Object.keys(PLATES).filter((k) => !used.has(k)), []);
});

test("les constellations sans gravure sont connues et peu nombreuses", () => {
  const sans = Object.entries(LEGENDS).filter(([, l]) => !l.plate).map(([id]) => id).sort();
  // Autel, Croix du Sud et sept constellations de Lacaille : aucune gravure du domaine public trouvee.
  assert.deepEqual(sans, ["Ara", "Cir", "Cru", "Hor", "Men", "Nor", "Oct", "Pic", "Ret"]);
});

test("la mention sous l'image dit l'auteur, l'ouvrage et la planche", () => {
  const ori = engravingOf(LEGENDS.Ori)!;
  assert.match(ori.credit, /Sidney Hall/);
  assert.match(ori.credit, /Urania's Mirror \(1824\)/);
  assert.match(ori.credit, /Orion/);
  const gru = engravingOf(LEGENDS.Gru)!;
  assert.match(gru.credit, /Bayer/);
  assert.match(gru.credit, /Uranometria/);
  assert.equal(engravingOf(LEGENDS.Ara), null);
  assert.ok(plateCredit(PLATES.lyr).includes("Lézard"));
});

test("la planche en PNG, trop lourde a pleine taille, est demandee plus petite", () => {
  const sgr = engravingOf(LEGENDS.Sgr)!;
  assert.ok(sgr.file.endsWith(".png"));
  assert.equal(sgr.thumbWidth, 500);
  assert.ok(engravingUrl(sgr.file, sgr.thumbWidth).endsWith("?width=500"));
});

test("les developpements d'une legende sont bien formes, dans l'ordre, sans doublon", () => {
  const ordre = ["origines", "etoiles", "histoire"];
  for (const [id, l] of Object.entries(LEGENDS)) {
    if (!l.details) continue;
    const kinds = l.details.map((d) => d.kind);
    assert.deepEqual(kinds, ordre.filter((k) => kinds.includes(k as never)), `${id} : ordre ou doublon`);
    for (const d of l.details) {
      assert.ok(d.text.length > 0 && d.text.every((p) => p.trim().length > 40), `${id}/${d.kind} : paragraphe trop court`);
      assert.ok(!/—|TODO|XXX|\?\?/.test(d.text.join(" ")), `${id}/${d.kind}`);
      assert.ok(d.text.every((p) => p === p.trim() && !/\s{2,}/.test(p)), `${id}/${d.kind} : espaces en trop`);
    }
  }
});

test("la typographie francaise colle guillemets et signes doubles au mot voisin", () => {
  assert.equal(typo("le « ceinturon » : fin ; non ? si !"), "le «\u00a0ceinturon\u00a0»\u00a0: fin\u00a0; non\u00a0? si\u00a0!");
  assert.equal(typo("rien à changer"), "rien à changer");
});
