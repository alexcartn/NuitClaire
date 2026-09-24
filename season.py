"""Saisons des objets Messier : a quels mois de l'annee chacun est
photographiable depuis le site, et combien d'heures par nuit.

Sert la page Messier (le « Pokedex ») : dire ce qui est visible ce mois-ci,
ce qui s'en va bientot, ce qui arrive, et ce qui ne sera jamais atteignable
d'ici. Aucune meteo ici, uniquement la geometrie du ciel : pour chaque mois,
la nuit du 15, heure par heure, on compte les heures noires (Soleil sous
-12 deg) ou l'objet est entre sa hauteur minimale (voir
`scoring.min_alt_for`) et le zenith du Seestar, dans un secteur d'horizon
degage. Le motif se repete d'une annee a l'autre : le calcul se fait sur
l'annee en cours et se met en cache."""
import math
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import ephem

from astro import COMPASS_SECTORS, compass_sector
from config import SEESTAR
from scoring import culmination_deg, min_alt_for

DARK_SUN_ALT = -12.0


def _night_samples(year: int, month: int, site: dict) -> list[ephem.Observer]:
    """Observateurs aux heures noires de la nuit du 15 du mois (18 h -> 7 h)."""
    tz = ZoneInfo(site["tz"])
    start = datetime(year, month, 15, 18, tzinfo=tz)
    out = []
    for h in range(14):
        obs = ephem.Observer()
        obs.lat, obs.lon = str(site["lat"]), str(site["lon"])
        obs.elevation = site.get("elevation_m", 0)
        obs.pressure = 0
        obs.date = (start + timedelta(hours=h)).astimezone(timezone.utc)
        if math.degrees(ephem.Sun(obs).alt) < DARK_SUN_ALT:
            out.append(obs)
    return out


def messier_season(targets: list[dict], site: dict, horizon: dict | None = None,
                   year: int | None = None) -> list[dict]:
    """Pour chaque objet : heures observables par nuit pour chacun des 12 mois,
    meilleur mois, hauteur de culmination et hauteur minimale exigee."""
    year = year or date.today().year
    horizon = horizon if horizon is not None else {s: True for s in COMPASS_SECTORS}
    open_sectors = {s for s, ok in horizon.items() if ok}
    samples = [_night_samples(year, m, site) for m in range(1, 13)]

    out = []
    for tgt in targets:
        body = ephem.FixedBody()
        body._ra = ephem.hours(tgt["ra"] * 15 * math.pi / 180)
        body._dec = ephem.degrees(str(tgt["dec"]))
        min_alt = min_alt_for(tgt, site)
        month_hours = []
        for obs_list in samples:
            hours = 0
            for obs in obs_list:
                body.compute(obs)
                alt = math.degrees(body.alt)
                if min_alt <= alt <= SEESTAR["max_alt_deg"] \
                        and compass_sector(math.degrees(body.az)) in open_sectors:
                    hours += 1
            month_hours.append(hours)
        best = max(range(12), key=lambda i: month_hours[i]) if any(month_hours) else None
        culmination = culmination_deg(tgt["dec"], site["lat"])
        out.append({
            "id": tgt.get("messier"), "designation": tgt["name"],
            "culminationDeg": round(culmination, 1), "minAltDeg": min_alt,
            "reachable": culmination >= min_alt,
            "monthHours": month_hours,
            "bestMonth": best + 1 if best is not None else None,
        })
    return out
