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
alertes -- toutes editables, envoyees en notification push) et "Journal" (session en
cours + historique). Cote tests JS, la logique sans DOM est couverte
(file du journal, relecture, plan de nuit, vision nocturne automatique, mises en forme),
le rendu des ecrans est verifie a la main
via Playwright.

"Cibles" (mobile) est organisee comme la page Messier (`ciblesView.ts`, pur et teste) :
filtres dans une section repliable (types, magnitude avec un curseur a deux poignees,
cadre unique seulement), une grille « A quelle heure ? » qui compte les cibles
pointables heure par heure et filtre la liste sur l'heure touchee, puis des groupes
repliables : Messier a capturer d'abord, puis un groupe par type. Tout est filtre sur
le telephone a partir d'une seule liste : filtrer par type cote serveur faisait
disparaitre les autres types des puces. Cote Streamlit, `st.slider` en mode plage.
Cote mobile, "Messier" n'a plus ces filtres : c'est la page de l'objectif des 110 (voir
"Objectif Messier").

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

### Boussole

Une boussole dans Reglages, juste au-dessus de l'horizon degage : c'est en tournant
sur soi-meme, dehors, qu'on coche ces secteurs, et sans repere une fois la nuit
tombee, savoir ou est le nord tient de la devinette. La rose tourne, le repere reste
fixe en haut (cap en haut), et le secteur vise est entoure dans la grille juste en
dessous -- on pointe le telephone, on voit quelle case toucher.

`useCompass` traite les trois particularites de l'API d'orientation : il faut
l'orientation absolue (`deviceorientationabsolute` sur Chrome, `webkitCompassHeading`
sur Safari, qui ne publie pas la premiere), iOS exige une autorisation demandee
depuis un geste de l'utilisateur, et `alpha` compte a l'envers d'un cap. Sans capteur
ou sans autorisation, l'ecran le dit au lieu d'afficher une aiguille immobile qui
ferait croire a une mesure ; une ecoute restee muette trois secondes vaut absence de
magnetometre. `compass.sectorFor` reprend la regle de `astro.compass_sector`, sinon la
boussole designerait un secteur que le calcul de visibilite appelle autrement.

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

### Ce qui reste modifiable apres coup

Tout ce que l'utilisateur a ecrit ou choisi : notes, temps de pose, coches, ressenti,
resume, lieu. On reconstitue souvent une nuit le lendemain matin, et une case fermee
pour toujours reste vide pour toujours. Le resume, le ressenti et le lieu se
corrigent directement sur la sortie ; le reste passe par "Rouvrir pour tout
modifier", qui rend la sortie a l'ecran de session en cours. Le lieu se corrige aussi
sur la sortie en cours (`set_current_site`) : on s'apercoit souvent une fois installe
qu'on est parti sans changer sa position dans les reglages.

Ce que l'appli a relevé elle-meme ne l'est pas : horodatages, score de la nuit,
`context` d'une note, `conditions` d'une sortie. Ce sont des traces de ce que l'appli
savait a ce moment-la ; les rendre modifiables ferait passer de la fiction pour un
releve. Une sortie rouverte garde donc ses conditions d'origine meme si le client en
propose de nouvelles -- entre-temps la position a pu changer, et la prevision avec
elle. Corriger le lieu ne retouche pas les conditions non plus : elles disent ce que
la prevision annoncait la ou l'appli se croyait, et il n'existe pas de prevision
retrospective pour le vrai lieu.

Le lieu se corrige en choisissant parmi les lieux que le carnet connait deja, plus
celui configure dans Reglages -- c'est justement celui qu'on vient d'y poser en
rentrant. On observe depuis une poignee d'endroits, presque toujours les memes :
aucune raison de ressaisir des coordonnees.

### Lieu d'observation

Une sortie retient d'ou elle a ete faite : le lieu est fige a son ouverture, comme
le score (`siteAtOpen`, puis `site` une fois cloturee). Sans cela, changer de
position dans Reglages reecrirait le passe et toutes les sorties se retrouveraient au
dernier endroit configure. Ce n'est pas un releve GPS pris a l'insu de
l'utilisateur : c'est la position que l'appli utilisait deja pour ses calculs ce
soir-la.

Le lieu s'affiche sur la session en cours et sur chaque sortie passee, part dans
l'export, et `stats.outings_by_site` en tire un recapitulatif ("Marson, 4 sorties").
Le regroupement se fait par nom : deux sorties depuis le meme jardin portent le meme
nom, meme si les coordonnees bougent de quelques metres entre deux releves. Les
sorties anterieures a cette conservation ne sont pas rangees sous un lieu invente.

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

