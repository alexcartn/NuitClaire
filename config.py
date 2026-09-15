"""Configuration du site d'observation et du Seestar S50."""

SITE = {
    "name": "Tréveray",
    "lat": 48.60,   # à affiner avec tes coordonnées exactes
    "lon": 5.35,
    "elevation_m": 300,
    "tz": "Europe/Paris",
}

# Seestar S50 : champ d'environ 1.29° x 0.73° (capteur IMX462, f=250mm)
SEESTAR = {
    "fov_w_deg": 1.29,
    "fov_h_deg": 0.73,
    "min_alt_deg": 30,      # en dessous, turbulence + extinction trop fortes
    "max_alt_deg": 85,      # zénith : le suivi alt-az décroche
}

# Pondération du score (somme = 1)
WEIGHTS = {
    "clouds": 0.40,
    "moon": 0.20,
    "wind": 0.15,
    "dew": 0.15,
    "seeing_transp": 0.10,
}

NB_NIGHTS = 5
