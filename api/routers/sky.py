"""GET /api/sky/bodies -- Lune et planetes pour la carte du ciel du mobile.

Les etoiles se calculent sur le telephone (positions fixes) ; la Lune et les
planetes bougent, et leur ephemeride demande PyEphem. Positions
equatoriales (J2000) a un instant, que le telephone convertit en hauteur et
azimut a l'heure qu'il affiche : sur une nuit, les planetes se deplacent a
peine, la Lune d'environ 0,5 deg par heure -- d'ou l'heure de reference
renvoyee, pour la reinterroger si la carte vise loin dans la nuit."""
import math
from datetime import datetime, timezone

import ephem
from fastapi import APIRouter

import settings as settings_store
from api.deps import site_from_settings

router = APIRouter()

PLANETS = [("Mercure", ephem.Mercury), ("Vénus", ephem.Venus), ("Mars", ephem.Mars),
           ("Jupiter", ephem.Jupiter), ("Saturne", ephem.Saturn)]


def bodies_at(when: datetime, site: dict) -> dict:
    obs = ephem.Observer()
    obs.lat, obs.lon = str(site["lat"]), str(site["lon"])
    obs.elevation = site.get("elevation_m", 0)
    obs.date = when.astimezone(timezone.utc)

    def pos(body) -> dict:
        # a_ra / a_dec : astrometriques J2000, comme le catalogue d'etoiles.
        return {"raDeg": round(math.degrees(body.a_ra), 3), "decDeg": round(math.degrees(body.a_dec), 3)}

    moon = ephem.Moon(obs)
    planets = []
    for name, cls in PLANETS:
        p = cls(obs)
        planets.append({"name": name, **pos(p), "mag": round(float(p.mag), 1)})
    return {
        "time": when.astimezone(timezone.utc).isoformat(),
        "moon": {**pos(moon), "illum": round(moon.phase, 0)},
        "planets": planets,
    }


@router.get("/api/sky/bodies")
def sky_bodies() -> dict:
    site = site_from_settings(settings_store.load())
    return bodies_at(datetime.now(timezone.utc), site)
