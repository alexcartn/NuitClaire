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
inverse (pas de nom d'adresse) ; pas de PWA installable (pas de manifest/service worker) ;
pas de suite de tests JS (verification faite via Playwright manuel).

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
- sessions.py            : persistance (journal de session : cibles cochees, historique) -- fichier local ou Supabase
- db.py                 : backend Supabase optionnel partage par les trois stores ci-dessus
- supabase/schema.sql   : schema SQL de la table `app_state` (Supabase)
- catalog.py             : chargement des catalogues (CSV generes)
- rows.py               : forme commune d'une ligne cible, partagee par app.py et api/
- scripts/build_catalog.py : generation ponctuelle des CSV depuis OpenNGC
- scoring.py            : score horaire, fenetres de visibilite, score francais
- app.py                : dashboard Streamlit (onglets "Ce soir" / "Catalogue Messier")
- api/                  : API FastAPI pour l'appli mobile (voir plus haut)
- mobile/               : appli mobile React/Vite (voir plus haut)
