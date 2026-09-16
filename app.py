"""Tableau de bord Streamlit : score astro, cibles par direction/horizon, suivi Messier."""
from datetime import date, timedelta
from html import escape
from itertools import groupby
from typing import Callable
from zoneinfo import ZoneInfo

import altair as alt
import pandas as pd
import streamlit as st

from config import SITE, NB_NIGHTS, SEESTAR
from weather import fetch_all
from astro import (night_hours, sky_frame, twilight_times, COMPASS_SECTORS,
                    format_ra, format_dec, moon_status, local_now)
from scoring import (score_frame, night_summary, target_windows, score_label_fr,
                      target_altitude_series, recommended_exposure_minutes, wind_quality,
                      target_feasibility_reasons, cloud_trend, CLOUD_TREND_WINDOW_HOURS,
                      dew_risk, discovery_sort_key, view_window_df)
from catalog import load_targets, load_messier, find_target
from geocode import geocode, GeocodeError
from wiki import target_summary, wiki_title_candidates
from components import TWILIGHT_BAR_CSS, CARD_CSS, twilight_bar_html, card_html
from rows import common_row_fields, row_from_search, day_frame, filter_label, subtitle_with_ngc
import progress as progress_store

st.set_page_config(page_title="NuitClaire", page_icon="\U0001F52D", layout="wide")

st.markdown(f"""
<style>
.card {{
    background: rgba(127, 127, 127, 0.07);
    border: 1px solid rgba(127, 127, 127, 0.2);
    border-radius: 12px;
    padding: 1rem 1.25rem;
    margin-bottom: 0.75rem;
}}
/* opacity 0.85, pas 0.7 : mesure reelle (npx impeccable detect) montrait un
   contraste de ~1.6:1 sur ces labels/sous-textes a 0.7 (bien sous les 4.5:1
   requis) -- le texte doit rester secondaire (plus petit, majuscules) sans
   devenir illisible en plein jour ou sur un ecran de telephone la nuit. */
.card h4 {{ margin: 0 0 0.25rem 0; font-size: 0.85rem; opacity: 0.85; text-transform: uppercase; }}
.card .value {{ font-size: 1.8rem; font-weight: 600; }}
.card .sub {{ font-size: 0.85rem; opacity: 0.85; }}
/* Remplace st.caption() : son style Streamlit integre s'est mesure a ~1.6:1
   de contraste (npx impeccable detect), pareil que les .card avant le meme
   correctif -- mais st.caption ne s'y prete pas (classe generee, pas de hook
   CSS stable), donc on rend ces lignes nous-memes avec la meme opacite 0.85. */
.soft-caption {{ font-size: 0.875rem; opacity: 0.85; margin: 0.25rem 0; }}
.soft-caption a {{ color: inherit; text-decoration: underline; }}
{TWILIGHT_BAR_CSS}
{CARD_CSS}
</style>
""", unsafe_allow_html=True)


def _soft_caption(text: str, link: tuple[str, str] | None = None, italic: bool = False) -> None:
    """Remplacement de st.caption() a contraste maitrise (voir `.soft-caption`
    dans le bloc <style>). `link`, si fourni, est (libelle, url) ajoute apres
    `text`, sous forme de vrai lien -- st.caption interprete du Markdown mais
    pas du HTML brut, donc un lien ne peut pas etre simplement concatene dans
    `text`."""
    html = escape(text)
    if link:
        label, url = link
        html += f' <a href="{escape(url)}" target="_blank">{escape(label)}</a>'
    style = ' style="font-style: italic;"' if italic else ""
    st.markdown(f'<div class="soft-caption"{style}>{html}</div>', unsafe_allow_html=True)


def _target_card(row: dict) -> dict:
    """Mappe une ligne de `feasible_rows(..., "targets")` vers la forme de carte
    attendue par `components.gallery_html`."""
    return {
        "image": row["Image"],
        "title": row["Cible"],
        "subtitle": subtitle_with_ngc(row["Nom commun"], row.get("NGC"), row["Cible"]),
        "badges": [row["Type"], row["Cadrage"]],
        "meta": [
            ("Fenetre", f"{row['Debut']}–{row['Fin']} ({row['Heures']} h)"),
            ("Alt max", f"{row['Alt max deg']:.0f}°"),
            ("Lune", f"{row['Lune deg']:.0f}°"),
        ],
    }


_WEEKDAYS_FR = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
_MONTHS_FR = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout",
              "septembre", "octobre", "novembre", "decembre"]


def _format_date_fr(d: date) -> str:
    """'lundi 15 septembre', sans dependre de la locale systeme -- contrairement a
    strftime('%A %d %B'), peu fiable entre plateformes/threads (observe en anglais
    par defaut sur ce poste alors que le reste de l'appli est en francais)."""
    return f"{_WEEKDAYS_FR[d.weekday()]} {d.day} {_MONTHS_FR[d.month - 1]}"


