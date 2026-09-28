"""Actualites astro : quelques flux RSS publics, fusionnes par date.

On ne garde que le titre, la date, la source, une image et un court
chapeau, avec le lien vers l'article : l'appui ouvre le site d'origine, rien
n'est recopie au-dela de ce que le flux publie pour etre repris.

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

import requests

FEEDS = [
    ("Ciel & Espace", "https://www.cieletespace.fr/rss.xml"),
    ("Webastro", "https://www.webastro.net/forums/forum/49-lactualit%C3%A9-du-ciel.xml/"),
    ("APOD", "https://apod.nasa.gov/apod.rss"),
]
TTL_S = 6 * 3600
MAX_AGE_DAYS = 60
SUMMARY_CHARS = 220
# Articles gardes par source : sans plafond, Ciel & Espace (plusieurs
# articles par jour) chasserait les sujets de Webastro. L'image du jour de
# la NASA : une seule, la derniere.
PER_SOURCE = 8
PER_SOURCE_LIMIT = {"APOD": 1}

_cache: dict[str, tuple[float, list[dict]]] = {}
_HEADERS = {"User-Agent": "nuitclaire/1.0"}
_TAG = re.compile(r"<[^>]+>")
_IMG = re.compile(r"""<img[^>]+src=["']([^"']+)["']""", re.I)
_ALT = re.compile(r"""<img[^>]+alt=["']([^"']*)["']""", re.I)
_APOD_DATE = re.compile(r"ap(\d{2})(\d{2})(\d{2})\.html")


def _text(el: ET.Element | None) -> str:
    return (el.text or "").strip() if el is not None else ""


def _clean(fragment: str) -> str:
    """HTML d'une description -> texte brut sur une ligne."""
    return re.sub(r"\s+", " ", html.unescape(_TAG.sub(" ", html.unescape(fragment)))).strip()


def _summary(text: str) -> str:
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
        when = _date(item, link)
        text = _clean(raw_desc)
        out.append({
            "title": title,
            "link": link,
            "source": source,
            "date": when.isoformat() if when else None,
            "summary": _summary(text) if text and text != title else "",
            "image": _image(item, raw_desc),
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


def merge(by_source: dict[str, list[dict]], now: datetime, limit: int = 20) -> list[dict]:
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


def latest() -> dict:
    """Reponse de GET /api/news."""
    by_source, missing = {}, []
    for source, url in FEEDS:
        items = fetch_feed(source, url)
        if items is None:
            missing.append(source)
        else:
            by_source[source] = items
    return {"items": merge(by_source, datetime.now(timezone.utc)), "missing": missing}
