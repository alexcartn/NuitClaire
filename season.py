"""Saisons des objets : a quels moments de l'annee chacun est photographiable
depuis le site, et combien d'heures par nuit.

Deux lectures de la meme geometrie, sans meteo ni Lune. Pour chaque nuit, heure
par heure, on compte les heures noires (Soleil sous -12 deg) ou l'objet est
entre sa hauteur minimale (voir `scoring.min_alt_for`) et le zenith du
Seestar, dans un secteur d'horizon degage.

- `messier_season` : un echantillon par mois (la nuit du 15), pour la page
  Messier (le « Pokedex ») : ce qui est visible ce mois-ci, ce qui s'en va
  bientot, ce qui arrive, et ce qui ne sera jamais atteignable d'ici. Le motif
  se repete d'une annee a l'autre : le calcul se fait sur l'annee en cours et
  se met en cache.
- `target_year_windows` : une cible, nuit par nuit sur les 12 prochains mois,
  pour sa fiche : de quelle date a quelle date elle est atteignable, ou
  pourquoi elle ne l'est jamais."""
import math
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
from zoneinfo import ZoneInfo

import ephem

from astro import COMPASS_SECTORS, compass_sector
from scoring import culmination_deg, max_alt_for, min_alt_for, sector_floor

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
                floor = sector_floor(horizon, compass_sector(math.degrees(body.az)))
                if floor is not None and max(min_alt, floor) <= alt <= max_alt_for(tgt):
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


YEAR_DAYS = 365
# Une nuit compte quand l'objet reste pointable au moins 2 h : avec un echantillon
# par heure, un seul est ambigu (de quelques minutes a deux heures) et c'est la
# que le resultat clignote d'un soir a l'autre.
MIN_NIGHT_HOURS = 2
BRIDGE_DAYS, MIN_RUN_DAYS = 3, 3
NIGHT_FIRST_HOUR, NIGHT_SAMPLE_COUNT = 18, 14   # 18 h -> 7 h, comme `_night_samples`


@lru_cache(maxsize=8)
def _dark_nights(lat: float, lon: float, elevation_m: float, tz: str,
                 first_day: date, days: int) -> tuple[tuple[float, ...], ...]:
    """Pour chacune des `days` nuits qui commencent a partir de `first_day`
    (18 h locales), les instants (jours ephem) des heures noires. Ne depend
    que du site et de la date : calcule une fois, partage par toutes les
    cibles."""
    zone = ZoneInfo(tz)
    obs = ephem.Observer()
    obs.lat, obs.lon, obs.elevation, obs.pressure = str(lat), str(lon), elevation_m, 0
    nights = []
    for d in range(days):
        day = first_day + timedelta(days=d)
        # Arithmetique en UTC : les nuits de changement d'heure comptent
        # leurs vraies heures, pas celles du mur.
        start = datetime(day.year, day.month, day.day, NIGHT_FIRST_HOUR, tzinfo=zone).astimezone(timezone.utc)
        dark = []
        for h in range(NIGHT_SAMPLE_COUNT):
            obs.date = ephem.Date(start + timedelta(hours=h))
            if math.degrees(ephem.Sun(obs).alt) < DARK_SUN_ALT:
                dark.append(float(obs.date))
        nights.append(tuple(dark))
    return tuple(nights)


def _runs(flags: list[bool], value: bool) -> list[tuple[int, int]]:
    """Plages consecutives de `value` dans une liste lue comme un cercle (le
    ciel d'une annee revient a l'identique : le dernier jour touche le
    premier). (debut, longueur), debut dans [0, n[ ; une plage peut donc
    passer par la fin de la liste et reprendre au debut."""
    n = len(flags)
    if all(f == value for f in flags):
        return [(0, n)]
    runs = []
    for i in range(n):
        if flags[i] == value and flags[i - 1] != value:
            length = 0
            while flags[(i + length) % n] == value:
                length += 1
            runs.append((i, length))
    return runs


def workable_days(hours: list[int]) -> list[bool]:
    """Jours ou l'objet est atteignable, a partir des heures observables de
    chaque nuit. Avec un echantillon par heure, une nuit a une seule heure est
    ambigue (de quelques minutes a deux heures) et, en bord de saison, cela
    donne un resultat qui clignote d'un soir a l'autre. On ne garde donc que les
    nuits d'au moins `MIN_NIGHT_HOURS` h, puis on referme les trous : une suite
    de nuits qui gardent encore une heure n'est pas une vraie interruption, ni
    un trou de `BRIDGE_DAYS` jours ou moins. Les plages de moins de
    `MIN_RUN_DAYS` jours sont ecartees."""
    n = len(hours)
    strict = [h >= MIN_NIGHT_HOURS for h in hours]
    out = list(strict)
    for start, length in _runs(strict, False):
        days = [(start + k) % n for k in range(length)]
        if length < n and (length <= BRIDGE_DAYS or all(hours[d] >= 1 for d in days)):
            for d in days:
                out[d] = True
    for start, length in _runs(out, True):
        if length < MIN_RUN_DAYS and length < n:
            for k in range(length):
                out[(start + k) % n] = False
    return out


