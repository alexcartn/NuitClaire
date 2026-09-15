# Seestar Planner

Planificateur de sessions Seestar S50 pour Tréveray : score go/no-go par nuit + fenêtres de visibilité par cible.

## Lancer
    pip install -r requirements.txt
    streamlit run app.py

## Sources
- Open-Meteo, modèle AROME Météo-France (1.3 km) : nuages par couche, vent, rosée, pluie
- 7Timer ASTRO (GFS, 3 h) : seeing et transparence
- PyEphem : Soleil, Lune, altitude des cibles

## Fichiers
- config.py    : coordonnées, champ du Seestar, pondérations du score
- weather.py   : appels API
- astro.py     : éphémérides
- catalog.py   : cibles (RA/Dec/taille)
- scoring.py   : score horaire et fenêtres
- app.py       : dashboard Streamlit
