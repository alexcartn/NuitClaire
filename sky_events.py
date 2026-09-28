"""Agenda du ciel : ce qui arrive dans les semaines qui viennent, calcule
pour le lieu avec PyEphem plutot que lu dans les articles (des dates dans
du texte, c'est fragile, et aux heures d'un autre fuseau).

- nouvelle et pleine Lune (la nuit noire, et celle a eviter) ;
- eclipses de Lune : a chaque pleine Lune, la distance de la Lune au centre
  de l'ombre de la Terre dit s'il y a eclipse (penombre, partielle,
  totale), et sa hauteur si elle se voit d'ici ;
- oppositions des planetes (au plus pres, visibles toute la nuit) ;
- rapprochements Lune-planete (moins de 4 deg) et planete-planete (moins
  de 2 deg) ;
- pluies d'etoiles filantes, a leur maximum, avec l'eclairement de la Lune
  qui decide si ca vaut la peine.

Pas d'eclipses de Soleil : leur visibilite locale demande un calcul que
PyEphem ne fait pas, et une eclipse annoncee a tort serait pire que rien.
"""
import math
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import ephem

from extras import _observer

PLANETS = [("Mercure", ephem.Mercury), ("Vénus", ephem.Venus), ("Mars", ephem.Mars),
           ("Jupiter", ephem.Jupiter), ("Saturne", ephem.Saturn)]
OUTER = [("Mars", ephem.Mars), ("Jupiter", ephem.Jupiter), ("Saturne", ephem.Saturn),
         ("Uranus", ephem.Uranus), ("Neptune", ephem.Neptune)]
MOON_CONJ_DEG = 4.0
PLANET_CONJ_DEG = 2.0

# Pluies d'etoiles filantes principales : (nom, mois, jour du maximum, taux
# horaire zenithal, constellation du radiant). Dates du maximum stables a un
# jour pres d'une annee a l'autre (IMO).
METEOR_SHOWERS = [
    ("Quadrantides", 1, 3, 110, "Bouvier"), ("Lyrides", 4, 22, 18, "Lyre"),
    ("Êta Aquarides", 5, 6, 50, "Verseau"), ("Perséides", 8, 12, 100, "Persée"),
    ("Draconides", 10, 8, 10, "Dragon"), ("Orionides", 10, 21, 20, "Orion"),
    ("Léonides", 11, 17, 15, "Lion"), ("Géminides", 12, 14, 150, "Gémeaux"),
    ("Ursides", 12, 22, 10, "Petite Ourse"),
]

# Rayons apparents moyens de l'ombre et de la penombre de la Terre a la
# distance de la Lune, et rayon de la Lune (deg).
UMBRA_DEG = 0.72
PENUMBRA_DEG = 1.28
MOON_RADIUS_DEG = 0.26


def _local(d: ephem.Date, tz: ZoneInfo) -> datetime:
    return d.datetime().replace(tzinfo=timezone.utc).astimezone(tz)


def _fmt_deg(x: float) -> str:
    return f"{x:.1f}".replace(".", ",")


def _dark(site: dict, when: datetime) -> bool:
    return math.degrees(ephem.Sun(_observer(site, when)).alt) < -6


def _event(when: datetime, kind: str, title: str, detail: str, visible: bool | None,
           objects: list[str] | None = None) -> dict:
    return {"date": when.isoformat(), "kind": kind, "title": title, "detail": detail,
            "visible": visible, "objects": objects or []}


def moon_events(site: dict, start: datetime, end: datetime) -> list[dict]:
    """Nouvelles et pleines Lunes, et les eclipses de Lune."""
    tz = ZoneInfo(site["tz"])
    out = []
    d = ephem.Date(start.astimezone(timezone.utc))
    while True:
        new = ephem.next_new_moon(d)
        if _local(new, tz) > end:
            break
        out.append(_event(_local(new, tz), "lune", "Nouvelle Lune",
                          "Nuits noires autour de cette date : le meilleur moment pour le ciel profond.", None))
        d = ephem.Date(new + 1)
    d = ephem.Date(start.astimezone(timezone.utc))
    while True:
        full = ephem.next_full_moon(d)
        when = _local(full, tz)
        if when > end:
            break
        eclipse = lunar_eclipse(site, when)
        out.append(eclipse or _event(when, "lune", "Pleine Lune",
                                     "Ciel lavé toute la nuit : Lune, planètes et étoiles doubles plutôt que galaxies.",
                                     None))
        d = ephem.Date(full + 1)
    return out


def lunar_eclipse(site: dict, when: datetime) -> dict | None:
    """Eclipse de Lune a la pleine Lune `when`, s'il y en a une : distance de
    la Lune au centre de l'ombre (le point oppose au Soleil)."""
    obs = _observer(site, when)
    moon, sun = ephem.Moon(obs), ephem.Sun(obs)
    anti_ra = (float(sun.g_ra) + math.pi) % (2 * math.pi)
    anti_dec = -float(sun.g_dec)
    sep = math.degrees(float(ephem.separation((moon.g_ra, moon.g_dec), (anti_ra, anti_dec))))
    if sep + MOON_RADIUS_DEG < UMBRA_DEG:
        kind = "totale"
    elif sep - MOON_RADIUS_DEG < UMBRA_DEG:
        kind = "partielle"
    elif sep - MOON_RADIUS_DEG < PENUMBRA_DEG:
        kind = "par la pénombre"
    else:
        return None
    alt = math.degrees(moon.alt)
    visible = alt > 0
    where = f"Lune à {round(alt)}° au maximum de l'éclipse" if visible else "Lune sous l'horizon d'ici au maximum"
    detail = (f"{where}." if kind != "par la pénombre"
              else f"{where} ; assombrissement léger, à peine visible à l'œil.")
    return _event(when, "eclipse", f"Éclipse {kind} de Lune", detail, visible, ["Lune"])