def _messier_card_html(row: dict) -> str:
    """Rendu d'une carte Messier (image + infos), sans case a cocher : celle-ci
    reste un widget Streamlit reel, ajoute a cote dans l'onglet Messier."""
    return card_html(
        image=row["Image"], title=row["Messier"],
        subtitle=subtitle_with_ngc(row["Nom commun"], row.get("NGC"), row["Messier"]),
        badges=[row["Type"]],
        meta=[("Faisable ce soir", f"{row['Faisable ce soir']} ({row['Heures']} h)")],
    )


# --- Etat de session : site actif + progression locale ---------------------
if "site" not in st.session_state:
    st.session_state.site = dict(SITE)
if "progress" not in st.session_state:
    st.session_state.progress = progress_store.load()

site = st.session_state.site
prog = st.session_state.progress

st.title("\U0001F52D NuitClaire")
_catalog_size = len(load_targets()) + len(load_messier())
_soft_caption(
    f"{_catalog_size} objets du ciel profond, passes au crible de la meteo et de "
    "l'horizon, heure par heure.",
    italic=True,
)
st.markdown(
    f'<div style="font-weight: 600; font-size: 1.1rem; margin: 0.25rem 0;">'
    f'Position : {escape(site["name"])}</div>',
    unsafe_allow_html=True,
)

# --- Barre laterale ----------------------------------------------------------
with st.sidebar:
    st.header("Position")
    address = st.text_input("Adresse", value="7 rue Saint Jean, 51240 Marson, France")
    if st.button("Mettre a jour la position"):
        try:
            result = geocode(address)
            # Nominatim ne renvoie ni elevation ni fuseau horaire : on conserve
            # ceux du site precedent (approximation acceptable a l'echelle
            # regionale, mais a garder en tete si l'adresse change de pays).
            st.session_state.site = {**site, "lat": result["lat"], "lon": result["lon"],
                                      "name": result["display_name"].split(",")[0]}
            st.rerun()
        except GeocodeError as e:
            st.error(str(e))

    st.header("Horizon degage")
    _soft_caption("Cochez les directions ou le ciel est degage depuis votre poste.")
    cols = st.columns(4)
    for i, sector in enumerate(COMPASS_SECTORS):
        with cols[i % 4]:
            checked = st.checkbox(sector, value=prog["horizon"].get(sector, False), key=f"h_{sector}")
            if checked != prog["horizon"].get(sector, False):
                prog["horizon"][sector] = checked
                progress_store.save(prog)

    st.header("Fenetre d'observation")
    mode = st.radio("Plage horaire", ["Nuit complete", "Habituelle (20:00–22:30)"], index=0)


@st.cache_data(ttl=1800)
def load(site_key: tuple):
    site_dict = dict(zip(("name", "lat", "lon", "elevation_m", "tz"), site_key))
    wx = fetch_all(days=NB_NIGHTS + 1, site=site_dict)
    nights = {}
    twilights = {}
    for i in range(NB_NIGHTS):
        d = date.today() + timedelta(days=i)
        hrs = night_hours(d, site=site_dict)
        if not hrs:
            continue
        sky = sky_frame(hrs, site=site_dict)
        df = sky.join(wx, how="left")
        nights[d] = score_frame(df)
        twilights[d] = twilight_times(d, site=site_dict)
    return nights, twilights


TIME_AXIS_FORMAT = "%H:%M"  # 24h partout, jamais d'AM/PM -- axe + tooltip des graphiques

# Nombre de cartes affichees d'emblee dans la galerie de cibles ; le reste va
# dans un expander "Voir plus" pour ne pas forcer le chargement de dizaines de
# vignettes d'un coup sur une bonne nuit.
GALLERY_PAGE_SIZE = 24

# Colonnes par rangee pour les grilles de cartes cibles (st.columns s'empile
# nativement en une seule colonne sur mobile, donc pas de media query requise ici).
GALLERY_COLS = 3
MESSIER_COLS = 4


def _target_grid(rows: list[dict], night_df: pd.DataFrame, site: dict, horizon: dict,
                  key_prefix: str, cols: int, card: Callable[[dict], str],
                  extra: Callable[[dict], None] | None = None) -> None:
    """Grille de cartes en colonnes Streamlit, chacune suivie d'un bouton
    'Detail' ouvrant la modale de hauteur/fiche technique de la cible.
    `card(row)` rend le HTML de la carte ; `extra(row)`, si fourni, rend un
    widget Streamlit supplementaire sous le bouton (ex. la case a cocher
    'Capturee' de l'onglet Messier)."""
    for start in range(0, len(rows), cols):
        chunk = rows[start:start + cols]
        for col, row in zip(st.columns(cols), chunk):
            with col:
                st.markdown(card(row), unsafe_allow_html=True)
                uid = row.get("Cible") or row["id"]
                if st.button("Detail", key=f"{key_prefix}_detail_{uid}", use_container_width=True):
                    _target_detail_dialog(row, night_df, site, horizon)
                if extra is not None:
                    extra(row)


