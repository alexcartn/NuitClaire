"""Resume Wikipedia (francais en priorite, repli anglais) pour la section
"En savoir plus" de la fiche detail d'une cible : histoire, legende du nom,
contexte -- aucune de ces informations n'existe dans le catalogue OpenNGC
(donnees purement astrometriques), donc on va les chercher en direct plutot
que de les inventer ou de les curer a la main pour des centaines d'objets."""
import re

import requests

WIKI_API_URL = "https://{lang}.wikipedia.org/w/api.php"
USER_AGENT = "NuitClaire/1.0 (usage personnel)"
LANGS = ("fr", "en")

# Nombre de phrases demandees a l'API (au-dela du seul chapeau introductif,
# souvent trop court -- voir _fetch_summary) : assez pour 2-4 paragraphes sur
# la plupart des objets Messier/NGC notables, sans aller chercher trop loin
# dans l'article ou le risque de tomber sur du balisage mathematique brut
# (formules de luminosite, etc., non nettoyees par l'API) augmente.
EXTRACT_SENTENCES = 10

# Certains extraits contiennent des formules <math> mal nettoyees par l'API
# (ex. "{\displaystyle L_{\odot }}" entoure de fragments MathML eclates sur
# plusieurs lignes) -- on tronque au dernier point complet avant ce marqueur
# plutot que d'afficher ce charabia.
_MATH_MARKER = "{\\displaystyle"
_HEADING_RE = re.compile(r"(?m)^=+\s*.*?\s*=+\s*$")
_BLANK_RUN_RE = re.compile(r"\n{3,}")


def _clean_extract(text: str) -> str:
    math_idx = text.find(_MATH_MARKER)
    if math_idx != -1:
        text = text[:math_idx]
        last_period = max(text.rfind(". "), text.rfind(".\n"))
        if last_period != -1:
            text = text[:last_period + 1]
    text = _HEADING_RE.sub("", text)
    return _BLANK_RUN_RE.sub("\n\n", text).strip()


def _fetch_summary(lang: str, title: str) -> dict | None:
    """Un seul essai (lang, title) -> resume ou None (page absente, ambigue,
    ou service injoignable -- echec silencieux, la section est juste masquee).

    Utilise l'API extracts (pas l'endpoint REST /page/summary) pour recuperer
    plusieurs phrases au-dela du seul chapeau introductif, qui tient souvent
    en une phrase sur les objets moins notables."""
    params = {
        "action": "query", "format": "json", "formatversion": "2",
        "prop": "extracts|pageprops", "explaintext": 1,
        "exsentences": EXTRACT_SENTENCES, "redirects": 1,
        "ppprop": "disambiguation", "titles": title,
    }
    try:
        r = requests.get(WIKI_API_URL.format(lang=lang), params=params,
                          headers={"User-Agent": USER_AGENT}, timeout=8)
    except requests.RequestException:
        return None
    if r.status_code != 200:
        return None
    pages = r.json().get("query", {}).get("pages", [])
    if not pages:
        return None
    page = pages[0]
    if page.get("missing") or "disambiguation" in (page.get("pageprops") or {}):
        return None
    extract = _clean_extract(page.get("extract", ""))
    if not extract:
        return None
    resolved_title = page.get("title", title)
    url = f"https://{lang}.wikipedia.org/wiki/{requests.utils.quote(resolved_title.replace(' ', '_'))}"
    return {"title": resolved_title, "extract": extract, "url": url, "lang": lang}


def target_summary(title_candidates: list[str]) -> dict | None:
    """Cherche un resume Wikipedia pour une cible, en essayant plusieurs titres
    de page possibles (ex. "Messier 31", "M31", nom commun, designation NGC),
    en francais d'abord puis en anglais si aucune page FR ne matche aucun
    candidat. Renvoie None si rien de trouve dans aucune langue."""
    for lang in LANGS:
        for title in title_candidates:
            if not title:
                continue
            result = _fetch_summary(lang, title)
            if result:
                return result
    return None
