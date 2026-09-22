# Seestar Planner

Planificateur de sessions Seestar S50 : score astro go/no-go, cibles filtrees par direction
degagee et par nuit, suivi de completion du catalogue Messier (110 objets).

## Installation

    pip install -r requirements.txt -r requirements-dev.txt
    python scripts/build_catalog.py   # optionnel : les CSV sont deja commits, ce script les regenere depuis OpenNGC
    streamlit run app.py

L'appli a besoin d'un acces internet (Open-Meteo, 7Timer, Nominatim). En cas de coupure,
les prevision 7Timer se degradent proprement (seeing/transparence neutres) mais Open-Meteo
est requis pour demarrer.

## Tests

    pytest -v

## Appli mobile (React) + API (FastAPI)

Un second frontend, `mobile/`, reproduit une partie du tableau de bord dans une mise en page
mobile-native (voir le design `NuitClaire Mobile.dc.html`) ; il parle a une petite API REST,
`api/`, qui reutilise directement les memes modules Python que `app.py` (aucun calcul duplique).

Les 7 ecrans de la maquette sont implementes : "Ce soir", "Cibles", "Detail cible",
"Catalogue Messier", "Recherche", "Reglages" (position/geocodage, horizon, mode de fenetre,
alertes -- toutes editables) et "Journal" (session en cours + historique). Connu comme
incomplet : les alertes sont enregistrees mais rien ne les envoie reellement (pas
d'infrastructure de notification) ; "Ma position" prend les coordonnees GPS sans geocodage
inverse (pas de nom d'adresse) ; cote tests JS, seule la logique hors ligne du journal est
couverte (`mobile/src/sessionQueue.test.ts`), le reste des ecrans est verifie a la main
via Playwright.

"Cibles" et "Catalogue Messier" ont un filtre magnitude (curseur a deux poignees, mini et
maxi independants -- `RangeSlider` cote mobile, `st.slider` en mode plage cote Streamlit)
en plus du filtre par type -- calcule cote client sur les lignes deja chargees, pas
d'appel API supplementaire.

L'onglet/ecran "Ce soir" affiche une carte Temperature (temperature exterieure actuelle
et plage mini/maxi de la nuit -- pour savoir d'un coup d'oeil s'il faut un manteau, sans
ouvrir "Details meteo"), calculee par `scoring.temperature_range` sur la fenetre
d'affichage active (Habituelle ou Nuit complete) et exposee via `GET /api/night`.

La recherche par designation est en auto-detection (`catalog.search_prefix` + `GET
/api/search/suggest`) : plus besoin de valider, les resultats (jusqu'a 8, legers --
sans fenetre de visibilite) s'affichent au fur et a mesure de la frappe, avec un
debounce de 300ms cote mobile et une reactivite native (`st.text_input` hors formulaire)
cote Streamlit. Recherche par prefixe, pas par nom courant (couverture OpenNGC trop
partielle) ; la designation exacte (`catalog.find_target`, `GET /api/search`) reste
utilisee pour l'ajout direct au journal de session.

### Fenetre d'observation personnalisable

Les horaires de la fenetre "Habituelle" (par defaut 20h-22h30, `config.VIEW_WINDOW`) sont
editables dans Reglages (mobile, persiste dans `settings.json`/Supabase, `view_window`)
ou dans la barre laterale (Streamlit, ephemere en session -- meme choix deliberement
divergent que le site, voir l'en-tete de `settings.py`). Le mode de fenetre s'applique
desormais de facon coherente partout dans l'appli : cibles faisables, Catalogue Messier
(avant, il l'ignorait volontairement -- changement demande) et la bande "pointable" du
graphe d'altitude de la fiche detail (`scoring.in_observation_window`, partage par les
deux frontends). En mode "Nuit complete" (par defaut), rien de tout ca ne change.

### Journal hors ligne

Le journal se remplit a chaud, dehors, ou le reseau est souvent faible ou absent. Une
saisie n'attend donc plus l'aller-retour serveur : elle s'affiche immediatement et part
en fond (`mobile/src/sessionQueue.ts` pour la file et l'application locale,
`sessionStore.ts` pour l'envoi et l'etat partage entre ecrans). Une saisie qui ne passe
pas reste dans une file persistee sur l'appareil, est signalee "en attente" a l'ecran, et
repart automatiquement au retour du reseau (reessais avec temporisation croissante, plus
un essai immediat sur les evenements `online` et retour au premier plan). Un refus du
serveur (4xx) abandonne l'operation au lieu de bloquer les suivantes.

L'etat affiche est toujours le dernier etat serveur connu plus les operations en attente
rejouees par-dessus : pas d'annulation a rattraper, et la reponse du serveur (qui contient
le journal complet) devient la nouvelle base sans requete supplementaire -- chaque saisie
coute un aller-retour au lieu de deux. Les valeurs que le client ne peut pas connaitre
(score de la nuit, identifiants et horodatages de notes cotes serveur) ne sont pas
inventees localement : elles arrivent avec la reponse.

    cd mobile
    npm test          # logique hors ligne du journal (lanceur de tests integre a Node)

### Contexte et ressenti

Deux ajouts qui transforment le log en carnet, sans jamais fabriquer de donnee
(voir l'en-tete de `sessions.py`).

Chaque note emporte les conditions annoncees a l'heure ou elle a ete ecrite :
temperature, nuages, seeing, transparence, score horaire, Lune. Ce n'est pas une
mesure, c'est ce que la prevision de l'appli affichait a ce moment-la -- jusqu'ici
calcule pour "Ce soir" puis jete. Le releve est fait cote client
(`mobile/src/nightContext.ts`) dans la prevision de la nuit deja gardee sur
l'appareil : il marche donc hors ligne, et une note ecrite a 22h40 garde les
conditions de 22h40 meme si elle part a 1h du matin. Sans prevision sous la main,
le contexte reste vide plutot qu'approche.

Cela a demande de corriger un defaut au passage : les saisies etaient horodatees a
leur arrivee sur le serveur, pas a leur ecriture. Une note faite hors ligne portait
donc l'heure de la synchronisation, et le fil de la nuit se retrouvait dans le
desordre. Le client envoie desormais son heure de saisie (`at`), le serveur
l'honore, et retombe sur la sienne si elle manque (chemin Streamlit) ou est
illisible.

A la cloture, un resume fige la vue d'ensemble que le detail par note ne donne pas :
temperatures mini/maxi, nuages et seeing moyens, plus petit ecart au point de rosee,
Lune (`conditionsBetween`). Borne a la duree de la sortie, pas a la nuit entiere : ce
qui s'est passe apres le rangement du materiel ne la raconte pas.

Une sortie est desormais datee par son ouverture et non par sa cloture : une nuit se
nomme par le soir ou elle commence, et on la cloture souvent apres minuit -- la dater
du jour de cloture la decalait d'un jour.

Le ressenti est, lui, de la saisie pure : satisfaction et qualite de ciel percue de
1 a 5, plus "ce que je retiens" et "a refaire autrement". La qualite de ciel percue
est volontairement distincte du score calcule -- c'est l'ecart entre les deux qui
interesse. S'y ajoute une satisfaction par cible. Le tout suit la sortie a la
cloture, reste modifiable ensuite (`set_past_feeling` : on rentre rarement remplir
"ce que je retiens" avant d'avoir range le materiel), et `stats.py` en tire une
satisfaction moyenne (`avgRating`), qui ne compte que les sorties notees.

Cote Streamlit, `app.py` continue de fonctionner sans changement mais n'affiche ni
contexte ni ressenti : l'ecart entre les deux frontends reste a arbitrer (voir
l'en-tete de `settings.py` pour un precedent assume).

Une cible ajoutee au journal est desormais resolue dans le catalogue : refusee s'il
ne la connait pas, et enregistree sous sa forme canonique (`ic434` -> `IC0434`).
Depuis que le journal detecte une designation en tete de note, une faute de frappe
creerait sinon une cible fantome, qui polluerait durablement historique et
statistiques. Le texte, lui, n'est jamais perdu : la note refusee est reposee en
note libre avec la designation en tete (`sessionStore.rescueNote`).

### Relecture : fiche par cible et export

Deux vues derivees du journal deja present sur l'appareil
(`mobile/src/journalRead.ts`) : aucune requete, rien de stocke en plus, et
donc disponibles hors ligne comme le reste.

La fiche d'une cible affiche ce que le journal en dit deja : les nuits ou elle a
ete pointee, le temps de pose cumule, la satisfaction moyenne et les notes de
chaque nuit. C'est la question qu'on se pose en rouvrant une fiche ("je l'ai deja
faite ? qu'est-ce que j'en avais dit ?"), a laquelle les statistiques ne
repondaient qu'a moitie. Les cibles d'une sortie passee sont cliquables pour y
aller directement.

L'export produit du Markdown, une nuit ou le carnet entier : en-tete, conditions,
cibles et temps de pose, fil horodate avec le contexte de chaque note, ressenti.
Telechargement local via un Blob, sans reseau. Les rubriques vides ne sont pas
ecrites : une nuit sans ressenti n'a pas de section ressenti.

Cela a demande d'exposer le detail des cibles d'une sortie passee dans
`PastSessionOut` : `targets` n'en donnait que les noms, ce qui ne suffit ni pour
relire une nuit ni pour reconstituer l'historique d'une cible.

### Appli installable

`mobile/public/manifest.webmanifest` et un service worker ecrit a la main
(`mobile/public/sw.js`, liste de prechargement injectee au build par le plugin
`swPrecache` de `vite.config.ts`) font de NuitClaire une appli posee sur l'ecran
d'accueil, qui demarre sans reseau. Les icones viennent de
`python scripts/build_icons.py`. Ce qui a suivi pour que ce soit vraiment une appli et
pas une page web deguisee :

- proposition d'installation dans Reglages (`src/pwa.ts`) : la boite du navigateur en un
  appui sur Chromium, et sur iOS -- qui n'expose aucune API -- la marche a suivre en
  clair, les deux masquees une fois l'appli installee ;
- mise a jour proposee, jamais imposee : le nouveau service worker reste en attente
  (`SKIP_WAITING` sur demande) et un bandeau propose de recharger. Une prise de controle
  automatique remplacerait le code sous les pieds de la page et ferait perdre la note en
  cours de frappe ;
- demarrage a froid hors ligne : `useFetch` garde la derniere reponse reussie sur
  l'appareil (`cacheKey`) et la reaffiche avant meme la requete, avec un avertissement
  date des que le reseau manque (`staleLabel`, `StaleNotice`). Une prevision horaire et
  des fenetres de visibilite sont datees par nature : montrer celles d'hier sans le dire
  ferait pointer une cible qui n'est plus la ;
- raccourci "Journal" (appui long sur l'icone) ouvrant directement le carnet, via
  `/?ecran=journal`.

Les appels a l'API et les ressources d'autres domaines ne sont jamais mis en cache par le
service worker : la fraicheur des donnees est geree dans l'appli, ou l'on sait quoi en
dire. Connu comme non fait : pas de captures d'ecran dans le manifeste (elles enrichissent
la boite d'installation Android).

### Saisie sur le terrain

Quatre choses pour que le journal se remplisse vraiment pendant l'observation, dans le noir
et souvent avec des gants :

- Vision nocturne : un theme a part entiere (`[data-theme="night"]` dans `theme.css`), rouge
  sur noir et tailles augmentees, pour ne pas reperdre son adaptation a l'obscurite a chaque
  note. Accessible d'un appui depuis le Journal, ou dans Reglages. Contrepartie assumee : le
  code couleur bon/moyen/mauvais devient un code de luminosite, tout etant rouge.
- Evenements frequents en un appui (buee, nuage, mise au point, avion, satellite, vent) :
  la meme note libre horodatee qu'une saisie au clavier, juste pre-ecrite.
- Une note qui commence par une designation est rattachee a cette cible, ajoutee a la
  session si besoin : « M31 tres contraste » plutot que passer par la fiche detail. La
  detection (`sessionQueue.parseTargetPrefix`) est annoncee a l'ecran avant l'envoi, et met
  la designation a la forme du catalogue (`ic434` -> `IC0434`) -- sans quoi une meme cible
  se dedoublerait, et son temps d'expo cumule avec elle. Limitee aux prefixes M/NGC/IC des
  catalogues embarques, et a une note non vide : `M31` seul reste une note libre.
- L'ecran reste allume pendant une sortie en cours (`useWakeLock`), pas sur tout l'ecran
  Journal : inutile de vider la batterie pour relire une sortie passee.

Une note refusee definitivement par le serveur (cible absente de la session) n'est jamais
perdue : elle est reposee en note libre avec la cible en tete (`sessionStore.rescueNote`).
L'attache a la cible saute, le texte non.

### Icones

Les icones de la barre d'onglets sont dessinees en SVG (`mobile/src/components/TabIcon.tsx`)
et non plus posees en glyphes Unicode : rendus par la police du systeme, ceux-ci variaient
en taille, en epaisseur et en alignement d'un telephone a l'autre. Toujours pas de
bibliotheque d'icones -- cinq dessins de quelques lignes, sur la meme grille et le meme
trait que le croissant de l'icone de l'appli, generee par `python scripts/build_icons.py`.

### Performance mobile

Deux optimisations en place : la fonction API Vercel est epinglee sur la region `cdg1`
(Paris, `vercel.json`) pour reduire la latence reseau depuis la France (a verifier au
prochain deploiement -- la selection de region peut etre limitee selon le plan Vercel) ;
l'onglet "Catalogue Messier" pagine desormais comme "Cibles" (24 objets, "Voir N de plus")
et charge ses vignettes via `<img loading="lazy">` au lieu d'un fond CSS charge d'un bloc,
pour ne pas declencher jusqu'a 110 requetes d'images externes simultanees a l'ouverture.
Connu comme non fait : pas de mitigation du cold start serverless Vercel apres une
periode d'inactivite. Chaque navigation refetche, mais plus a vide : la derniere reponse
connue s'affiche pendant ce temps (voir "Appli installable").

La fiche detail d'une cible (Cibles/Catalogue Messier) permet aussi d'ajouter du temps
d'expo directement, sans passer par le journal de session -- pratique pour rattraper des
prises anterieures a l'usage de l'appli. C'est un journal libre par cible (`progress.py`,
`exposure_log`), independant du temps saisi par session (`sessions.py`) ; les deux sources
sont sommees par `stats.py` pour le total affiche dans les statistiques.
"Journal" permet de saisir un temps d'expo (minutes, un champ par cible et par sortie,
facultatif -- jamais mesure ni estime par l'appli, voir l'en-tete de `sessions.py`) et
affiche une section Statistiques (nombre de sorties, score moyen des sorties reussies,
cibles capturees ce mois-ci, temps d'expo cumule par cible) calculee par `stats.py` a
partir du journal existant, exposee via `GET /api/stats`.

    pip install -r api/requirements-api.txt
    uvicorn api.main:app --reload --port 8000        # depuis la racine du depot

    cd mobile
    npm install
    npm run dev                                       # http://localhost:5173

    pytest tests/test_api_*.py tests/test_settings.py tests/test_sessions.py -v

### Persistance : fichiers locaux ou Supabase

Par defaut, `progress.py`/`settings.py`/`sessions.py` persistent dans `data/*.json`
(disque local) -- suffisant en dev et sur un hebergeur a disque persistant (Railway,
Fly.io, l'image `Dockerfile`), mais incompatible avec une plateforme serverless comme
Vercel dont le systeme de fichiers ne survit pas entre deux invocations.

Pour brancher Supabase (Postgres) a la place, sans rien changer au code appelant :

1. Creer un projet sur [supabase.com](https://supabase.com).
2. Executer `supabase/schema.sql` dans l'editeur SQL du projet (cree la table `app_state`).
3. Definir en environnement, cote API : `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`
   (Project Settings -> API -- utiliser la cle `service_role`, jamais `anon`, et ne
   jamais l'exposer au frontend mobile).

Des que ces deux variables sont presentes, `db.py` bascule automatiquement les trois
stores sur Supabase (voir `db.enabled()`) ; absentes, comportement inchange (fichiers
locaux). `pip install -r api/requirements-api.txt` installe le client `supabase`.

### Deploiement : Vercel (frontend + API) + Supabase (persistance)

Aucun hebergeur a disque persistant necessaire (Railway/Fly.io) une fois Supabase
branche : `vercel.json` (racine du depot) construit `api/main.py` comme fonction
serverless Python (`@vercel/python`), avec `api/requirements.txt` (deps runtime
uniquement -- pas streamlit/altair/uvicorn, reserves au dev local). Deux projets
Vercel separes sur le meme repo GitHub :

1. Projet API -- Root Directory : racine du depot (les modules `catalog.py`,
   `scoring.py`, etc. importes par `api/main.py` doivent etre inclus dans le build).
   Variables d'environnement : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `ALLOWED_ORIGIN` (l'URL du projet mobile ci-dessous, pour le CORS -- voir
   `api/main.py`).
2. Projet mobile -- Root Directory : `mobile/` (config deja dans `mobile/vercel.json`).
   Variable d'environnement : `VITE_API_BASE` = URL du projet API ci-dessus.

## Sources
- Open-Meteo, modele AROME Meteo-France (1.3 km) : nuages par couche, vent, rosee, pluie
- 7Timer ASTRO (GFS, 3 h) : seeing et transparence
- PyEphem : Soleil, Lune, altitude/azimut des cibles, crepuscules
- OpenNGC (github.com/mattiaverga/OpenNGC) : catalogue de cibles et liste Messier
- Nominatim (OpenStreetMap) : geocodage d'adresse
- hips2fits (CDS, Centre de Donnees astronomiques de Strasbourg) : vignettes de reference DSS2 par coordonnees

## Fichiers
- config.py            : coordonnees par defaut, champ du Seestar, ponderations, horizon par defaut
- weather.py            : appels API meteo
- astro.py              : ephemerides, secteurs cardinaux, crepuscules
- geocode.py            : adresse -> lat/lon
- imagery.py            : vignettes de reference (hips2fits/CDS) a partir de RA/Dec
- progress.py           : persistance (horizon configure, Messiers captures) -- fichier local ou Supabase
- settings.py           : persistance (position, mode de fenetre, preferences d'alerte) -- fichier local ou Supabase
- sessions.py            : persistance (journal de session : cibles cochees, temps d'expo, historique) -- fichier local ou Supabase
- stats.py               : statistiques agregees calculees a partir du journal (sessions.py) -- lecture seule, rien de fabrique
- db.py                 : backend Supabase optionnel partage par les trois stores ci-dessus
- supabase/schema.sql   : schema SQL de la table `app_state` (Supabase)
- catalog.py             : chargement des catalogues (CSV generes)
- rows.py               : forme commune d'une ligne cible, partagee par app.py et api/
- scripts/build_catalog.py : generation ponctuelle des CSV depuis OpenNGC
- scripts/build_icons.py   : generation ponctuelle des icones PWA de l'appli mobile
- scoring.py            : score horaire, fenetres de visibilite, score francais
- app.py                : dashboard Streamlit (onglets "Ce soir" / "Catalogue Messier")
- api/                  : API FastAPI pour l'appli mobile (voir plus haut)
- mobile/               : appli mobile React/Vite (voir plus haut)