def _time_series_chart(df: pd.DataFrame, columns: list[str], height: int = 220,
                        y_title: str = "") -> alt.Chart:
    """Graphique multi-series avec axe temporel en 24h (jamais d'AM/PM).

    st.line_chart delegue a Vega-Lite qui formate par defaut l'axe temporel en
    12h -- on construit donc le spec Altair a la main avec un format d'axe
    explicite en heures:minutes 24h.

    Legende masquee pour une serie unique : elle n'afficherait que le nom brut
    de la colonne, redondant avec le sous-titre du graphique.
    """
    long_df = df[columns].reset_index().melt("time", var_name="serie", value_name="valeur")
    color = alt.Color("serie:N", title="", sort=columns,
                       legend=None if len(columns) == 1 else alt.Legend())
    x = alt.X("time:T", title="Heure", axis=alt.Axis(format=TIME_AXIS_FORMAT))
    y = alt.Y("valeur:Q", title=y_title)
    tooltip = [alt.Tooltip("time:T", title="Heure", format=TIME_AXIS_FORMAT),
               alt.Tooltip("serie:N", title="Serie"),
               alt.Tooltip("valeur:Q", title="Valeur")]
    base = alt.Chart(long_df).encode(x=x, y=y, color=color, tooltip=tooltip)
    # Points a chaque heure de donnees (pas seulement une ligne lissee), meme
    # habillage que les graphes score/nuages -- coherence visuelle sur tous les
    # graphiques de l'appli.
    return (base.mark_line() + base.mark_point(filled=True, size=50)).properties(height=height)


def _has_plottable_data(df: pd.DataFrame, columns: list[str]) -> bool:
    """Faux dans deux cas degeneres ou l'axe X (temps) ou l'axe Y (valeurs) n'a
    pas de domaine exploitable pour Altair/Vega-Lite -- dans les deux cas, on
    obtient des erreurs SVG malformees cote navigateur (transform/translate
    avec Number.MAX_VALUE) plutot qu'un graphique casse visuellement, donc
    l'appelant affiche un message a la place :
    - un seul horodatage distinct (ou moins) : typique quand la fenetre
      "Habituelle" (20h-22h30 fixe) ne recouvre que tres peu d'heures de nuit
      astronomique reelle selon la saison ;
    - toutes les valeurs NaN sur les colonnes affichees : observe pour des
      nuits proches de la limite de couverture des previsions meteo, ou un
      champ entier peut manquer pour les heures concernees.

    Attention, cette garde est tout-ou-rien sur `columns` : elle ne detecte
    pas le cas ou seule UNE colonne est entierement NaN pendant qu'une autre
    a des valeurs (ex. `seeing`/`transparency` de 7Timer, dont l'horizon de
    prevision est plus court que celui d'Open-Meteo). Ce cas ne se produit pas
    aujourd'hui pour les graphiques existants (chacun ne melange que des
    colonnes de la meme source), mais un futur graphique melangeant des
    colonnes de sources differentes devra verifier la couverture colonne par
    colonne plutot que de reutiliser cette garde telle quelle.
    """
    return df.index.nunique() >= 2 and df[columns].notna().any().any()


def _render_time_series(df: pd.DataFrame, columns: list[str], height: int = 220,
                         y_title: str = "") -> None:
    """Affiche `_time_series_chart`, ou un message si les donnees ne s'y pretent pas."""
    if not _has_plottable_data(df, columns):
        st.info("Pas assez de donnees sur cette fenetre pour un graphique.")
        return
    st.altair_chart(_time_series_chart(df, columns, height=height, y_title=y_title),
                     use_container_width=True)


# Seuils identiques a score_label_fr (40/70), pour que la couleur d'un point
# sur les graphes ci-dessous corresponde aux memes paliers rouge/jaune/vert que
# partout ailleurs dans l'appli (emoji d'en-tete, etiquette du score). Les
# paires de bornes dupliquees (39.999/40, 69.999/70) simulent un degrade en
# paliers nets plutot qu'une transition continue rouge->jaune->vert.
_QUALITY_DOMAIN = [0, 39.999, 40, 69.999, 70, 100]
_QUALITY_RANGE = ["#e2434f", "#e2434f", "#f2c94c", "#f2c94c", "#27ae60", "#27ae60"]


def _quality_color_scale() -> alt.Scale:
    return alt.Scale(domain=_QUALITY_DOMAIN, range=_QUALITY_RANGE)


def _score_chart(df: pd.DataFrame, height: int = 220) -> alt.Chart:
    """Score astro horaire (0-100) sur la nuit : ligne + points colores selon
    les memes seuils rouge/jaune/vert que `score_label_fr`."""
    plot_df = df[["score"]].reset_index()
    plot_df["score_pct"] = (plot_df["score"] * 100).round()
    y = alt.Y("score_pct:Q", title="Score astro", scale=alt.Scale(domain=[0, 100]))
    line = (alt.Chart(plot_df).mark_line(color="#8a8a8a")
            .encode(x=alt.X("time:T", title="Heure", axis=alt.Axis(format=TIME_AXIS_FORMAT)), y=y))
    points = (alt.Chart(plot_df).mark_point(filled=True, size=70)
              .encode(x="time:T", y=y,
                      color=alt.Color("score_pct:Q", scale=_quality_color_scale(), legend=None),
                      tooltip=[alt.Tooltip("time:T", title="Heure", format=TIME_AXIS_FORMAT),
                               alt.Tooltip("score_pct:Q", title="Score")]))
    return (line + points).properties(height=height)