### Une seule couleur qui appelle

L'appli a deux langages de couleur : l'accent, qui dit « c'est ici qu'on agit »
(bouton principal, filtre actif, onglet courant, lien), et l'echelle de qualite
bon/moyen/mauvais, qui dit « voila ce que vaut cette mesure » (score de la nuit,
clarte du ciel heure par heure, rafales). Les deux se disputaient l'attention.

Mesure sur l'ancienne palette, en OKLCH, ou le chroma est comparable d'une teinte a
l'autre. En theme sombre : accent C 0,150, bon C 0,155, moyen C 0,146, mauvais
C 0,180. Deux des trois crans de l'echelle etaient donc plus satures que la couleur
de marque, et le vert plus clair qu'elle. Un accent ne fonctionne que parce qu'il
est rare.

L'echelle n'en etait pas une, par ailleurs : ses trois crans s'etalaient de L 0,714
a L 0,850, soit 0,14 d'ecart de clarte entre trois marches d'une meme mesure. Le
jaune sautait aux yeux bien plus que le rouge, l'inverse du sens.

Les trois crans partagent maintenant une seule clarte (seule la teinte porte le
sens) et un chroma plafonne a 87 % de celui de l'accent. Tous les contrastes restent
au-dessus de 4,5:1 sur le fond comme sur les surfaces. En-dessous de ~80 % de
chroma, le feu tricolore vire a la boue et le rouge ne se lit plus comme une alerte,
d'ou 87 et pas moins.

Le badge « CE SOIR » du catalogue Messier, lui, empruntait le vert de l'echelle pour
dire un simple oui : ce n'est pas une mesure. Sur une page qui suit une collection,
l'accent revient au seul geste de l'ecran, marquer une capture ; la faisabilite du
soir redevient un indice discret, et le filtre « Faisable ce soir uniquement » reste
la pour qui la cherche vraiment. Quand c'est non, plus rien ne s'affiche : l'absence
le dit deja, le tiret n'etait que du bruit.

Le mode vision nocturne garde ses propres valeurs : tout y etant rouge, l'echelle y
est deja une echelle de luminosite.

### Focus visible au clavier

Rien n'indiquait ou on se trouvait : les styles en ligne des composants ecrasaient
l'anneau par defaut du navigateur, et aucun ne le remplacait. Une regle unique sur
`:focus-visible` (et non `:focus`, sinon un bouton garde son anneau apres une
pression au doigt) pose un `outline` a 2 px de decalage.

Le decalage n'est pas cosmetique : un bouton deja rempli en accent recevrait sinon
un anneau accent colle a un aplat de la meme couleur, donc invisible. Il laisse voir
la surface qui porte le bouton, et l'anneau se detache. Une premiere version peignait
cet interstice en `--bg` pour en etre sure, ce qui dessinait un halo grisatre sur les
cartes, dont la surface n'est pas celle du fond : la surface reelle fait le travail.
`outline` plutot qu'une bordure, enfin, parce qu'elle ne prend pas de place dans la
mise en page, donc rien ne bouge a la prise de focus.

### Trois polices, trois roles

`theme.css` expose `--font-display`, `--font-text` et `--font-num` : aucun
composant ne nomme une famille, il nomme la nature de ce qu'il affiche. La
question devant un bout de texte n'est pas « quelle police » mais « est-ce un
titre, une phrase ou une valeur ».

- **Familjen Grotesk** pour les titres et les intitules de section. Assez de
  caractere pour que l'appli ait un visage, assez de corps pour tenir en rouge
  sur noir : une graisse fine ou une forte modulation disparaitraient en mode
  vision nocturne, ou tout est monochrome a faible luminance.
- **Atkinson Hyperlegible Next** pour le texte courant. Dessinee par le Braille
  Institute pour maximiser la distinction entre caracteres voisins. Ce n'est pas
  un argument d'accessibilite abstrait ici : on lit cet ecran dehors, a bout de
  bras, en rouge, avec un oeil adapte a l'obscurite.
- **Atkinson Hyperlegible Mono** pour les chiffres et les designations. Meme
  raison, plus le zero barre : `NGC 0891` ne peut plus se lire `NGC O891`. Chasse
  fixe pour que les heures et les angles s'alignent d'une ligne a l'autre.

L'ancienne pile etait `"Helvetica Neue", Helvetica, system-ui` pour le texte,
c'est-a-dire la police par defaut du telephone, donc pas un choix ; et JetBrains
Mono servait autant aux intitules (« CATALOGUE MESSIER », « CE SOIR », les
puces de filtre) qu'aux valeurs, ou il n'apportait qu'un vernis technique. La
chasse fixe est maintenant reservee a ce qui se mesure.

