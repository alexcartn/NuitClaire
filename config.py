"""Configuration du site d'observation et du Seestar S50."""

# lat/lon geocodes via Nominatim (7 rue Saint Jean, 51240 Marson, France),
# arrondis a 4 decimales (~11 m de precision).
SITE = {
    "name": "Marson",
    "lat": 48.9124,
    "lon": 4.5290,
    "elevation_m": 100,
    "tz": "Europe/Paris",
}

# Seestar S50 : champ d'environ 1.29 deg x 0.73 deg (capteur IMX462, f=250mm)
SEESTAR = {
    "fov_w_deg": 1.29,
    "fov_h_deg": 0.73,
    "min_alt_deg": 20,      # en dessous, turbulence + extinction trop fortes
    "max_alt_deg": 85,      # zenith : le suivi alt-az decroche
    # Messier bas : depuis le nord de la France, 21 objets (Sagittaire,
    # Scorpion...) ne depassent jamais 20 deg, et l'objectif des 110 serait
    # impossible. Pour un Messier qui culmine sous `low_messier_culmination_deg`,
    # le seuil descend a `low_messier_min_alt_deg` : rendu degrade (plus
    # d'atmosphere traversee), mais photographiable par ciel sec et horizon
    # sud degage. En dessous, il faut aller plus au sud.
    "low_messier_min_alt_deg": 12,
    "low_messier_culmination_deg": 25,
}

# Jumelles par defaut (profil « Jumelles », voir optics.py) : une 10x50,
# champ reel ~6,5 deg. Modifiables dans Reglages.
BINOCULARS = {
    "magnification": 10,
    "aperture_mm": 50,
    "fov_deg": 6.5,
    # Pas de monture alt-az a menager : on vise bas, et jusqu'au zenith
    # (inconfortable, mais possible allonge).
    "min_alt_deg": 15,
    "max_alt_deg": 90,
}

# Modele du score astro horaire (voir `scoring.hourly_score`). Les facteurs se
# multiplient au lieu de s'additionner : le pire l'emporte, comme dehors. Le
# modele additif precedent donnait 84/100 a un ciel entierement couvert de
# nuages moyens (vent et buee rapportaient 30 points d'office, une couche
# moyenne a 100 % n'en retirait que 12, une pleine lune jamais plus de 20).
SCORE_MODEL = {
    # Couverture nuageuse totale a partir de laquelle l'heure est perdue. Le
    # facteur nuages vaut 1 - (couverture / seuil) ** courbe : la courbe
    # epargne les petits pourcentages (20 % -> 0,85 ; 50 % -> 0,50 ;
    # 80 % -> 0,08), qu'une prevision affiche souvent par ciel pur.
    "cloud_opaque_pct": 85,
    "cloud_curve": 1.3,
    # Penalite maximale de la Lune (pleine, haute, proche de la cible) pour
    # une cible sans filtre (galaxies, amas, nebuleuses par reflexion)...
    "moon_penalty_broadband": 0.55,
    # ... et pour une cible en emission observee avec le filtre LP (bi-bande
    # Ha/OIII du S50), qui coupe l'essentiel de la lumiere lunaire.
    "moon_penalty_lp": 0.25,
    # Altitude lunaire a partir de laquelle la Lune eclaire le ciel a plein.
    "moon_full_alt_deg": 30,
    # Loin de la cible, la Lune gene moins : a 120 deg et au-dela, sa
    # penalite est reduite de cette part.
    "moon_far_relief": 0.3,
    # Rafales sans effet jusqu'a `wind_calm_kmh`, facteur au plancher a
    # `wind_max_kmh` et au-dela.
    "wind_calm_kmh": 15,
    "wind_max_kmh": 40,
    "wind_floor": 0.3,
    # Penalite maximale de la buee : le S50 a sa propre resistance chauffante.
    "dew_max_penalty": 0.15,
    # Penalite maximale seeing/transparence 7Timer (prevision grossiere, pas
    # de penalite quand elle manque plutot qu'une valeur neutre inventee).
    "seeing_max_penalty": 0.2,
}

# Une seule nuit (celle du jour meme) est chargee et affichee, dans les deux
# onglets : volontairement pas de strip/selecteur multi-jours (previsions meteo
# peu fiables au-dela de 24-48h, cf. docs/plans -- et l'utilisateur ne planifie
# pas a la semaine).
NB_NIGHTS = 1

# Exception cote API mobile : un bandeau "prochaines nuits" en tete de
# "Ce soir", pour repondre a « quelle est la prochaine bonne nuit ? » avant
# de sortir. Limite a trois nuits (ce soir + 2) : c'est l'horizon de 7Timer
# (~72 h) et celui ou AROME/ARPEGE restent utilisables ; au-dela, le score ne
# serait plus qu'un chiffre plausible. La nuit affichee partout ailleurs
# reste celle du jour.
NB_FORECAST_NIGHTS = 3

# Fenetre d'observation habituelle (heure locale, 24h), utilisee comme filtre par defaut.
VIEW_WINDOW = {"start_hour": 20, "end_hour": 22.5}

# Secteurs cardinaux degages par defaut (a ajuster dans la barre laterale de l'appli).
# Duplique intentionnellement dans progress.py (DEFAULT["horizon"]), qui sert de
# repli quand aucun progress.json n'existe encore : garder les deux synchronises.
DEFAULT_HORIZON = {"N": True, "NE": True, "E": False, "SE": False,
                    "S": False, "SW": False, "W": False, "NW": False}