def _cloud_chart(df: pd.DataFrame, height: int = 220) -> alt.Chart:
    """Couverture nuageuse horaire (%) : ligne + points colores rouge/jaune/vert
    selon la clarte du ciel (100 - nuages), memes seuils que `_score_chart`."""
    plot_df = df[["cloud_cover"]].reset_index()
    plot_df["clarity"] = 100 - plot_df["cloud_cover"]
    y = alt.Y("cloud_cover:Q", title="Couverture nuageuse (%)", scale=alt.Scale(domain=[0, 100]))
    line = (alt.Chart(plot_df).mark_line(color="#8a8a8a")
            .encode(x=alt.X("time:T", title="Heure", axis=alt.Axis(format=TIME_AXIS_FORMAT)), y=y))
    points = (alt.Chart(plot_df).mark_point(filled=True, size=70)
              .encode(x="time:T", y=y,
                      color=alt.Color("clarity:Q", scale=_quality_color_scale(), legend=None),
                      tooltip=[alt.Tooltip("time:T", title="Heure", format=TIME_AXIS_FORMAT),
                               alt.Tooltip("cloud_cover:Q", title="Nuages", format=".0f")]))
    return (line + points).properties(height=height)


def _wind_chart(df: pd.DataFrame, height: int = 220) -> alt.Chart:
    """Rafales horaires (km/h) : ligne + points colores rouge/jaune/vert selon
    le meme sous-score vent (`scoring.wind_quality`) que le score astro global
    -- rafales, pas vitesse moyenne, car ce sont elles qui abiment le suivi."""
    plot_df = df[["wind_gusts_10m"]].reset_index()
    plot_df["quality_pct"] = plot_df["wind_gusts_10m"].apply(wind_quality) * 100
    y = alt.Y("wind_gusts_10m:Q", title="Rafales (km/h)")
    line = (alt.Chart(plot_df).mark_line(color="#8a8a8a")
            .encode(x=alt.X("time:T", title="Heure", axis=alt.Axis(format=TIME_AXIS_FORMAT)), y=y))
    points = (alt.Chart(plot_df).mark_point(filled=True, size=70)
              .encode(x="time:T", y=y,
                      color=alt.Color("quality_pct:Q", scale=_quality_color_scale(), legend=None),
                      tooltip=[alt.Tooltip("time:T", title="Heure", format=TIME_AXIS_FORMAT),
                               alt.Tooltip("wind_gusts_10m:Q", title="Rafales", format=".0f")]))
    return (line + points).properties(height=height)


def _render_score_chart(df: pd.DataFrame) -> None:
    if not _has_plottable_data(df, ["score"]):
        st.info("Pas assez de donnees sur cette fenetre pour un graphique.")
        return
    st.altair_chart(_score_chart(df), use_container_width=True)


_CLOUD_TREND_ICON = {"amelioration": "🟢", "stable": "🟡", "degradation": "🔴"}


def _render_cloud_trend(df: pd.DataFrame, now: pd.Timestamp | None) -> None:
    """Caption 'maintenant -> prochaines heures' au-dessus du graphe nuages ;
    silencieuse si `cloud_trend` ne peut rien calculer (nuit differente
    d'aujourd'hui, donnees manquantes...) plutot que d'afficher un message
    d'erreur pour ce qui n'est qu'une info secondaire."""
    trend = cloud_trend(df, now)
    if trend is None:
        return
    icon = _CLOUD_TREND_ICON[trend["direction"]]
    _soft_caption(f"{icon} {trend['label']} attendue : nuages {trend['now_pct']}% "
                  f"-> {trend['future_pct']}% dans les {CLOUD_TREND_WINDOW_HOURS} prochaines heures.")


def _render_cloud_chart(df: pd.DataFrame) -> None:
    if not _has_plottable_data(df, ["cloud_cover"]):
        st.info("Pas assez de donnees sur cette fenetre pour un graphique.")
        return
    st.altair_chart(_cloud_chart(df), use_container_width=True)


def _render_wind_chart(df: pd.DataFrame) -> None:
    if not _has_plottable_data(df, ["wind_gusts_10m"]):
        st.info("Pas assez de donnees sur cette fenetre pour un graphique.")
        return
    st.altair_chart(_wind_chart(df), use_container_width=True)




