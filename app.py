"""Tableau de bord Streamlit : score astro, cibles par direction/horizon, suivi Messier."""
from datetime import date, timedelta

import altair as alt
import pandas as pd
import streamlit as st

from config import SITE, NB_NIGHTS, VIEW_WINDOW, SEESTAR
from weather import fetch_all
from astro import night_hours, sky_frame, fits_in_fov, twilight_times, COMPASS_SECTORS
from scoring import score_frame, night_summary, target_windows, score_label_fr
from catalog import load_targets, load_messier
from geocode import geocode, GeocodeError
from imagery import dss_image_url
import progress as progress_store

st.set_page_config(page_title="Planificateur Seestar", page_icon="\U0001F52D", layout="wide")

st.markdown("""
<style>
.card {
    background: rgba(127, 127, 127, 0.07);
    border: 1px solid rgba(127, 127, 127, 0.2);
    border-radius: 12px;
    padding: 1rem 1.25rem;
    margin-bottom: 0.75rem;
}
.card h4 { margin: 0 0 0.25rem 0; font-size: 0.85rem; opacity: 0.7; text-transform: uppercase; }
.card .value { font-size: 1.8rem; font-weight: 600; }
.card .sub { font-size: 0.85rem; opacity: 0.7; }
</style>
""", unsafe_allow_html=True)


# --- Etat de session : site actif + progression locale ---------------------
if "site" not in st.session_state:
    st.session_state.site = dict(SITE)
if "progress" not in st.session_state:
    st.session_state.progress = progress_store.load()

site = st.session_state.site
prog = st.session_state.progress

st.title(f"\U0001F52D Planificateur Seestar : {site['name']}")

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
    st.caption("Cochez les directions ou le ciel est degage depuis votre poste.")
    cols = st.columns(4)
    for i, sector in enumerate(COMPASS_SECTORS):
        with cols[i % 4]:
            checked = st.checkbox(sector, value=prog["horizon"].get(sector, False), key=f"h_{sector}")
            if checked != prog["horizon"].get(sector, False):
                prog["horizon"][sector] = checked
                progress_store.save(prog)

    st.header("Fenetre d'observation")
    mode = st.radio("Plage horaire", ["Habituelle (20:00–22:30)", "Nuit complete"], index=0)


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


def _view_df(df: pd.DataFrame, view_mode_key: str) -> pd.DataFrame:
    """Filtre `df` sur la fenetre d'observation habituelle, sauf si elle est vide
    ou que le mode 'nuit complete' est actif."""
    if view_mode_key != "habituelle":
        return df
    start_h, end_h = VIEW_WINDOW["start_hour"], VIEW_WINDOW["end_hour"]
    mask = df.index.map(lambda t: start_h <= t.hour + t.minute / 60 <= end_h)
    filtered = df[mask]
    return filtered if not filtered.empty else df


TIME_AXIS_FORMAT = "%H:%M"  # 24h partout, jamais d'AM/PM -- axe + tooltip des graphiques


def _time_series_chart(df: pd.DataFrame, columns: list[str], height: int = 220) -> alt.Chart:
    """Graphique multi-series avec axe temporel en 24h (jamais d'AM/PM).

    st.line_chart delegue a Vega-Lite qui formate par defaut l'axe temporel en
    12h -- on construit donc le spec Altair a la main avec un format d'axe
    explicite en heures:minutes 24h.
    """
    long_df = df[columns].reset_index().melt("time", var_name="serie", value_name="valeur")
    return (
        alt.Chart(long_df)
        .mark_line()
        .encode(
            x=alt.X("time:T", title="Heure", axis=alt.Axis(format=TIME_AXIS_FORMAT)),
            y=alt.Y("valeur:Q", title=""),
            color=alt.Color("serie:N", title="", sort=columns),
            tooltip=[alt.Tooltip("time:T", title="Heure", format=TIME_AXIS_FORMAT),
                     alt.Tooltip("serie:N", title="Serie"),
                     alt.Tooltip("valeur:Q", title="Valeur")],
        )
        .properties(height=height)
    )


