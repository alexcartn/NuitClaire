"""Actualites astro : quelques flux RSS publics, fusionnes par date.

On ne garde que le titre, la date, la source, une image et un court
chapeau, avec le lien vers l'article : l'appui ouvre le site d'origine, rien
n'est recopie au-dela de ce que le flux publie pour etre repris.

Chaque article est range « a observer » (supernova, comete, eclipse,
opposition...), « espace » (missions, lancements) ou « image » (l'APOD), et
les objets qu'il cite (M31, NGC 7331, Saturne, C/2025 A1...) sont reperes :
l'appli dit s'ils sont visibles ce soir et ouvre leur fiche. Les rubriques
du magazine papier de Ciel & Espace (editorial, critiques de livres, BD)
sont ecartees : ce ne sont pas des nouvelles du ciel.

Lecture avec la bibliotheque standard (xml.etree), sans dependance : les
trois flux retenus sont du RSS 2.0. Chaque flux est garde 6 h en memoire ;
un flux injoignable garde sa derniere copie, et la reponse dit lesquels
manquent plutot que de faire echouer les autres.
"""
import html
import re
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

import unicodedata

import requests

import catalog

FEEDS = [
    ("Ciel & Espace", "https://www.cieletespace.fr/rss.xml"),
    ("Webastro", "https://www.webastro.net/forums/forum/49-lactualit%C3%A9-du-ciel.xml/"),
    ("APOD", "https://apod.nasa.gov/apod.rss"),
    # En anglais, les deux references de l'observation amateur : le ciel de
    # la semaine et les vraies nouvelles (Sky & Telescope ; son flux general
    # est ferme aux robots, pas celui-ci), et le ciel de chaque soir
    # (Astronomy, « The Sky Today »).
    ("Sky & Telescope", "https://skyandtelescope.org/astronomy-news/feed/"),
    ("Astronomy", "https://www.astronomy.com/feed/"),
]
TTL_S = 6 * 3600
MAX_AGE_DAYS = 60
SUMMARY_CHARS = 220
# Articles gardes par source : sans plafond, Ciel & Espace (plusieurs
# articles par jour) chasserait les sujets de Webastro. L'image du jour de
# la NASA : une seule, la derniere.
PER_SOURCE = 6
PER_SOURCE_LIMIT = {"APOD": 1}

_cache: dict[str, tuple[float, list[dict]]] = {}
_HEADERS = {"User-Agent": "nuitclaire/1.0"}
_TAG = re.compile(r"<[^>]+>")
_IMG = re.compile(r"""<img[^>]+src=["']([^"']+)["']""", re.I)
_ALT = re.compile(r"""<img[^>]+alt=["']([^"']*)["']""", re.I)
_APOD_DATE = re.compile(r"ap(\d{2})(\d{2})(\d{2})\.html")

# Rubriques du magazine papier (Ciel & Espace) : chroniques et critiques,
# pas des nouvelles du ciel.
DROPPED_CATEGORIES = {"editorial", "lire, voir", "regard", "bande dessinee", "agenda",
                      "l'image a remonter le temps", "today in the history of astronomy"}

# Mots qui signalent quelque chose a voir soi-meme, et mots de l'actualite
# spatiale (missions, fusees). Compares sans accents ni majuscules.
OBSERVE_WORDS = ("supernova", "nova ", "nova,", "comete", "eclipse", "opposition", "occultation",
                 "conjonction", "pluie d'etoiles", "etoiles filantes", "meteore", "aurore",
                 "a observer", "observer ", "a voir", "visible", "ciel du mois", "ciel de ",
                 # Pas « telescope » : il sert autant aux articles de science
                 # (un telescope spatial decouvre...) qu'a l'observation.
                 "amateur", "jumelles", "lunette", "transit", "perihelie", "pleine lune",
                 "comment observer",
                 # Sources anglaises.
                 "comet", "conjunction", "meteor", "aurora", "sky at a glance", "sky today",
                 "sky this week", "tonight", "binocular", "stargaz", "perihelion", "full moon",
                 "harvest moon", "when to see", "how to see", "naked eye")
SPACE_WORDS = ("lancement", "decollage", "fusee", "starship", "spacex", "mission", "sonde",
               "astronaute", "satellite", "orbite terrestre", "station spatiale", "artemis",
               "echantillons", "agence spatiale",
               "launch", "rocket", "spacecraft", "astronaut", "probe ", "space station")
