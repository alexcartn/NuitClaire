"""Dependances de l'API : site effectif, et caches TTL (memes durees que les
`@st.cache_data` de app.py) pour les calculs meteo/ephemerides et les listes
de cibles faisables. `app.py` execute du code Streamlit au niveau module a
l'import (page config, rendu de la sidebar...), il n'est donc pas importable
depuis l'API -- cette petite couche de "colle" (boucle sur le catalogue,
appel des memes fonctions partagees que app.py : `scoring.target_windows`,
`rows.common_row_fields`, `scoring.view_window_df`) est dupliquee ici plutot
que factorisee, contrairement a la logique metier (row shaping, calculs de
score) qui elle vit dans des modules communs.

Starlette execute les handlers synchrones dans un vrai threadpool -- deux
requetes concurrentes sont possibles, contrairement au script Streamlit qui
traite une requete a la fois -- d'ou le verrou autour de chaque cache."""
import threading
from datetime import date, timedelta

from cachetools import TTLCache

import progress as progress_store
import settings as settings_store
from astro import night_hours, sky_frame, twilight_times
from catalog import load_targets, load_messier
from config import SITE, NB_FORECAST_NIGHTS, VIEW_WINDOW
from rows import common_row_fields
from scoring import night_summary, score_frame, score_label_fr, target_windows, view_window_df
from weather import fetch_all
from wiki import target_summary

_night_cache: TTLCache = TTLCache(maxsize=8, ttl=1800)
_night_lock = threading.Lock()

# Un verrou par fichier persiste (pas un seul verrou global) : serialise les
# sequences lecture-modification-ecriture de chaque store contre des
# requetes concurrentes, sans faire attendre une ecriture progress.json
# derriere une ecriture settings.json sans rapport.
progress_write_lock = threading.Lock()
settings_write_lock = threading.Lock()
sessions_write_lock = threading.Lock()
push_write_lock = threading.Lock()
_rows_cache: TTLCache = TTLCache(maxsize=32, ttl=1800)
_rows_lock = threading.Lock()
# Contenu quasi statique (meme rationale que `_cached_wiki_summary` dans
# app.py) : pas besoin de re-interroger Wikipedia a chaque ouverture de fiche.
_wiki_cache: TTLCache = TTLCache(maxsize=256, ttl=86400)
# Saisons Messier : pure geometrie, ne change qu'avec le site et l'horizon.
_season_cache: TTLCache = TTLCache(maxsize=8, ttl=86400)
_season_lock = threading.Lock()
_wiki_lock = threading.Lock()


def site_from_settings(s: dict) -> dict:
    """Site effectif a partir d'un blob settings deja charge -- extrait de
    `get_site()` pour que les appelants qui ont deja besoin du blob complet
    (site + window_mode, voir GET/PUT /api/settings et /api/state) ne
    relisent pas `settings.json`/Supabase une seconde fois juste pour le
    site."""
    saved = s.get("site")
    return saved if saved else dict(SITE)


def get_site() -> dict:
    """Site effectif : reglages persistes (`data/settings.json`) si presents,
    sinon `config.SITE`. A la difference de `st.session_state.site` cote
    Streamlit (ephemere, reinitialise a `config.SITE` a chaque session de
    navigateur), ce reglage est durable -- les deux frontends peuvent donc
    diverger sur la position active si l'un des deux change de site (choix
    delibere, voir le commentaire en tete de `settings.py`).

    Pour un appelant qui a aussi besoin de `window_mode`/`alerts` dans la
    meme requete, preferer `settings_store.load()` une fois puis
    `site_from_settings(s)` -- sinon deux lectures du meme blob pour rien."""
    return site_from_settings(settings_store.load())


def get_horizon() -> dict:
    """Profil d'horizon (secteur -> hauteur minimale, ou None si bouche),
    voir `progress.horizon_profile`."""
    return progress_store.horizon_profile(progress_store.load())


def get_window_mode() -> str:
    return settings_store.load()["window_mode"]


def get_view_window() -> dict:
    return settings_store.load()["view_window"]


def get_progress() -> dict:
    return progress_store.load()


def _site_key(site: dict) -> tuple:
    return (site["name"], site["lat"], site["lon"], site["elevation_m"], site["tz"])