Les trois fichiers sont auto-heberges dans `mobile/public/fonts/` (variables, 71
ko au total). C'est aussi une correction : le `@import` vers
`fonts.googleapis.com` visait un autre domaine, que le service worker
n'intercepte pas -- ouverte hors ligne, le cas pour lequel toute la PWA a ete
faite, l'appli retombait sur le monospace du systeme. Les polices sont
desormais dans son prechargement, et `index.html` les precharge pour que le
premier rendu ne saute pas.

### Echelles typographique et d'espacement

`theme.css` definit deux echelles en jetons (`--text-*`, `--space-*`), et les
composants s'y tiennent. Avant, l'appli comptait quatorze tailles de texte, dont
neuf entre 9 et 17 px : un rapport de 1,06 entre marches, ou deux tailles ne se
distinguent pas et ne creent donc aucune hierarchie. Et onze valeurs d'ecart
differentes (3, 5, 7, 9, 11, 14...), ce qui empechait l'oeil de regrouper, tout se
trouvant a peu pres a la meme distance de tout. L'echelle typographique tient en
cinq marches de rapport ~1,27 ; l'espacement suit un pas de 4 px.

Le mode vision nocturne fait monter l'echelle entiere d'environ deux pixels, en
un seul endroit, au lieu de surcharger la taille classe par classe : les
rapports entre les marches sont conserves, et les surcharges qui restent ne
touchent que les rembourrages et les surfaces tactiles, qui ne suivent pas la
taille du texte.

Les surfaces tactiles ont un plancher de 44 px partout (`.nc-chip`, `.nc-btn-sm`,
`.nc-icon-btn` et les commandes posees en ligne) : les filtres de catalogue
tombaient a 27 px et les "x" de suppression du journal plus bas encore, dans une
appli dont le mode vision nocturne suppose des gants dans le noir. La ou la case
doit rester petite (la coche "capturee"), la surface est agrandie par un
rembourrage positif et une marge negative, sans rien deplacer.

La ligne de chiffres d'une cible (`components/TargetRow.tsx`) porte la decision :
elle passe devant le type et le cadrage, avec le creneau horaire en tete et les
angles en retrait. Elle etait auparavant dans la couleur la plus eteinte de la
palette, sous un nom deux fois plus gros -- exactement l'inverse du premier
principe de `.impeccable.md`.

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
`exposure_log`), independant du temps saisi par session (`sessions.py`). Les deux sources
sont sommees partout ou un total est affiche : dans les statistiques (`stats.py`) comme
sur la fiche detail (`exposureTotalMin`, avec `exposureFreeMin`/`exposureSessionMin` pour
savoir d'ou vient quoi). La fiche n'affichait auparavant que le journal libre, ce qui
donnait deux chiffres contradictoires pour la meme question.
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

### Navigation, prochaines nuits, plan de nuit

- Le bouton retour d'Android (et le geste retour d'iOS) suit l'appli : chaque ecran est
  pose dans l'historique du navigateur (`App.tsx`), au lieu de fermer l'appli depuis une
  fiche. Revenir d'une fiche retrouve la liste a la meme position, filtres compris
  (`useRemembered`). Toucher l'onglet courant remonte en haut.
