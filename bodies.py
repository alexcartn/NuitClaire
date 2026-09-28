"""La Lune et les planetes comme objets a part entiere : trouvables dans la
recherche, avec une fiche (hauteur de la nuit, lever/coucher, eclat,
taille apparente, distance, phase) calculee par PyEphem pour le lieu.

Elles ne sont pas dans le catalogue (qui ne porte que le ciel profond) :
leur position change chaque nuit, tout est calcule a la demande.
"""
import math
import unicodedata
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import ephem

from extras import _jupiter_moons, _local, _observer, _sector, features_near_terminator, night_bounds

AU_KM = 149_597_870.7

# Nom de l'appli, nom anglais, classe PyEphem, nature, conseil d'observation.
BODIES = [
    ("Lune", "Moon", ephem.Moon, "satellite naturel",
     "Au Seestar, mode Lune : une mosaïque couvre tout le disque. Le relief ressort le long du "
     "terminateur ; à la pleine Lune, il s'efface, mais les rayons de Tycho et de Copernic ressortent."),
    ("Mercure", "Mercury", ephem.Mercury, "planète",
     "Toujours près du Soleil : à chercher bas sur l'horizon juste après son coucher ou avant son lever. "
     "Jamais d'instrument pointé tant que le Soleil n'est pas couché."),
    ("Vénus", "Venus", ephem.Venus, "planète",
     "L'astre le plus brillant après la Lune ; ses phases se voient aux jumelles bien calées et au Seestar, "
     "en poses très courtes."),
    ("Mars", "Mars", ephem.Mars, "planète",
     "Petite et orangée : les détails (calottes polaires, mers sombres) demandent l'opposition et un ciel stable."),
    ("Jupiter", "Jupiter", ephem.Jupiter, "planète",
     "Ses quatre grandes lunes se voient aux jumelles ; au Seestar, les bandes nuageuses, et parfois la Grande Tache rouge."),
    ("Saturne", "Saturn", ephem.Saturn, "planète",
     "Les anneaux se voient au moindre instrument qui grossit ; Titan, sa plus grande lune, est un point tout proche."),
    ("Uranus", "Uranus", ephem.Uranus, "planète",
     "À la limite de l'œil nu : un point vert pâle aux jumelles, un petit disque au Seestar."),
    ("Neptune", "Neptune", ephem.Neptune, "planète",
     "Invisible à l'œil nu : un point bleuté aux jumelles avec une carte, un tout petit disque au Seestar."),
]
_BY_NAME = {b[0]: b for b in BODIES}