def load_night(site: dict):
    """Equivalent de `app.load()` (meme logique, meme duree de cache TTL),
    sur `NB_FORECAST_NIGHTS` nuits plutot qu'une : les suivantes ne servent
    qu'au bandeau des prochaines nuits (voir GET /api/nights)."""
    key = _site_key(site)
    with _night_lock:
        cached = _night_cache.get(key)
        if cached is not None:
            return cached
        wx = fetch_all(days=NB_FORECAST_NIGHTS + 1, site=site)
        nights, twilights = {}, {}
        for i in range(NB_FORECAST_NIGHTS):
            d = date.today() + timedelta(days=i)
            hrs = night_hours(d, site=site)
            if not hrs:
                continue
            sky = sky_frame(hrs, site=site)
            df = sky.join(wx, how="left")
            nights[d] = score_frame(df)
            twilights[d] = twilight_times(d, site=site)
        result = (nights, twilights)
        _night_cache[key] = result
        return result


def current_night(site: dict):
    """Nuit affichee : celle d'aujourd'hui si elle a des heures astro
    calculables, sinon la premiere disponible -- meme repli que app.py.
    Renvoie (None, None, None) si aucune nuit n'est disponible."""
    nights, twilights = load_night(site)
    if not nights:
        return None, None, None
    sel = date.today() if date.today() in nights else next(iter(nights))
    return sel, nights[sel], twilights[sel]


def feasible_rows(site: dict, day: date, horizon: dict, window_mode: str, catalog: str,
                   view_window: dict | None = None) -> list[dict]:
    """Equivalent de `app.feasible_rows` : meme forme de ligne (via
    `rows.common_row_fields`). Le mode Habituelle/Nuit complete s'applique
    desormais aux deux catalogues ("targets" ET "messier") -- avant, le suivi
    Messier ignorait volontairement le mode de fenetre ; changement demande
    pour que la faisabilite affichee soit coherente partout dans l'appli
    (liste de cibles, catalogue Messier, graphe d'altitude de la fiche
    detail -- voir `scoring.in_observation_window`)."""
    view_window = view_window if view_window is not None else VIEW_WINDOW
    key = (_site_key(site), day, tuple(sorted(horizon.items())), window_mode,
           view_window["start_hour"], view_window["end_hour"], catalog)
    with _rows_lock:
        cached = _rows_cache.get(key)
        if cached is not None:
            return cached
        nights, _ = load_night(site)
        df = nights.get(day)
        if df is None:
            result: list[dict] = []
        else:
            view_df = view_window_df(df, window_mode, view_window)
            targets = load_messier() if catalog == "messier" else load_targets()
            result = []
            for tgt in targets:
                w = target_windows(view_df, tgt, horizon=horizon, site=site)
                if catalog == "targets" and w["hours"] == 0:
                    continue
                common = common_row_fields(tgt, w, view_df, horizon, site,
                                            compute_reasons=(catalog == "messier"))
                if catalog == "targets":
                    result.append({"Cible": w["name"], **common})
                else:
                    result.append({
                        "id": tgt["messier"], "Messier": tgt["name"],
                        "Faisable ce soir": "Oui" if w["hours"] > 0 else "Non",
                        **common,
                    })
        _rows_cache[key] = result
        return result


def current_score_pct(site: dict) -> int | None:
    """Score astro (0-100) de la nuit affichee, avec le mode de fenetre
    courant -- utilise a l'ouverture d'une session (voir `sessions.add_item`)
    pour figer le score du moment plutot que de le re-interroger a la
    cloture."""
    sel, df, _ = current_night(site)
    if sel is None:
        return None
    view_df = view_window_df(df, get_window_mode(), get_view_window())
    s = night_summary(view_df)
    pct, _ = score_label_fr(s["score"])
    return pct


def cached_wiki_summary(candidates: list[str]) -> dict | None:
    key = tuple(candidates)
    with _wiki_lock:
        if key in _wiki_cache:
            return _wiki_cache[key]
        result = target_summary(list(key))
        _wiki_cache[key] = result
        return result


def cached_messier_season(site: dict, horizon: dict) -> list[dict]:
    from season import messier_season

    key = (_site_key(site), tuple(sorted(horizon.items())), date.today().year)
    with _season_lock:
        if key not in _season_cache:
            _season_cache[key] = messier_season(load_messier(), site, horizon)
        return _season_cache[key]
