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

L'appli est aussi installable (`mobile/public/manifest.webmanifest`) et s'ouvre sans
reseau grace a un service worker ecrit a la main (`mobile/public/sw.js`, liste de
prechargement injectee au build par le plugin `swPrecache` de `vite.config.ts`). Les
appels a l'API et les ressources d'autres domaines ne sont jamais mis en cache. Les
icones sont generees par `python scripts/build_icons.py`.

    cd mobile
    npm test          # logique hors ligne du journal (lanceur de tests integre a Node)

### Performance mobile

Deux optimisations en place : la fonction API Vercel est epinglee sur la region `cdg1`
(Paris, `vercel.json`) pour reduire la latence reseau depuis la France (a verifier au
prochain deploiement -- la selection de region peut etre limitee selon le plan Vercel) ;
l'onglet "Catalogue Messier" pagine desormais comme "Cibles" (24 objets, "Voir N de plus")
et charge ses vignettes via `<img loading="lazy">` au lieu d'un fond CSS charge d'un bloc,
pour ne pas declencher jusqu'a 110 requetes d'images externes simultanees a l'ouverture.
Connu comme non fait : pas de cache client entre ecrans hors journal (les autres ecrans
refetchent a chaque navigation), ni de mitigation du cold start serverless Vercel apres
une periode d'inactivite -- le journal, lui, ne l'attend plus (voir "Journal hors ligne").

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