@st.cache_data(ttl=1800)
def feasible_rows(site_key: tuple, day: date, horizon_key: tuple, view_mode_key: str,
                   catalog: str) -> list[dict]:
    """Cibles faisables pour une nuit donnee (cache par site/nuit/horizon/mode/catalogue).

    Ne recalcule que si l'un de ces parametres change -- independant des autres
    interactions widget (ex. cocher une capture Messier) qui declenchent un
    rerun complet du script sans rien changer a ces entrees.
    """
    site_dict = dict(zip(("name", "lat", "lon", "elevation_m", "tz"), site_key))
    nights, _ = load(site_key)
    df = nights.get(day)
    if df is None:
        return []
    view_df = view_window_df(df, view_mode_key) if catalog == "targets" else df
    horizon = dict(horizon_key)
    targets = load_targets() if catalog == "targets" else load_messier()

    rows = []
    for tgt in targets:
        w = target_windows(view_df, tgt, horizon=horizon, site=site_dict)
        if catalog == "targets" and w["hours"] == 0:
            continue
        # Raisons d'infaisabilite calculees uniquement cote Messier : ce
        # catalogue garde les objets infaisables (avec "Faisable ce soir" :
        # "Non"), contrairement au catalogue "targets" qui les exclut deja.
        common = common_row_fields(tgt, w, view_df, horizon, site_dict,
                                     compute_reasons=(catalog == "messier"))
        if catalog == "targets":
            rows.append({"Cible": w["name"], **common})
        else:
            rows.append({
                "id": tgt["messier"], "Messier": tgt["name"],
                "Faisable ce soir": "Oui" if w["hours"] > 0 else "Non",
                **common,
            })
    return rows


# Palette dediee a la direction (secteur cardinal), distincte de l'echelle
# rouge/jaune/vert utilisee partout ailleurs pour la "qualite" (score, nuages,
# vent) -- une cible qui pointe au nord n'est ni bonne ni mauvaise, le
# code couleur ici encode juste l'orientation, pas un jugement.
#
# 8 teintes categorielles distinctes (palette dataviz validee : ecart CVD/vue
# normale mesure, pas choisi a l'oeil), dans l'ordre de COMPASS_SECTORS -- donc
# deux secteurs voisins sur la rose des vents (N/NE, ..., NW/N) sont aussi
# les plus ecartes en teinte, le cas qui compte le plus ici puisqu'une cible
# traverse les secteurs dans l'ordre en balayant l'azimut au cours de la nuit.
# Les 8 ne sont PAS garantis deux-a-deux distincts sur simulation de
# daltonisme (aucun ordre ne le permet a 8 categories) ; la legende et l'info-
# bulle ("Direction" en texte) servent de repli pour les paires non voisines.
_COMPASS_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100",
                   "#e87ba4", "#008300", "#4a3aa7", "#e34948"]


def _clear_horizon_runs(series: pd.DataFrame, horizon: dict) -> pd.DataFrame:
    """Plages horaires contigues ou la cible est a la fois dans l'altitude
    exploitable du Seestar et dans un secteur d'horizon degage -- purement
    geometrique (site + position), independant de la meteo/Lune (`series` n'a
    pas ces colonnes ici, voir `_target_detail_dialog`). Meme technique de
    regroupement en plages que `scoring.best_window_span`, dupliquee ici
    plutot que partagee : l'un opere sur un score meteo, l'autre sur un
    masque alt/secteur, deux notions distinctes malgre la forme commune."""
    open_sectors = {s for s, is_open in horizon.items() if is_open}
    ok = ((series["alt"] >= SEESTAR["min_alt_deg"]) & (series["alt"] <= SEESTAR["max_alt_deg"])
          & series["sector"].isin(open_sectors))
    runs = []
    for is_ok, group in groupby(zip(series.index, ok), key=lambda x: x[1]):
        if is_ok:
            times = [t for t, _ in group]
            runs.append((times[0], times[-1] + pd.Timedelta(hours=1)))
    return pd.DataFrame(runs, columns=["start", "end"])