def oppositions(site: dict, start: datetime, end: datetime) -> list[dict]:
    """Planetes a l'opposition : l'elongation passe par son maximum."""
    tz = ZoneInfo(site["tz"])
    out = []
    days = (end - start).days + 2
    for name, cls in OUTER:
        elong = []
        for k in range(-1, days + 1):
            t = start + timedelta(days=k)
            body = cls(ephem.Date(t.astimezone(timezone.utc)))
            elong.append((t, abs(math.degrees(float(body.elong)))))
        for i in range(1, len(elong) - 1):
            t, e = elong[i]
            if e > 170 and e >= elong[i - 1][1] and e > elong[i + 1][1] and start <= t <= end:
                body = cls(ephem.Date(t.astimezone(timezone.utc)))
                mag = f"{float(body.mag):.1f}".replace(".", ",")
                of = "d'" if name[0] in "AEIOUÉ" else "de "
                out.append(_event(t.astimezone(tz).replace(hour=0, minute=0, second=0, microsecond=0),
                                  "planete", f"Opposition {of}{name}",
                                  f"Au plus près et visible toute la nuit, magnitude {mag}.", True, [name]))
    return out


def conjunctions(site: dict, start: datetime, end: datetime, step_h: int = 2) -> list[dict]:
    """Rapprochements Lune-planete et planete-planete, au plus pres."""
    tz = ZoneInfo(site["tz"])
    out = []
    pairs = [("Lune", ephem.Moon, name, cls, MOON_CONJ_DEG) for name, cls in PLANETS + OUTER[2:3]]
    pairs += [(a, ca, b, cb, PLANET_CONJ_DEG) for i, (a, ca) in enumerate(PLANETS + OUTER[2:3])
              for (b, cb) in (PLANETS + OUTER[2:3])[i + 1:]]
    step = timedelta(hours=step_h)
    for a, ca, b, cb, limit in pairs:
        samples = []
        t = start - step
        while t <= end + step:
            obs = _observer(site, t)
            samples.append((t, math.degrees(float(ephem.separation(ca(obs), cb(obs))))))
            t += step
        for i in range(1, len(samples) - 1):
            t, sep = samples[i]
            if sep < limit and sep <= samples[i - 1][1] and sep < samples[i + 1][1] and start <= t <= end:
                best = _best_dark_moment(site, ca, cb, t)
                objects = [x for x in (a, b) if x != "Lune"]
                if best is None:
                    # Trop pres du Soleil pour la voir d'ici : pas la peine
                    # de l'annoncer.
                    continue
                bt, bsep, alt = best
                when = bt.astimezone(tz)
                if a == "Lune":
                    title = f"La Lune à {_fmt_deg(bsep)}° de {b}"
                else:
                    title = f"{a} et {b} à {_fmt_deg(bsep)}°"
                out.append(_event(when, "rapprochement", title,
                                  f"À {round(alt)}° de hauteur"
                                  + (f" (au plus près : {_fmt_deg(sep)}°, de jour)." if bsep - sep > 0.3 else "."),
                                  True, objects))
    return out


def _best_dark_moment(site: dict, ca, cb, t: datetime) -> tuple[datetime, float, float] | None:
    """Le moment observable le plus serre a moins de 18 h du rapprochement :
    ciel noir, les deux astres a plus de 10 deg. Un rapprochement de plein
    jour se regarde la nuit d'avant ou d'apres."""
    best = None
    k = timedelta(minutes=30)
    u = t - timedelta(hours=18)
    while u <= t + timedelta(hours=18):
        obs = _observer(site, u)
        a, b = ca(obs), cb(obs)
        alt = min(math.degrees(a.alt), math.degrees(b.alt))
        if alt > 10 and _dark(site, u):
            sep = math.degrees(float(ephem.separation(a, b)))
            if best is None or sep < best[1]:
                best = (u, sep, alt)
        u += k
    return best


def meteor_showers(site: dict, start: datetime, end: datetime) -> list[dict]:
    tz = ZoneInfo(site["tz"])
    out = []
    for year in {start.year, end.year}:
        for name, month, day, zhr, radiant in METEOR_SHOWERS:
            # Le maximum se regarde dans la nuit du jour dit, apres minuit.
            when = datetime(year, month, day, 23, tzinfo=tz)
            if not start <= when <= end + timedelta(hours=23):
                continue
            obs = _observer(site, when + timedelta(hours=4))
            illum = round(ephem.Moon(obs).phase)
            moon = ("Lune presque absente, conditions idéales" if illum < 25
                    else f"Lune éclairée à {illum} %, les plus faibles seront noyées" if illum > 60
                    else f"Lune éclairée à {illum} %")
            out.append(_event(when, "meteores", f"{name} (maximum)",
                              f"Jusqu'à {zhr} météores/h sous un ciel parfait, radiant dans {'le ' if radiant in ('Bouvier', 'Verseau', 'Dragon', 'Lion') else ''}{radiant} ; {moon}.",
                              True))
    return out


def upcoming(site: dict, today: date, days: int = 30) -> list[dict]:
    """Evenements des `days` prochains jours, dans l'ordre."""
    tz = ZoneInfo(site["tz"])
    start = datetime(today.year, today.month, today.day, 12, tzinfo=tz)
    end = start + timedelta(days=days)
    events = (moon_events(site, start, end) + oppositions(site, start, end)
              + conjunctions(site, start, end) + meteor_showers(site, start, end))
    return sorted(events, key=lambda e: e["date"])
