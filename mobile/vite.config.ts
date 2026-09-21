import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/** Injecte dans `public/sw.js`, apres le build, la liste reelle des fichiers
 * produits et un identifiant de version.
 *
 * Le service worker est ecrit a la main (voir son en-tete) plutot que genere
 * par vite-plugin-pwa, mais il ne peut pas deviner les noms de fichiers
 * emis par Vite, qui portent un hash. Sans cette liste, il ne mettrait les
 * assets en cache qu'a la visite suivante : un rechargement hors ligne
 * entre-temps afficherait une page blanche, exactement le cas qu'on veut
 * couvrir. L'identifiant de version (hash de la liste) nomme le cache, ce
 * qui purge l'ancien a chaque deploiement.
 *
 * Les tailles en jeu sont celles d'une petite appli (une page, un bundle,
 * trois icones) : tout precharger est plus simple et plus sur qu'une
 * strategie selective. */
function swPrecache(): Plugin {
  return {
    name: "nuitclaire-sw-precache",
    apply: "build",
    closeBundle() {
      const dist = join(__dirname, "dist");
      const swPath = join(dist, "sw.js");

      const walk = (dir: string): string[] =>
        readdirSync(dir).flatMap((name) => {
          const full = join(dir, name);
          return statSync(full).isDirectory() ? walk(full) : [full];
        });

      const files = walk(dist)
        .map((f) => "/" + relative(dist, f).split(sep).join("/"))
        .filter((url) => url !== "/sw.js")
        .sort();

      const build = createHash("sha256").update(files.join("|")).digest("hex").slice(0, 12);
      const source = readFileSync(swPath, "utf-8")
        .replace(/^const BUILD = .*$/m, `const BUILD = ${JSON.stringify(build)};`)
        .replace(/^const PRECACHE = .*$/m, `const PRECACHE = ${JSON.stringify(files)};`);
      writeFileSync(swPath, source);
    },
  };
}

export default defineConfig({
  plugins: [react(), swPrecache()],
  server: {
    host: true, // expose sur le LAN pour tester depuis un telephone
    port: 5173,
  },
});