def _altitude_chart(series: pd.DataFrame, horizon: dict, height: int = 240) -> alt.Chart:
    """Graphe hauteur (altitude) vs heure d'une cible entre 19h et 6h (voir
    `rows.day_frame`), avec la plage utilisable du Seestar S50 (SEESTAR min/max
    alt) en reperes pointilles. Domaine Y non-negatif : sur cette fenetre la
    cible reste generalement au-dessus de l'horizon, et une echelle etiree
    jusqu'a -90 pour de rares heures negatives ecrasait le reste du graphe.
    La cible bouge aussi en azimut (pas seulement en altitude) : chaque point
    est colore par secteur cardinal (legende auto), l'azimut exact restant
    disponible au survol -- garde un seul graphe/axe plutot que d'ajouter un
    second axe ou un graphe separe. Bande verte en fond : plages ou l'horizon
    degage choisi (barre laterale) rend la cible reellement pointable, cf.
    `_clear_horizon_runs`."""
    long_df = series.reset_index()
    x = alt.X("time:T", title="Heure", axis=alt.Axis(format=TIME_AXIS_FORMAT))
    y = alt.Y("alt:Q", title="Altitude (deg)", scale=alt.Scale(domain=[0, 90]))
    tooltip = [alt.Tooltip("time:T", title="Heure", format=TIME_AXIS_FORMAT),
               alt.Tooltip("alt:Q", title="Altitude", format=".0f"),
               alt.Tooltip("az:Q", title="Azimut", format=".0f"),
               alt.Tooltip("sector:N", title="Direction")]
    runs_df = _clear_horizon_runs(series, horizon)
    bands = (
        alt.Chart(runs_df)
        .mark_rect(color="#2ecc71", opacity=0.18)
        .encode(x="start:T", x2="end:T", y=alt.value(0), y2=alt.value(height))
    ) if not runs_df.empty else alt.Chart(pd.DataFrame()).mark_rect()
    line = alt.Chart(long_df).mark_line(color="#8a8a8a").encode(x=x, y=y)
    points = (
        alt.Chart(long_df)
        .mark_point(filled=True, size=70)
        .encode(
            x=x, y=y, tooltip=tooltip,
            color=alt.Color("sector:N", title="Direction", sort=COMPASS_SECTORS,
                             scale=alt.Scale(domain=COMPASS_SECTORS, range=_COMPASS_COLORS)),
        )
    )
    ref_df = pd.DataFrame({"alt": [SEESTAR["min_alt_deg"], SEESTAR["max_alt_deg"]]})
    rules = alt.Chart(ref_df).mark_rule(strokeDash=[4, 4], color="gray").encode(y="alt:Q")
    return (bands + line + rules + points).properties(height=height)


@st.cache_data(ttl=86400)
def _cached_wiki_summary(candidates: tuple[str, ...]) -> dict | None:
    """Cache d'une journee : contenu quasi statique, pas besoin de re-interroger
    Wikipedia a chaque ouverture de la modale."""
    return target_summary(list(candidates))


@st.dialog("Detail de la cible", width="large")
def _target_detail_dialog(row: dict, night_df: pd.DataFrame, site: dict, horizon: dict) -> None:
    """Modale ouverte par le bouton 'Detail' d'une carte (onglet 'Ce soir' ou
    'Catalogue Messier') : image + graphe de hauteur (19h-6h, voir
    `rows.day_frame`) cote a cote, puis fiche technique de la cible."""
    title = row.get("Cible") or row["Messier"]
    st.subheader(title)
    subtitle = subtitle_with_ngc(row["Nom commun"], row.get("NGC"), title)
    if subtitle:
        _soft_caption(subtitle)

    series = target_altitude_series(day_frame(night_df, site), {"ra": row["RA"], "dec": row["Dec"]},
                                     site=site)
    if row.get("Image"):
        img_col, chart_col = st.columns([1, 2])
        with img_col:
            st.image(row["Image"], use_container_width=True)
        with chart_col:
            st.altair_chart(_altitude_chart(series, horizon), use_container_width=True)
    else:
        st.altair_chart(_altitude_chart(series, horizon), use_container_width=True)

    peak_t = series["alt"].idxmax()
    peak = series.loc[peak_t]
    _soft_caption(f"Direction a l'altitude max : {peak['sector']} (azimut {peak['az']:.0f}°) "
                  f"vers {peak_t.strftime('%H:%M')}")

    mag_txt = f"{row['Mag']:.1f}" if row.get("Mag") is not None else "inconnue"
    size_txt = (f"{row['TailleW']:.1f}' x {row['TailleH']:.1f}'"
                if row.get("TailleW") and row.get("TailleH") else "inconnue")
    window_txt = (f"{row['Debut']}–{row['Fin']} ({row['Heures']} h)"
                  if row.get("Debut") else "Aucune ce soir")
    low, high = recommended_exposure_minutes(row.get("TypeCode", ""), row.get("Mag"))

    c1, c2 = st.columns(2)
    with c1:
        st.markdown(f"**Coordonnees** : {format_ra(row['RA'])} / {format_dec(row['Dec'])}")
        st.markdown(f"**Magnitude** : {mag_txt}")
        st.markdown(f"**Taille** : {size_txt}")
        st.markdown(f"**Cadrage** : {row.get('Cadrage', 'n/d')}")
    with c2:
        st.markdown(f"**Fenetre exploitable** : {window_txt}")
        for reason in row.get("Raisons") or []:
            st.markdown(f"- {reason}")
        st.markdown(f"**Filtre conseille** : {filter_label(row.get('Filtre', 'sans'))}")
        st.markdown(f"**Separation lunaire mini** : {row.get('Lune deg', 'n/d')}°")
        st.markdown(f"**Temps de pose indicatif** : {low}–{high} min "
                     "(estimation, pas une mesure)")

    # Absent du catalogue OpenNGC (donnees purement astrometriques) : recherche
    # en direct sur Wikipedia (fr puis en), section masquee si rien de trouve.
    summary = _cached_wiki_summary(tuple(wiki_title_candidates(row)))
    if summary:
        st.subheader("En savoir plus")
        st.write(summary["extract"])
        if summary.get("url"):
            _soft_caption("Source : ", link=("Wikipedia", summary["url"]))