def _render_time_series(df: pd.DataFrame, columns: list[str], height: int = 220) -> None:
    """Affiche le graphique, sauf dans deux cas degeneres ou l'axe X (temps) ou
    l'axe Y (valeurs) n'a pas de domaine exploitable pour Altair/Vega-Lite --
    dans les deux cas, on obtient des erreurs SVG malformees cote navigateur
    (transform/translate avec Number.MAX_VALUE) plutot qu'un graphique casse
    visuellement, donc on affiche un message a la place :
    - un seul horodatage distinct (ou moins) : typique quand la fenetre
      "Habituelle" (20h-22h30 fixe) ne recouvre que tres peu d'heures de nuit
      astronomique reelle selon la saison ;
    - toutes les valeurs NaN sur les colonnes affichees : observe pour des
      nuits proches de la limite de couverture des previsions meteo, ou un
      champ entier peut manquer pour les heures concernees.
    """
    if df.index.nunique() < 2 or not df[columns].notna().any().any():
        st.info("Pas assez de donnees sur cette fenetre pour un graphique.")
        return
    st.altair_chart(_time_series_chart(df, columns, height=height), use_container_width=True)


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
    view_df = _view_df(df, view_mode_key) if catalog == "targets" else df
    horizon = dict(horizon_key)
    targets = load_targets() if catalog == "targets" else load_messier()

    rows = []
    for tgt in targets:
        w = target_windows(view_df, tgt, horizon=horizon, site=site_dict)
        if catalog == "targets":
            if w["hours"] == 0:
                continue
            rows.append({
                "Cible": w["name"], "Nom commun": tgt.get("common_name", ""), "Type": w["type"],
                "Filtre": w["filter"], "Debut": w["start"].strftime("%H:%M"),
                "Fin": w["end"].strftime("%H:%M"), "Heures": w["hours"],
                "Alt max deg": w["max_alt"], "Lune deg": w["min_moon_sep"],
                "Cadrage": fits_in_fov(*w["size"]) if all(w["size"]) else "taille inconnue",
                "Image": dss_image_url(tgt["ra"], tgt["dec"], tgt.get("w"), tgt.get("h")),
            })
        else:
            rows.append({
                "id": tgt["messier"],
                "Messier": tgt["name"],
                "Nom commun": tgt.get("common_name", ""),
                "Type": w["type"],
                "Faisable ce soir": "Oui" if w["hours"] > 0 else "Non",
                "Heures": w["hours"],
                "Image": dss_image_url(tgt["ra"], tgt["dec"], tgt.get("w"), tgt.get("h")),
            })
    return rows


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
    st.subheader("Nuits a venir")
    cols = st.columns(len(nights))
    for col, (d, df) in zip(cols, nights.items()):
        s = night_summary(df)
        pct, label = score_label_fr(s["score"])
        emoji = "\U0001F7E2" if s["score"] >= 0.7 else "\U0001F7E1" if s["score"] >= 0.5 else "\U0001F534"
        col.metric(f"{emoji} {d.strftime('%a %d/%m')}", f"{pct}/100", label)
        col.caption(f"Lune {s['moon_illum']:.0f} %")

    sel = st.selectbox("Detail de la nuit", list(nights.keys()),
                        format_func=lambda d: d.strftime("%A %d %B"))
    df = nights[sel]
    tw = twilights[sel]

    view_mode_key = "habituelle" if mode.startswith("Habituelle") else "complete"
    view_df = _view_df(df, view_mode_key)

    # Les 4 cartes ci-dessous portent sur la fenetre affichee (view_df), pas sur
    # la nuit entiere : c'est tout l'interet du mode "Habituelle" par defaut.
    s = night_summary(view_df)
    pct, label = score_label_fr(s["score"])

    c1, c2, c3, c4 = st.columns(4)
    with c1:
        st.markdown(f'<div class="card"><h4>Astro score</h4><div class="value">{pct}/100</div>'
                    f'<div class="sub">{label}</div></div>', unsafe_allow_html=True)
    with c2:
        # .mean() peut rendre NaN si la fenetre affichee ne recouvre que des
        # heures ou ce champ meteo manque (observe sur des nuits lointaines) --
        # round(nan) leve ValueError, d'ou le garde-fou pd.notna() ci-dessous.
        cloud_mean = view_df["cloud_cover"].mean() if "cloud_cover" in view_df else float("nan")
        cloud_text = f"{round(cloud_mean)}%" if pd.notna(cloud_mean) else "n/d"
        st.markdown(f'<div class="card"><h4>Nuages</h4><div class="value">{cloud_text}</div>'
                    f'<div class="sub">Moyenne de la nuit</div></div>', unsafe_allow_html=True)
    with c3:
        spread = (view_df["temperature_2m"] - view_df["dew_point_2m"]).min()
        if pd.isna(spread):
            risk, advice, spread_text = "Inconnu", "donnees manquantes", "n/d"
        else:
            risk = "Faible" if spread >= 3 else "Moyen" if spread >= 1.5 else "Eleve"
            advice = "Pas necessaire" if spread >= 3 else "Recommande" if spread >= 1.5 else "Indispensable"
            spread_text = f"{spread:.1f}"
        st.markdown(f'<div class="card"><h4>Risque de buee (ecart {spread_text} deg)</h4>'
                    f'<div class="value">{risk}</div>'
                    f'<div class="sub">Anti-buee : {advice}</div></div>', unsafe_allow_html=True)
    with c4:
        window_text = s["best_window"] or "Aucune"
        st.markdown(f'<div class="card"><h4>Meilleure fenetre</h4>'
                    f'<div class="value">{window_text}</div>'
                    f'<div class="sub">Fenetre astro {tw["astro_dusk"].strftime("%H:%M")}'
                    f'–{tw["astro_dawn"].strftime("%H:%M")}</div></div>', unsafe_allow_html=True)

    st.caption(
        f"Crepuscule civil {tw['civil_dusk'].strftime('%H:%M')} · "
        f"nautique {tw['nautical_dusk'].strftime('%H:%M')} · "
        f"astronomique {tw['astro_dusk'].strftime('%H:%M')}  —  "
        f"Aube astronomique {tw['astro_dawn'].strftime('%H:%M')} · "
        f"nautique {tw['nautical_dawn'].strftime('%H:%M')} · "
        f"civile {tw['civil_dawn'].strftime('%H:%M')}"
    )

    st.subheader("Tendance nuages")
    _render_time_series(view_df, ["cloud_cover_low", "cloud_cover_mid", "cloud_cover_high"])

    st.subheader("Point de rosee")
    _render_time_series(view_df, ["temperature_2m", "dew_point_2m"])

    with st.expander("Donnees horaires"):
        st.dataframe(view_df[["score", "cloud_cover_low", "cloud_cover_mid", "cloud_cover_high",
                               "wind_gusts_10m", "temperature_2m", "dew_point_2m",
                               "moon_alt", "moon_illum", "seeing", "transparency"]].round(1))

    st.subheader(f"Cibles faisables : nuit du {sel.strftime('%d/%m')}")
    horizon_key = tuple(sorted(prog["horizon"].items()))
    rows = feasible_rows(site_key, sel, horizon_key, view_mode_key, "targets")
    if rows:
        st.dataframe(pd.DataFrame(rows).sort_values("Heures", ascending=False),
                     use_container_width=True, hide_index=True,
                     column_config={"Image": st.column_config.ImageColumn("Apercu")})
    else:
        st.info("Aucune cible exploitable cette nuit (meteo, Lune ou horizon degage).")

