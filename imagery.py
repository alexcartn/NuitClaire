"""Vignettes de reference (sky-survey cutouts) pour les cibles du catalogue.

Utilise le service hips2fits du CDS (Centre de Donnees astronomiques de
Strasbourg), qui sert le meme releve DSS (Digitized Sky Survey) que le service
dss_search de STScI initialement envisage, mais permet de fixer directement la
resolution en pixels de la vignette plutot que de la laisser dependre de
l'echelle de la plaque photographique du releve.

Ce choix vient d'une mesure faite pendant le developpement : le endpoint
dss_search de STScI (https://archive.stsci.edu/cgi-bin/dss_search) produit des
GIF bien plus lourds qu'attendu -- environ 1.3 Mo pour une vignette au minimum
de 15' (contre les 500-800 Ko envisages initialement), jusqu'a 11 Mo pour une
vignette de 45-60' (mesure sur M31 et M42, survol poss2ukstu_red). Multiplie
par jusqu'a 1734 lignes (onglet "Ce soir") ou par 110 vignettes chargees
sans lazy-loading (onglet "Catalogue Messier"), c'est impraticable.
hips2fits, a champ de vue equivalent, produit des JPEG d'environ 5 a 9 Ko
(meme mesure), soit ~150 a 1000x plus leger, pour un rendu visuel comparable
(meme releve DSS2) car la taille du fichier depend du nombre de pixels demande
et non de l'etendue de ciel couverte.
"""
from urllib.parse import urlencode

# Bornes de champ de vue (arcmin). En dessous de MIN_SIZE_ARCMIN l'objet
# serait un point minuscule dans un cadrage trop large n'apporte rien de plus ;
# au-dessus de MAX_SIZE_ARCMIN le cadrage devient inutilement large pour un
# simple apercu de cadrage (et duplique moins bien l'echelle du champ Seestar).
MIN_SIZE_ARCMIN = 15.0
MAX_SIZE_ARCMIN = 60.0

# Marge appliquee a la taille cataloguee de l'objet pour ne pas le cadrer trop
# serre (le centre du cadre est les coordonnees, pas l'enveloppe de l'objet).
SIZE_MARGIN = 1.5

# Cote (en pixels) de la vignette carree demandee : fixe la taille du fichier
# independamment du champ de vue couvert (voir docstring du module). Largement
# suffisant pour un affichage a width=60 (onglet Messier) ou dans une colonne
# ImageColumn ; un elargissement manuel important de cette derniere au-dela de
# ~160px agrandirait la vignette au-dela de sa resolution source (flou), mais
# reste cosmetique a cette echelle de vignette.
THUMB_SIZE_PX = 160

HIPS2FITS_BASE_URL = "https://alasky.cds.unistra.fr/hips-image-services/hips2fits"
HIPS_SURVEY = "CDS/P/DSS2/color"


def dss_image_url(ra_h: float, dec_deg: float,
                   size_w_arcmin: float | None = None,
                   size_h_arcmin: float | None = None) -> str:
    """URL d'une vignette DSS (Digitized Sky Survey, via le service hips2fits du CDS)
    centree sur ra_h/dec_deg. Taille de la vignette derivee de la taille cataloguee de
    l'objet (avec marge), bornee entre MIN_SIZE_ARCMIN et MAX_SIZE_ARCMIN."""
    ra_deg = ra_h * 15.0

    # Utilise la plus grande dimension connue (une seule peut manquer selon le
    # catalogue source) ; si aucune n'est connue, cadrage minimal par defaut.
    known_sizes = [v for v in (size_w_arcmin, size_h_arcmin) if v is not None]
    if not known_sizes:
        size_arcmin = MIN_SIZE_ARCMIN
    else:
        size_arcmin = max(known_sizes) * SIZE_MARGIN
        size_arcmin = max(MIN_SIZE_ARCMIN, min(MAX_SIZE_ARCMIN, size_arcmin))

    params = {
        "hips": HIPS_SURVEY,
        "ra": ra_deg,
        "dec": dec_deg,
        "fov": size_arcmin / 60.0,
        "width": THUMB_SIZE_PX,
        "height": THUMB_SIZE_PX,
        "format": "jpg",
    }
    return f"{HIPS2FITS_BASE_URL}?{urlencode(params)}"