try:
    with st.spinner("Chargement meteo + ephemerides..."):
        site_key = (site["name"], site["lat"], site["lon"], site["elevation_m"], site["tz"])
        nights, twilights = load(site_key)
except Exception as e:
    print(f"Erreur chargement meteo/ephemerides : {e}")
    st.error("Impossible de recuperer les donnees meteo. Reessayez dans quelques instants.")
    st.stop()

if not nights:
    st.error("Aucune donnee de nuit disponible pour les prochains jours.")
    st.stop()

tab_ce_soir, tab_messier = st.tabs(["Ce soir", "Catalogue Messier"])

with tab_ce_soir:
    # Uniquement la nuit du jour meme : pas de strip multi-jours (previsions
    # peu fiables au-dela de 24-48h) -- si `date.today()` n'a pas d'heures de
    # nuit astronomique calculables (garde-fou improbable a cette latitude),
    # on retombe sur la premiere nuit disponible plutot que de planter.
    sel = date.today() if date.today() in nights else next(iter(nights))
    df = nights[sel]
    tw = twilights[sel]

    view_mode_key = "habituelle" if mode.startswith("Habituelle") else "complete"
    view_df = view_window_df(df, view_mode_key)

    # Unique source du score affiche sur la page (view_df) : c'est ce qui
    # garantit que le score du bandeau et celui de la carte ne divergent plus.
    s = night_summary(view_df)
    pct, label = score_label_fr(s["score"])
    emoji = "\U0001F7E2" if s["score"] >= 0.7 else "\U0001F7E1" if s["score"] >= 0.5 else "\U0001F534"

    st.header(f"{emoji} Ce soir : {_format_date_fr(sel)}")

    # Rappel visible sur la page principale (pas seulement dans la sidebar,
    # repliee par defaut sur mobile derriere une icone sans etiquette) : quels
    # secteurs d'horizon sont pris en compte pour la liste de cibles plus bas.
    open_sectors = [sect for sect in COMPASS_SECTORS if prog["horizon"].get(sect)]
    _soft_caption(f"Horizon degage : {', '.join(open_sectors) if open_sectors else 'aucun secteur'}")

    # Recherche par designation (pas par nom commun : trop peu de couverture
    # dans OpenNGC pour etre fiable, voir catalog.find_target) -- fonctionne
    # meme pour une cible infaisable ce soir, avec les raisons dans la modale.
    with st.form("search_form"):
        col_q, col_btn = st.columns([4, 1])
        with col_q:
            query = st.text_input("Rechercher un objet", label_visibility="collapsed",
                                   placeholder="Rechercher une designation : M31, NGC7380, IC434...")
        with col_btn:
            searched = st.form_submit_button("Rechercher", use_container_width=True)
    if searched and query:
        found = find_target(query)
        if found:
            _target_detail_dialog(row_from_search(found, df, prog["horizon"], site), df, site,
                                   prog["horizon"])
        else:
            st.warning(f"Aucun objet trouve pour « {query} ». Essayez une designation "
                       "comme M31, NGC7380 ou IC434.")

    c1, c2, c3 = st.columns(3)
    with c1:
        st.markdown(f'<div class="card"><h4>Astro score</h4><div class="value">{pct}/100</div>'
                    f'<div class="sub">{label}</div></div>', unsafe_allow_html=True)
    with c2:
        dew = dew_risk(view_df)
        spread_text = f"{dew['spread']:.1f}" if dew["spread"] is not None else "n/d"
        st.markdown(f'<div class="card"><h4>Risque de buee (ecart {spread_text} deg)</h4>'
                    f'<div class="value">{dew["risk"]}</div>'
                    f'<div class="sub">Anti-buee : {dew["advice"]}</div></div>', unsafe_allow_html=True)
    with c3:
        # Calculee au crepuscule astro : illumination/taille de la Lune ne
        # bougent quasiment pas sur une nuit (cycle synodique de ~29.5 jours),
        # un seul instant de reference suffit (voir astro.moon_status).
        moon = moon_status(tw["astro_dusk"].replace(tzinfo=ZoneInfo(site["tz"])), site=site)
        trend = "Croissante" if moon["waxing"] else "Decroissante"
        st.markdown(f'<div class="card"><h4>Lune</h4><div class="value">{moon["illum"]:.0f}%</div>'
                    f'<div class="sub">{trend} · {moon["size_arcmin"]:.1f}\'</div></div>',
                    unsafe_allow_html=True)

    # Repere "maintenant" uniquement si la nuit affichee est bien celle de ce
    # soir (toujours vrai sauf repli sur `next(iter(nights))` ci-dessus). Plus
    # de surlignage "meilleure fenetre" : ca donnait l'impression trompeuse
    # que le vert marquait toute la session astro plutot qu'un sous-interval.
    now_local = local_now(site) if sel == date.today() else None
    st.markdown(twilight_bar_html(tw, now=now_local), unsafe_allow_html=True)

    st.subheader("Score astro")
    _soft_caption("🟢 ≥ 70 · 🟡 40–69 · 🔴 < 40 -- memes seuils pour les nuages et le vent ci-dessous.")
    # Nuit astro complete (df non filtre par le mode Habituelle/Nuit complete) :
    # ce graphe doit toujours montrer toute la nuit, contrairement aux autres
    # graphiques ci-dessous qui respectent le mode d'affichage actif.
    _render_score_chart(df)

    # Nuages/rosee/vent/donnees horaires : detail secondaire, replie par
    # defaut (accordeon) juste en dessous du score plutot qu'en fin de page --
    # reste a portee immediate sans pousser vers le bas la galerie de cibles.
    with st.expander("Details meteo (nuages, rosee, vent, donnees horaires)"):
        st.subheader("Tendance nuages")
        # Une seule courbe (couverture nuageuse totale) : le detail par
        # altitude (basse/moyenne/haute) reste dans le tableau ci-dessous.
        # `df` (nuit complete), pas `view_df`, pour retrouver "maintenant"
        # meme quand le mode d'affichage restreint la fenetre visible.
        _render_cloud_trend(df, now_local)
        _render_cloud_chart(view_df)

        st.subheader("Point de rosee")
        _render_time_series(view_df, ["temperature_2m", "dew_point_2m"])

        st.subheader("Vent")
        _render_wind_chart(view_df)

        st.subheader("Donnees horaires")
        st.dataframe(view_df[["score", "cloud_cover_low", "cloud_cover_mid", "cloud_cover_high",
                               "wind_speed_10m", "wind_gusts_10m", "temperature_2m", "dew_point_2m",
                               "moon_alt", "moon_illum", "seeing", "transparency"]].round(1))

    # La galerie de cibles (la decision reelle : "que pointer ce soir") passe
    # juste apres le score -- reste tout en haut, a l'oppose du "glanceable"
    # vise pour un usage juste avant de sortir (cf. .impeccable.md).
    st.subheader("Cibles faisables ce soir")
    horizon_key = tuple(sorted(prog["horizon"].items()))
    rows = feasible_rows(site_key, sel, horizon_key, view_mode_key, "targets")
    if rows:
        captured = set(prog["messier_captured"])
        rows = sorted(rows, key=lambda r: discovery_sort_key(r, captured))
        types = sorted({r["Type"] for r in rows if r["Type"]})
        # Boutons multi-selection (pas un menu deroulant) : on veut pouvoir
        # afficher plusieurs types a la fois (ex. galaxies + amas globulaires),
        # ce qu'un selectbox single-choix ne permet pas.
        chosen_types = st.pills("Filtrer par type", types, selection_mode="multi")
        if chosen_types:
            rows = [r for r in rows if r["Type"] in chosen_types]

        shown, rest = rows[:GALLERY_PAGE_SIZE], rows[GALLERY_PAGE_SIZE:]
        _target_grid(shown, df, site, prog["horizon"], "soir", GALLERY_COLS,
                     card=lambda r: card_html(**_target_card(r)))
        if rest:
            with st.expander(f"Voir {len(rest)} cible(s) de plus"):
                _target_grid(rest, df, site, prog["horizon"], "soir_plus", GALLERY_COLS,
                              card=lambda r: card_html(**_target_card(r)))
    else:
        st.info("Aucune cible exploitable cette nuit (meteo, Lune ou horizon degage).")