with tab_messier:
    st.subheader("Catalogue Messier")
    captured = set(prog["messier_captured"])
    messier_total = len(load_messier())
    st.progress(len(captured) / messier_total, text=f"{len(captured)}/{messier_total} captures")

    sel_m = st.selectbox("Nuit consideree", list(nights.keys()),
                          format_func=lambda d: d.strftime("%A %d %B"), key="messier_night")

    horizon_key = tuple(sorted(prog["horizon"].items()))
    # view_mode_key fixe ("na") : la faisabilite Messier ignore la fenetre
    # d'observation habituelle (df de nuit complet), donc un changement de
    # mode dans la barre laterale ne doit pas invalider ce cache.
    rows = feasible_rows(site_key, sel_m, horizon_key, "na", "messier")
    for row in rows:
        row["Capture"] = row["id"] in captured
    rows.sort(key=lambda r: int(r["id"]))

    for row in rows:
        c0, c1, c2, c3, c4 = st.columns([1, 1, 3, 2, 2])
        c0.image(row["Image"], width=60)
        c1.write(row["Messier"])
        c2.write(row["Nom commun"] or "—")
        c3.write(f"{row['Type']} · {row['Faisable ce soir']} ({row['Heures']}h)")
        new_val = c4.checkbox("Capture", value=row["Capture"], key=f"cap_{row['id']}")
        if new_val != row["Capture"]:
            progress_store.toggle_messier(prog, row["id"])
            progress_store.save(prog)
            st.rerun()
