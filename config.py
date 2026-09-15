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
    "min_alt_deg": 30,      # en dessous, turbulence + extinction trop fortes
    "max_alt_deg": 85,      # zenith : le suivi alt-az decroche
}

# Ponderation du score (somme = 1)
WEIGHTS = {
    "clouds": 0.40,
    "moon": 0.20,
    "wind": 0.15,
    "dew": 0.15,
    "seeing_transp": 0.10,
}

NB_NIGHTS = 5

# Fenetre d'observation habituelle (heure locale, 24h), utilisee comme filtre par defaut.
VIEW_WINDOW = {"start_hour": 20, "end_hour": 22.5}

# Secteurs cardinaux degages par defaut (a ajuster dans la barre laterale de l'appli).
# Duplique intentionnellement dans progress.py (DEFAULT["horizon"]), qui sert de
# repli quand aucun progress.json n'existe encore : garder les deux synchronises.
DEFAULT_HORIZON = {"N": True, "NE": True, "E": False, "SE": False,
                    "S": False, "SW": False, "W": False, "NW": False}