def circular_runs(flags: list[bool]) -> list[tuple[int, int]]:
    """Plages de `True` en (debut, longueur) par rapport au jour 0 : le debut
    est negatif pour la plage deja commencee avant aujourd'hui (elle passe par
    le jour 0 en reprenant au debut du cercle). Liste vide si tout est faux ;
    une seule plage (0, n) si tout est vrai ; triees par debut."""
    n = len(flags)
    if not any(flags):
        return []
    return sorted((i - n if i + length > n else i, length) for i, length in _runs(flags, True))


def target_year_windows(target: dict, site: dict, horizon: dict | None = None,
                        today: date | None = None) -> dict:
    """Quand `target` est atteignable depuis `site` sur les 12 prochains mois :
    mini hauteur de l'instrument (`target["optics"]` pour les jumelles et
    l'oeil), horizon degage, nuit noire. Pas de meteo ni de Lune (on ne les
    connait pas a l'avance) : c'est la geometrie du ciel.

    `status` :
    - `unreachable` : ne monte jamais assez haut depuis ce site ;
    - `hidden` : monte assez haut, mais jamais dans un secteur d'horizon degage ;
    - `seasonal` : atteignable une partie de l'annee, `windows` en donne les
      dates (une fenetre deja commencee a un `start` passe et `current` vrai) ;
    - `allYear` : atteignable toute l'annee, `windows` est alors vide.
    `peakDate`/`peakHours` : la meilleure nuit de l'annee (la plus d'heures)."""
    horizon = horizon if horizon is not None else {s: True for s in COMPASS_SECTORS}
    today = today or datetime.now(ZoneInfo(site["tz"])).date()
    min_alt, max_alt = min_alt_for(target, site), max_alt_for(target)
    culmination = culmination_deg(target["dec"], site["lat"])

    body = ephem.FixedBody()
    body._ra = ephem.hours(target["ra"] * 15 * math.pi / 180)
    body._dec = ephem.degrees(str(target["dec"]))
    obs = ephem.Observer()
    obs.lat, obs.lon, obs.elevation, obs.pressure = str(site["lat"]), str(site["lon"]), site.get("elevation_m", 0), 0

    nights = _dark_nights(site["lat"], site["lon"], site.get("elevation_m", 0), site["tz"], today, YEAR_DAYS)
    hours, hours_ignoring_horizon = [], []
    for samples in nights:
        ok = free = 0
        for when in samples:
            obs.date = when
            body.compute(obs)
            alt = math.degrees(body.alt)
            if not min_alt <= alt <= max_alt:
                continue
            free += 1
            floor = sector_floor(horizon, compass_sector(math.degrees(body.az)))
            if floor is not None and alt >= floor:
                ok += 1
        hours.append(ok)
        hours_ignoring_horizon.append(free)

    workable = workable_days(hours)
    out = {
        "culminationDeg": round(culmination, 1), "minAltDeg": min_alt,
        "windows": [], "peakDate": None, "peakHours": 0,
    }
    if not any(workable):
        free = workable_days(hours_ignoring_horizon)
        out["status"] = "hidden" if any(free) else "unreachable"
        return out

    peak = max(hours)
    peak_days = [i for i, h in enumerate(hours) if h == peak]
    # Au milieu de la plage de meilleures nuits (a egalite d'heures sur
    # plusieurs semaines, la premiere ne dit rien).
    out["peakDate"] = (today + timedelta(days=peak_days[len(peak_days) // 2])).isoformat()
    out["peakHours"] = peak
    runs = circular_runs(workable)
    if runs == [(0, YEAR_DAYS)]:
        out["status"] = "allYear"
        return out

    out["status"] = "seasonal"
    for start, length in runs:
        days = [(start + k) % YEAR_DAYS for k in range(length)]
        best = max(hours[d] for d in days)
        best_offsets = [k for k, d in enumerate(days) if hours[d] == best]
        out["windows"].append({
            "start": (today + timedelta(days=start)).isoformat(),
            "end": (today + timedelta(days=start + length - 1)).isoformat(),
            "current": start <= 0 <= start + length - 1,
            "peakDate": (today + timedelta(days=start + best_offsets[len(best_offsets) // 2])).isoformat(),
            "peakHours": best,
        })
    return out