- "Ce soir" montre ce soir et les deux nuits suivantes (`GET /api/nights`,
  `config.NB_FORECAST_NIGHTS = 3`, l'horizon de 7Timer) ; une nuit que la prevision ne
  couvre pas assez s'affiche sans score plutot qu'avec un chiffre calcule sur des trous.
- "Plan de la nuit" enchaine les cibles pointables par blocs d'une heure dans l'ordre de
  la liste (`nightPlan.ts`), avec un bouton pour tout poser dans le journal.
- La bascule "Nuit" est en haut de chaque ecran ; Reglages propose aussi le passage
  automatique en vision nocturne entre les crepuscules nautiques (`autoNight.ts`), une
  fois par nuit, sans reprendre la main si on en sort.
- "Ma position" enregistre le nom de la commune (`POST /api/geocode/reverse`).
- Si la meteo est injoignable, "Catalogue Messier" affiche quand meme les 110 objets,
  faisabilite inconnue. Les ecrans en erreur proposent "Reessayer".

### Score astro

Le score horaire (`scoring.hourly_score`) multiplie ses facteurs au lieu de les additionner :
le pire l'emporte. L'ancien modele additif (nuages 40 %, Lune 20 %, vent 15 %, buee 15 %,
seeing 10 %) donnait 84/100 a un ciel entierement couvert de nuages moyens : vent et buee
rapportaient 30 points d'office, les couches moyennes et hautes ne pesaient presque rien,
et une pleine Lune ne retirait jamais plus de 20 points.

- Nuages : couverture totale, 20 % -> 0,85, 50 % -> 0,50, 85 % et plus -> 0.
- Lune : penalite selon l'illumination et l'altitude (pleine a partir de 30 deg).
- Vent : sans effet jusqu'a 15 km/h de rafales, plancher a 40 km/h.
- Buee : 15 % au plus (le S50 chauffe son optique). Seeing/transparence 7Timer : 20 % au
  plus, aucune penalite quand la prevision manque.

Le score de la nuit prend la Lune au pire (cible sans filtre, proche de la Lune). Chaque
cible a ensuite son propre score (`scoring.target_score`) : la penalite lunaire baisse
avec la separation, et une cible en emission photographiee avec le filtre LP (colonne
`filter` du catalogue) n'en subit qu'environ la moitie ; elle tolere aussi une Lune a
15 deg au lieu de 30. Sous une pleine Lune claire, la nuit tombe vers 48 et les galaxies
disparaissent de la liste, pas les nebuleuses. Les reglages sont dans `config.SCORE_MODEL`.

### Objectif Messier (le « Pokedex »)

"Cibles" repond a « quoi photographier ce soir », sur tout le catalogue. "Messier" suit
l'objectif des 110 (`messierDex.ts`, pur et teste) :

- progression, captures du mois et de l'annee, et rythme (a partir de trois captures
  datees) ; les dates viennent du journal, premiere sortie ou l'objet est coche fait ;
- a chasser ce soir : les manquants faisables cette nuit, ceux qui s'en vont en tete ;
- derniere chance : visibles le soir ce mois-ci, plus dans un ou deux mois ;
- calendrier de chasse : douze cases avec le nombre de manquants observables chaque mois,
  et la liste du mois choisi, les mieux places d'abord ;
- pas visibles d'ici (repliee) : masques par l'horizon, hors de portee ;
- la grille des 110 : vignette pour un objet capture, case rayee sinon.

Les sections se replient (`components/Section.tsx`) et restent comme on les a laissees.

Les saisons viennent de `GET /api/messier/season` (`season.py`) : pour chaque mois, les
heures noires de la nuit du 15 ou l'objet est assez haut dans un secteur degage. Depuis
le nord de la France, 21 Messier ne depassent jamais 20 deg : pour un Messier qui culmine
sous 25 deg, le seuil descend a 12 deg (`config.SEESTAR`, `scoring.min_alt_for`), ce qui en
rend 13 atteignables avec un horizon sud degage ; les 8 restants (M6, M7, M54, M55, M62,
M69, M70, M83) demandent une sortie plus au sud. Cocher un Messier fait dans le journal
propose de le marquer capture.

### Journal

Organise comme Messier et Cibles (`journalView.ts`, pur et teste) :

- saisie (cible, note, evenements en un appui) en tete, toujours ouverte ;
- session en cours : chaque cible replie sur une ligne (heure, notes, pose, note sur 5),
  une seule depliee a la fois, la derniere ajoutee par defaut ;
- « Mes sorties » : l'annee, douze mois avec le nombre de sorties, puis celles du mois
  touche, chacune repliee sur son resume (date, score, cibles) ;
- statistiques en fin de page, repliees par defaut.

### Reglages

Ranges en sections repliables, chacune avec son reglage en place dans l'en-tete : Lieu,
Horizon, Fenetre d'observation, Alertes, Affichage, Appli (installation, code d'acces).
Un changement s'affiche tout de suite, revient en arriere en le disant si le serveur ne
l'a pas pris, et recharge l'etat partage de l'appli.

- Mes lieux : chaque lieu utilise est retenu (`settings.remember_place`, 8 au plus) ;
  on passe de l'un a l'autre en un appui, « Gerer » permet d'en oublier
  (`DELETE /api/places/{nom}`).
- Horizon avec hauteurs : chaque secteur est bouche, ou degage a partir d'une hauteur
  (libre, 10, 20, 30 ou 45 deg) pour les arbres et les toits. Stocke dans
  `progress.horizon_alt`, combine en profil par `progress.horizon_profile` ; les creneaux,
  les raisons d'infaisabilite, les saisons Messier et le graphe d'altitude exigent que la
  cible passe au-dessus (`scoring.sector_floor`). Les horizons booleens (appli Streamlit,
  anciens reglages) restent acceptes.

### Jumelles

Instrument actif au choix (Reglages, ou la bascule en tete de « Cibles » et « Messier ») :
Seestar S50, ou jumelles (10x50 et champ de 6,5 deg par defaut, reglables). Aux jumelles
(`optics.py`) :

