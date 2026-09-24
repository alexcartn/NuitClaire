/* Service worker de NuitClaire : rend l'appli ouvrable sans reseau.
 *
 * Le journal se remplit dehors, ou la connexion manque souvent. La file
 * d'attente cote appli (src/sessionQueue.ts) conserve deja les saisies, mais
 * elle ne sert a rien si l'appli elle-meme ne se charge pas : ce worker met
 * en cache la coquille (page, JS, CSS, polices, icones) pour que
 * l'ouverture depuis l'ecran d'accueil fonctionne hors ligne.
 *
 * Ecrit a la main plutot que genere par vite-plugin-pwa : la strategie tient
 * en quelques dizaines de lignes et le projet tient a une empreinte de
 * dependances minimale (voir l'en-tete de src/useFetch.ts). Les deux
 * constantes ci-dessous sont reecrites au build par le plugin
 * `swPrecache` (vite.config.ts) avec la liste reelle des fichiers produits :
 * sans ca, le worker ne mettrait les assets en cache qu'a la deuxieme
 * visite, et un rechargement hors ligne entre les deux afficherait une page
 * blanche.
 *
 * Ce qui n'est jamais mis en cache : les appels a l'API (le journal et la
 * meteo doivent etre frais, et les ecritures ne passent pas par ici) et tout
 * ce qui vient d'un autre domaine (vignettes DSS2 du CDS, API deployee sur
 * son propre domaine) -- ces requetes ne sont pas interceptees du tout. */
// Reecrites au build (voir swPrecache dans vite.config.ts). Les valeurs
// ci-dessous ne servent qu'a garder ce fichier valide tel quel.
const BUILD = "dev";
const PRECACHE = ["/index.html", "/manifest.webmanifest"];

const CACHE = `nuitclaire-${BUILD}`;
const OFFLINE_URL = "/index.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
  // Pas de skipWaiting ici : une nouvelle version qui prend la main toute
  // seule remplace le code sous les pieds de la page ouverte. L'appli
  // propose de recharger et n'active la nouvelle version qu'a ce
  // moment-la (voir src/pwa.ts), pour ne pas couper une note en cours de
  // frappe. Sur la toute premiere installation il n'y a pas d'ancienne
  // version : le worker s'active directement, sans rien attendre.
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin || url.pathname.startsWith("/api/")) return;

  // Navigation : reseau d'abord (pour prendre une nouvelle version de
  // l'appli des qu'elle existe), page en cache en repli hors ligne.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(OFFLINE_URL, copy));
          return res;
        })
        .catch(() =>
          caches.match(OFFLINE_URL, { ignoreVary: true }).then((r) => r || Response.error()),
        ),
    );
    return;
  }

  // Ressources statiques : cache d'abord, revalidation en fond. Les noms de
  // fichiers produits par Vite portent un hash, donc une version servie
  // depuis le cache n'est jamais perimee au mauvais sens du terme.
  // `ignoreVary` : le serveur peut repondre avec `Vary: Origin` (c'est le cas
  // de `vite preview`), auquel cas une entree en cache ne serait retrouvee
  // que pour une requete portant le meme en-tete `Origin` -- ce qui fait
  // manquer le cache au rechargement et rend la page blanche hors ligne. Le
  // contenu ne depend pas de l'origine ici : on ignore la variation.
  event.respondWith(
    caches.match(request, { ignoreVary: true }).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res.ok || res.type === "opaque") {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => cached || Response.error());
      return cached || network;
    }),
  );
});

/* Notifications push (voir alerts.py et src/push.ts). Le serveur envoie un
 * JSON {title, body, url, tag} ; `tag` remplace une notification de la meme
 * nuit au lieu d'en empiler deux. */
self.addEventListener("push", (event) => {
  let msg = { title: "NuitClaire", body: "", url: "/", tag: undefined };
  try {
    if (event.data) msg = { ...msg, ...event.data.json() };
  } catch {
    if (event.data) msg.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(msg.title, {
      body: msg.body,
      tag: msg.tag,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: msg.url || "/" },
      lang: "fr",
    }),
  );
});

// Toucher la notification ramene l'appli au premier plan si elle est deja
// ouverte, l'ouvre sinon.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) return open.focus();
      return self.clients.openWindow(url);
    }),
  );
});