def _fold(text: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", text.lower()) if unicodedata.category(c) != "Mn").strip()


def search(query: str) -> list[dict]:
    """Astres dont le nom (francais ou anglais) commence par `query`,
    accents et majuscules ignores : « lu », « ven », « saturn »."""
    q = _fold(query)
    if len(q) < 2:
        return []
    return [{"designation": name, "isMessier": False, "messierId": None, "commonName": en,
             "frenchName": name, "type": kind}
            for name, en, _, kind, _ in BODIES
            if _fold(name).startswith(q) or _fold(en).startswith(q)]


def find(name: str) -> tuple | None:
    return _BY_NAME.get(name) or next((b for b in BODIES if _fold(b[0]) == _fold(name) or _fold(b[1]) == _fold(name)), None)


def detail(name: str, site: dict, day: date, horizon: dict | None = None, step_min: int = 15) -> dict | None:
    """Fiche d'un astre pour la nuit du `day` au lieu `site`."""
    body_def = find(name)
    if body_def is None:
        return None
    name, en, cls, kind, tip = body_def
    tz = ZoneInfo(site["tz"])
    dusk, dawn = night_bounds(site, day)
    series = []
    t = dusk - timedelta(hours=1)
    while t <= dawn + timedelta(hours=1):
        obs = _observer(site, t)
        b = cls(obs)
        alt, az = math.degrees(b.alt), math.degrees(b.az)
        floor = None if horizon is None else horizon.get(_sector(az), 0.0)
        clear = alt >= 8 and (horizon is None or floor is not None and alt >= floor)
        series.append({"time": t.astimezone(tz).isoformat(), "alt": round(alt, 1), "az": round(az),
                       "sector": _sector(az), "clear": clear, "night": dusk <= t <= dawn})
        t += timedelta(minutes=step_min)
    night = [p for p in series if p["night"]]
    visible = [p for p in night if p["clear"]]
    best = max(visible or night, key=lambda p: p["alt"])
    obs = _observer(site, dusk + (dawn - dusk) / 2)
    b = cls(obs)

    def event(kind: str, start) -> ephem.Date | None:
        o = _observer(site, dusk)
        try:
            return getattr(o, kind)(cls(), start=start)
        except (ephem.AlwaysUpError, ephem.NeverUpError):
            return None

    # Lever de la nuit (depuis 4 h avant le crepuscule, pour un astre deja
    # leve au coucher du Soleil), puis coucher et passage au meridien qui
    # le suivent : jamais un coucher d'avant le lever.
    start = ephem.Date(_observer(site, dusk - timedelta(hours=4)).date)
    rise = event("next_rising", start)
    after = rise if rise is not None else start
    setting = event("next_setting", after)
    transit = event("next_transit", after)
    iso = lambda d: _local(d, tz).isoformat() if d is not None else None  # noqa: E731
    out = {
        "name": name, "englishName": en, "kind": kind, "tip": tip,
        "mag": round(float(b.mag), 1),
        "constellation": ephem.constellation(b)[1],
        "sizeArcsec": round(float(b.size), 1),
        "distanceKm": round(float(b.earth_distance) * AU_KM) if name == "Lune" else None,
        "distanceAu": None if name == "Lune" else round(float(b.earth_distance), 2),
        "phase": round(float(b.phase)),
        "rise": iso(rise), "set": iso(setting), "transit": iso(transit),
        "visibleFrom": visible[0]["time"] if visible else None,
        "visibleTo": visible[-1]["time"] if visible else None,
        "bestTime": best["time"], "bestAlt": round(best["alt"]), "bestSector": best["sector"],
        "series": series,
    }
    if name == "Lune":
        colong = math.degrees(b.colong)
        out["terminatorFeatures"] = features_near_terminator(colong, float(b.phase))
        out["nextFull"] = _local(ephem.next_full_moon(obs.date), tz).isoformat()
        out["nextNew"] = _local(ephem.next_new_moon(obs.date), tz).isoformat()
    if name == "Jupiter":
        out["moons"] = _jupiter_moons(_observer(site, datetime.fromisoformat(best["time"])))
    if name == "Saturne":
        out["ringTiltDeg"] = round(abs(math.degrees(b.earth_tilt)), 1)
    return out


# Titres Wikipedia (francais) : « Saturne » seul designe aussi le dieu.
WIKI_TITLES = {
    "Lune": "Lune", "Mercure": "Mercure (planète)", "Vénus": "Vénus (planète)",
    "Mars": "Mars (planète)", "Jupiter": "Jupiter (planète)", "Saturne": "Saturne (planète)",
    "Uranus": "Uranus (planète)", "Neptune": "Neptune (planète)",
}
# Une photo par astre, sur Wikimedia Commons (photos de sondes NASA/ESA pour
# la plupart), verifiees une a une. Des adresses fixes plutot que l'image
# de la page Wikipedia demandee a chaque fiche : l'API limite les requetes
# rapprochees, et une fiche sans image pour ca serait bete.
_COMMONS = "https://commons.wikimedia.org/wiki/Special:FilePath/{}?width=800"
IMAGES = {
    "Lune": "FullMoon2010.jpg",
    "Mercure": "Mercury_in_color_-_Prockter07_centered.jpg",
    "Vénus": "Venus-real_color.jpg",
    "Mars": "OSIRIS_Mars_true_color.jpg",
    "Jupiter": "Jupiter_in_true_color.jpg",
    "Saturne": "Saturn_global_view_from_Cassini,_rings_open_Better_Colour.png",
    "Uranus": "Uranus_as_seen_by_NASA's_Voyager_2_(remastered)_-_JPEG_converted.jpg",
    "Neptune": "Neptune_Voyager2_color_calibrated.png",
}


def image_url(name: str) -> str:
    from urllib.parse import quote

    return _COMMONS.format(quote(IMAGES[name])) if name in IMAGES else ""


def as_target_detail(name: str, site: dict, frame_times: list, horizon: dict, wiki_summary) -> dict:
    """La fiche d'un astre dans la forme de celle d'une cible du catalogue
    (voir GET /api/targets/{designation}) : meme courbe horaire, meme
    creneau, meme tableau, pour une fiche identique dans l'appli. Ce qui
    n'a de sens que pour lui (phase, lunes, anneaux, lever et coucher...)
    est dans `body`."""
    from astro import fits_in_fov
    from config import SEESTAR
    from scoring import sector_floor

    name, en, cls, kind, tip = find(name)
    tz = ZoneInfo(site["tz"])
    min_alt, max_alt = SEESTAR["min_alt_deg"], SEESTAR["max_alt_deg"]
    series, usable = [], []
    for t in frame_times:
        when = t.replace(tzinfo=tz) if t.tzinfo is None else t
        obs = _observer(site, when)
        b = cls(obs)
        alt, az = math.degrees(b.alt), math.degrees(b.az)
        sector = _sector(az)
        moon_sep = 0.0 if name == "Lune" else math.degrees(float(ephem.separation(b, ephem.Moon(obs))))
        series.append({"time": t.isoformat(), "alt": round(alt, 1), "az": round(az, 1), "sector": sector,
                       "moonSep": round(moon_sep, 1)})
        floor = sector_floor(horizon, sector)
        dark = math.degrees(ephem.Sun(obs).alt) < -6
        if dark and floor is not None and max(min_alt, floor) <= alt <= max_alt:
            usable.append((when, moon_sep))
    peak = max(series, key=lambda p: p["alt"])
    mid = _observer(site, frame_times[len(frame_times) // 2].replace(tzinfo=tz))
    b = cls(mid)
    size_arcmin = float(b.size) / 60
    extra = detail(name, site, frame_times[0].date(), horizon)
    body = {k: extra.get(k) for k in ("kind", "tip", "sizeArcsec", "distanceKm", "distanceAu", "phase", "rise",
                                       "set", "transit", "terminatorFeatures", "nextFull", "nextNew", "moons",
                                       "ringTiltDeg", "constellation")}
    start = usable[0][0].strftime("%H:%M") if usable else None
    end = usable[-1][0].strftime("%H:%M") if usable else None
    return {
        "designation": name, "isMessier": False, "messierId": None, "commonName": en, "ngc": None,
        "type": kind, "typeCode": "Moon" if name == "Lune" else "Planet", "filter": "Aucun",
        "start": start, "end": end, "hours": float(len(usable)),
        "altMaxDeg": peak["alt"], "moonSepDeg": min((m for _, m in usable), default=0.0),
        "cadrage": fits_in_fov(size_arcmin, size_arcmin), "imageUrl": image_url(name),
        "ra": round(float(b.ra) * 12 / math.pi, 3), "dec": round(math.degrees(float(b.dec)), 3),
        "mag": round(float(b.mag), 1), "sizeW": round(size_arcmin, 2), "sizeH": round(size_arcmin, 2),
        "reasons": [] if usable else [
            "Jamais assez haut dans un secteur dégagé pendant la nuit noire (ou trop près du Soleil)."],
        "feasibleTonight": bool(usable),
        "altitudeSeries": series, "minAltDeg": float(min_alt),
        "peakSector": peak["sector"], "peakAz": peak["az"], "peakTime": peak["time"],
        "exposureLowMin": 0, "exposureHighMin": 0,
        "wiki": wiki_summary([WIKI_TITLES[name]]),
        "body": body,
    }