- la liste ne garde que ce qu'elles montrent : magnitude d'objet etendu au plus
  2 + 5 log D - 2 (8,5 pour 50 mm), taille d'au moins 1', amas et doubles toujours ;
  plus des classiques absents du catalogue Seestar (`data/binoculars.csv` : Cr 399,
  Mel 20, Mel 25, Mel 111, cascade de Kemble, Stock 2, Albireo, Mizar, epsilon Lyr) ;
- cadrage « tient dans le champ », hauteurs de 15 a 90 deg, et une Lune peu genante pour
  les amas et les doubles (les nebuleuses et galaxies s'effacent toujours) ;
- plan de la nuit par quarts d'heure ;
- un Pokedex Messier « vus » a part (`progress.messier_seen`, `PUT /api/messier/{id}/seen`) :
  vu aux jumelles ne compte pas comme photographie ;
- dans chaque fiche, le chemin d'etoiles (`starhop.py`, `GET /api/targets/{d}/starhop`) :
  une etoile de depart brillante, des sauts de trois quarts de champ appuyes sur les
  etoiles visibles, et une carte orientee comme le ciel (zenith en haut), avec un cercle
  de la taille du champ a chaque etape. Pour M31 : Mirach, mu And, M31.

Etoiles jusqu'a la magnitude 6 et traces des constellations : `data/stars.csv` et
`data/constellation_lines.json`, generes par `scripts/build_stars.py` depuis le paquet
npm d3-celestial (BSD-3-Clause, (c) 2015 Olaf Frohn, donnees Hipparcos ; licence dans
`data/STARS_LICENSE.txt`).

### Recherche

Par designation (prefixe : « M3 », « NGC70 ») ou par nom, en francais ou en anglais, sans
accents (« orion », « tourbillon », « whirlpool ») : `catalog.search_by_name`, avec les noms
francais des objets connus dans `catalog.FRENCH_NAMES`. Champ vide, l'ecran propose les
recherches recentes, la tete de liste de ce soir, des incontournables (visibles ce soir
en premier, avec leur creneau) et les types de ce soir, qui ouvrent « Cibles » deja
filtree. Les creneaux viennent des listes gardees sur l'appareil : aucune requete.

### Alertes push

Deux alertes (Reglages) : nuit au-dessus de 70, et risque de buee (ecart temperature/rosee
sous 1,5 °C dans la fenetre d'observation). Une tache planifiee Vercel
(`vercel.json`, `crons`) appelle `GET /api/cron/alerts` chaque jour a 16:00 UTC (18 h
l'ete, 17 h l'hiver) : elle evalue la nuit qui vient (`alerts.py`) et envoie une
notification Web Push a chaque telephone abonne (`notifications.py`, `public/sw.js`),
une seule fois par nuit meme si la tache est rejouee. Un abonnement que le service push
declare perime est retire tout seul.

Mise en route :

1. `python scripts/gen_vapid_keys.py`, puis sur le projet API Vercel : `VAPID_PUBLIC_KEY`,
   `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:votre@adresse`, et `CRON_SECRET` (Vercel
   l'envoie a la tache planifiee ; sans lui, la route accepte le code d'acces de l'API).
2. Redeployer, puis sur le telephone : Reglages, Alertes, « Recevoir les alertes sur ce
   telephone », et « Envoyer un test ». Sur iPhone, l'appli doit etre posee sur l'ecran
   d'accueil (iOS 16.4 et plus) : Safari ne livre pas de notification a un simple onglet.

Les abonnements sont gardes dans le store `push` (Supabase ou `data/push.json`), a part
des reglages. Le plan gratuit de Vercel limite les taches planifiees a une par jour :
d'ou une verification en fin d'apres-midi pour la nuit a venir, pas une surveillance
en direct.

### Code d'acces de l'API

Sans authentification, n'importe qui connaissant l'URL de l'API pouvait lire et modifier
le journal (le CORS ne bloque que les navigateurs). Definir `NUITCLAIRE_API_TOKEN` sur le
projet API suffit a exiger `Authorization: Bearer <code>` sur toutes les routes
(`api/auth.py`). Le mobile demande le code au premier refus et le garde sur l'appareil
(il n'est pas dans le bundle, qui est public) ; il se change dans Reglages. Sans la
variable, l'API reste ouverte comme avant.

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
   `api/main.py`), et `NUITCLAIRE_API_TOKEN` (conseille, voir "Code d'acces de l'API").
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
- config.py            : coordonnees par defaut, champ du Seestar, modele du score (SCORE_MODEL), horizon par defaut
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