with tab_messier:
    st.header("Catalogue Messier")
    captured = set(prog["messier_captured"])
    messier_total = len(load_messier())
    st.progress(len(captured) / messier_total, text=f"{len(captured)}/{messier_total} captures")

    # Meme nuit que l'onglet "Ce soir" (`sel`, la nuit du jour meme) -- pas de
    # selecteur multi-jours ici non plus.
    horizon_key = tuple(sorted(prog["horizon"].items()))
    # view_mode_key fixe ("na") : la faisabilite Messier ignore la fenetre
    # d'observation habituelle (df de nuit complet), donc un changement de
    # mode dans la barre laterale ne doit pas invalider ce cache.
    rows = feasible_rows(site_key, sel, horizon_key, "na", "messier")
    for row in rows:
        row["Capture"] = row["id"] in captured
    rows.sort(key=lambda r: int(r["id"]))

    only_feasible = st.checkbox("Faisable ce soir uniquement")
    if only_feasible:
        rows = [r for r in rows if r["Faisable ce soir"] == "Oui"]

    def _messier_extra(row: dict) -> None:
        new_val = st.checkbox("Capturee", value=row["Capture"], key=f"cap_{row['id']}")
        if new_val != row["Capture"]:
            progress_store.toggle_messier(prog, row["id"])
            progress_store.save(prog)
            st.rerun()

    if rows:
        _target_grid(rows, df, site, prog["horizon"], "messier", MESSIER_COLS,
                      card=_messier_card_html, extra=_messier_extra)
    else:
        st.info("Aucun objet Messier faisable ce soir (meteo, Lune ou horizon degage).")
