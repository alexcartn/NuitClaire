"""Catalogue de cibles adaptées au Seestar S50 (RA en heures, Dec en degrés, taille en arcmin)."""

TARGETS = [
    # nom, type, RA(h), Dec(°), largeur', hauteur', filtre conseillé
    ("M31 Andromède",        "galaxie",  0.712,   41.27, 190, 60, "sans"),
    ("M33 Triangle",         "galaxie",  1.564,   30.66, 70,  40, "sans"),
    ("M45 Pléiades",         "amas",     3.790,   24.12, 110, 110, "sans"),
    ("M42 Orion",            "nébuleuse", 5.588, -5.39, 65,  60, "LP"),
    ("IC 434 Tête de Cheval", "nébuleuse", 5.683, -2.46, 60,  40, "LP"),
    ("M81 / M82",            "galaxie",  9.930,   69.07, 40,  30, "sans"),
    ("M51 Tourbillon",       "galaxie",  13.498,  47.20, 11,  7,  "sans"),
    ("M13 Hercule",          "amas",     16.695,  36.46, 20,  20, "sans"),
    ("M27 Haltère",          "nébuleuse", 19.994, 22.72, 8,   6,  "LP"),
    ("NGC 7000 North America", "nébuleuse", 20.978, 44.53, 120, 100, "LP"),
    ("IC 1396 Trompe d'éléphant", "nébuleuse", 21.650, 57.50, 170, 140, "LP"),
    ("NGC 6960 Dentelles",   "nébuleuse", 20.760, 30.72, 70,  6,  "LP"),
    ("M57 Anneau",           "nébuleuse", 18.893, 33.03, 1.4, 1,  "LP"),
    ("NGC 7293 Hélice",      "nébuleuse", 22.494, -20.84, 25, 25, "LP"),
    ("IC 1805 Cœur",         "nébuleuse", 2.548,  61.45, 150, 150, "LP"),
    ("NGC 869/884 Double amas", "amas",   2.333,  57.13, 60,  30, "sans"),
    ("M1 Crabe",             "nébuleuse", 5.575,  22.02, 6,   4,  "LP"),
    ("NGC 2237 Rosette",     "nébuleuse", 6.530,  4.95,  80,  80, "LP"),
]