PLANETS = ("Mercure", "Vénus", "Mars", "Jupiter", "Saturne", "Uranus", "Neptune")
# Nom anglais -> nom de l'appli (celui des planetes calculees, voir extras.py).
PLANETS_EN = {"Mercury": "Mercure", "Venus": "Vénus", "Saturn": "Saturne"}
_DESIGNATION = re.compile(r"(?<![\w/])(M|NGC|IC)\s?(\d{1,4})(?!\w)")
_COMET = re.compile(r"\b(?:[CP]/\d{4}\s?[A-Z]{1,2}\d{0,3}|\d{1,3}P)(?=[\s/),.;:]|$)")
MAX_OBJECTS = 3
# Le flux APOD ne donne qu'une vignette de calendrier (quelques dizaines de
# pixels) : floue en grand. La page du jour porte l'image a taille d'ecran.
_APOD_PAGE_IMG = re.compile(r"""<img\s+src=["'](image/[^"']+)["']""", re.I)
_apod_images: dict[str, str | None] = {}


def _fold(text: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", text.lower()) if unicodedata.category(c) != "Mn")


def fix_caps(title: str) -> str:
    """Titre ecrit tout en capitales -> casse de phrase."""
    letters = [c for c in title if c.isalpha()]
    if len(letters) < 6 or sum(c.isupper() for c in letters) / len(letters) < 0.7:
        return title
    lower = title.lower()
    return lower[:1].upper() + lower[1:]


def kind_of(source: str, title: str, summary: str, has_objects: bool) -> str:
    """« image » pour l'APOD, sinon « observer » ou « espace »."""
    if source == "APOD":
        return "image"
    text = _fold(f" {title} {summary} ")
    if any(w in text for w in OBSERVE_WORDS):
        return "observer"
    if any(w in text for w in SPACE_WORDS):
        return "espace"
    return "observer" if has_objects else "espace"


def objects_in(text: str) -> list[dict]:
    """Objets cites, dans l'ordre du texte : catalogue (resolu par
    catalog.find_target, un objet inconnu n'est pas retenu), planetes et
    cometes par leur designation."""
    hits: list[tuple[int, dict]] = []
    for m in _DESIGNATION.finditer(text):
        target = catalog.find_target(f"{m[1]}{m[2]}")
        if target:
            label = f"M{m[2]}" if m[1] == "M" else f"{m[1]} {m[2]}"
            hits.append((m.start(), {"kind": "target", "designation": target["name"], "label": label,
                                     "messier": target.get("messier"), "ngc": target.get("ngc_name")}))
    for word, planet in [(p, p) for p in PLANETS] + list(PLANETS_EN.items()):
        m = re.search(rf"(?<!\w){word}(?!\w)", text)
        if m:
            hits.append((m.start(), {"kind": "planet", "designation": planet, "label": planet,
                                     "messier": None, "ngc": None}))
    for m in _COMET.finditer(text):
        name = re.sub(r"\s+", " ", m[0])
        hits.append((m.start(), {"kind": "comet", "designation": name, "label": name, "messier": None, "ngc": None}))
    found, seen = [], set()
    for _, obj in sorted(hits, key=lambda h: h[0]):
        if obj["designation"] not in seen and len(found) < MAX_OBJECTS:
            seen.add(obj["designation"])
            found.append(obj)
    return found


def _text(el: ET.Element | None) -> str:
    return (el.text or "").strip() if el is not None else ""


def _clean(fragment: str) -> str:
    """HTML d'une description -> texte brut sur une ligne."""
    return re.sub(r"\s+", " ", html.unescape(_TAG.sub(" ", html.unescape(fragment)))).strip()


# Formules que WordPress ajoute a chaque description.
_WP_BOILERPLATE = re.compile(r"\s*(Continue reading\b.*|The post .* appeared first on .*)$", re.S)
# Et la phrase d'appel qui ouvre chaque « Sky Today » d'Astronomy.
_PROMO = re.compile(r"^Looking for a sky event this week\?\s*Check out our full\s+Sky This Week\s+column\.\s*", re.I)


def _summary(text: str) -> str:
    text = _WP_BOILERPLATE.sub("", text).strip()
    text = _PROMO.sub("", text).strip()
    if len(text) <= SUMMARY_CHARS:
        return text
    cut = text[:SUMMARY_CHARS].rsplit(" ", 1)[0]
    return cut + "…"


def _date(item: ET.Element, link: str) -> datetime | None:
    raw = _text(item.find("pubDate"))
    if raw:
        try:
            d = parsedate_to_datetime(raw)
            return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
        except (TypeError, ValueError):
            pass
    m = _APOD_DATE.search(link)
    if m:
        return datetime(2000 + int(m[1]), int(m[2]), int(m[3]), 12, tzinfo=timezone.utc)
    if link.rstrip("/").endswith("astropix.html"):
        return datetime.now(timezone.utc).replace(hour=12, minute=0, second=0, microsecond=0)
    return None


def _image(item: ET.Element, description: str) -> str | None:
    enclosure = item.find("enclosure")
    if enclosure is not None and (enclosure.get("type") or "").startswith("image/"):
        return enclosure.get("url")
    for el in item:
        if el.tag.endswith("}content") and el.get("url") and (el.get("medium") == "image"
                                                                or (el.get("type") or "").startswith("image/")):
            return el.get("url")
    for src in _IMG.findall(html.unescape(description)):
        if "emoticons" not in src:
            return src
    return None


def parse_rss(source: str, xml_text: str | bytes) -> list[dict]:
    root = ET.fromstring(xml_text)
    out = []
    for item in root.iter("item"):
        link = _text(item.find("link"))
        raw_desc = _text(item.find("description"))
        title = _clean(_text(item.find("title")))
        if not title:
            # APOD laisse parfois le titre vide : l'alt de l'image le donne.
            alts = _ALT.findall(html.unescape(raw_desc))
            title = alts[0].strip() if alts else ""
        if not link or not title:
            continue
        categories = {_fold(_text(c)) for c in item.findall("category")}
        if categories & DROPPED_CATEGORIES:
            continue
        title = fix_caps(title)
        when = _date(item, link)
        text = _clean(raw_desc)
        summary = _summary(text) if text and text != title else ""
        objects = objects_in(f"{title} {text}")
        out.append({
            "title": title,
            "link": link,
            "source": source,
            "date": when.isoformat() if when else None,
            "summary": summary,
            "image": _image(item, raw_desc),
            "kind": kind_of(source, title, text, bool(objects)),
            "objects": objects,
        })
    return out


def fetch_feed(source: str, url: str, now: float | None = None) -> list[dict] | None:
    now = time.time() if now is None else now
    cached = _cache.get(source)
    if cached and now - cached[0] < TTL_S:
        return cached[1]
    try:
        r = requests.get(url, timeout=10, headers=_HEADERS)
        r.raise_for_status()
        # Les octets bruts : l'en-tete XML porte l'encodage, pas HTTP.
        items = parse_rss(source, r.content)
        _cache[source] = (now, items)
        return items
    except (requests.RequestException, ET.ParseError, ValueError):
        return cached[1] if cached else None


def merge(by_source: dict[str, list[dict]], now: datetime, limit: int = 40) -> list[dict]:
    """Articles recents de toutes les sources, du plus recent au plus
    ancien. Sans date, un article est ecarte : impossible de le ranger, et
    les sujets epingles des forums datent parfois de quinze ans."""
    oldest = now - timedelta(days=MAX_AGE_DAYS)
    kept = []
    for source, items in by_source.items():
        dated = [i for i in items if i["date"] and oldest <= datetime.fromisoformat(i["date"]) <= now + timedelta(days=1)]
        dated.sort(key=lambda i: i["date"], reverse=True)
        kept += dated[:PER_SOURCE_LIMIT.get(source, PER_SOURCE)]
    kept.sort(key=lambda i: i["date"], reverse=True)
    return kept[:limit]


def apod_image(link: str) -> str | None:
    """Image de la page APOD `link`, gardee en memoire ; None un jour de
    video ou si la page est injoignable (la vignette du flux reste alors)."""
    if link in _apod_images:
        return _apod_images[link]
    try:
        r = requests.get(link, timeout=10, headers=_HEADERS)
        r.raise_for_status()
        m = _APOD_PAGE_IMG.search(r.text)
        url = requests.compat.urljoin(link, m[1]) if m else None
    except requests.RequestException:
        return None
    _apod_images[link] = url
    return url


def latest() -> dict:
    """Reponse de GET /api/news."""
    by_source, missing = {}, []
    for source, url in FEEDS:
        items = fetch_feed(source, url)
        if items is None:
            missing.append(source)
        else:
            by_source[source] = items
    items = merge(by_source, datetime.now(timezone.utc))
    for item in items:
        if item["kind"] == "image":
            item["image"] = apod_image(item["link"]) or item["image"]
    return {"items": items, "missing": missing}
