"""Tableau de bord Streamlit : score astro, cibles par direction/horizon, suivi Messier."""
from datetime import date, timedelta

import pandas as pd
import streamlit as st

from config import SITE, NB_NIGHTS, VIEW_WINDOW, SEESTAR
from weather import fetch_all
from astro import night_hours, sky_frame, fits_in_fov, twilight_times, COMPASS_SECTORS
from scoring import score_frame, night_summary, target_windows, score_label_fr
from catalog import load_targets, load_messier
from geocode import geocode, GeocodeError
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


with st.spinner("Chargement meteo + ephemerides..."):
    site_key = (site["name"], site["lat"], site["lon"], site["elevation_m"], site["tz"])
    nights, twilights = load(site_key)

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
    s = night_summary(df)
    pct, label = score_label_fr(s["score"])

    if mode.startswith("Habituelle"):
        start_h, end_h = VIEW_WINDOW["start_hour"], VIEW_WINDOW["end_hour"]
        mask = df.index.map(lambda t: start_h <= t.hour + t.minute / 60 <= end_h)
        view_df = df[mask]
        if view_df.empty:
            view_df = df
    else:
        view_df = df

    c1, c2, c3, c4 = st.columns(4)
    with c1:
        st.markdown(f'<div class="card"><h4>Astro score</h4><div class="value">{pct}/100</div>'
                    f'<div class="sub">{label}</div></div>', unsafe_allow_html=True)
    with c2:
        cloud_now = round(df["cloud_cover"].mean()) if "cloud_cover" in df else 0
        st.markdown(f'<div class="card"><h4>Nuages</h4><div class="value">{cloud_now}%</div>'
                    f'<div class="sub">Moyenne de la nuit</div></div>', unsafe_allow_html=True)
    with c3:
        spread = (df["temperature_2m"] - df["dew_point_2m"]).min()
        risk = "Faible" if spread >= 3 else "Moyen" if spread >= 1.5 else "Eleve"
        advice = "Pas necessaire" if spread >= 3 else "Recommande" if spread >= 1.5 else "Indispensable"
        st.markdown(f'<div class="card"><h4>Risque de buee (ecart {spread:.1f} deg)</h4>'
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
    st.line_chart(view_df[["cloud_cover_low", "cloud_cover_mid", "cloud_cover_high"]], height=220)

    st.subheader("Point de rosee")
    st.line_chart(view_df[["temperature_2m", "dew_point_2m"]], height=220)

    with st.expander("Donnees horaires"):
        st.dataframe(view_df[["score", "cloud_cover_low", "cloud_cover_mid", "cloud_cover_high",
                               "wind_gusts_10m", "temperature_2m", "dew_point_2m",
                               "moon_alt", "moon_illum", "seeing", "transparency"]].round(1))

    st.subheader(f"Cibles faisables : nuit du {sel.strftime('%d/%m')}")
    rows = []
    for tgt in load_targets():
        w = target_windows(view_df, tgt, horizon=prog["horizon"], site=site)
        if w["hours"] == 0:
            continue
        rows.append({
            "Cible": w["name"], "Nom commun": tgt.get("common_name", ""), "Type": w["type"],
            "Filtre": w["filter"], "Debut": w["start"].strftime("%H:%M"),
            "Fin": w["end"].strftime("%H:%M"), "Heures": w["hours"],
            "Alt max deg": w["max_alt"], "Lune deg": w["min_moon_sep"],
            "Cadrage": fits_in_fov(*w["size"]) if all(w["size"]) else "taille inconnue",
        })
    if rows:
        st.dataframe(pd.DataFrame(rows).sort_values("Heures", ascending=False),
                     use_container_width=True, hide_index=True)
    else:
        st.info("Aucune cible exploitable cette nuit (meteo, Lune ou horizon degage).")

with tab_messier:
    st.subheader("Catalogue Messier")
    captured = set(prog["messier_captured"])
    st.progress(len(captured) / 110, text=f"{len(captured)}/110 captures")

    sel_m = st.selectbox("Nuit consideree", list(nights.keys()),
                          format_func=lambda d: d.strftime("%A %d %B"), key="messier_night")
    df_m = nights[sel_m]

    rows = []
    for tgt in load_messier():
        w = target_windows(df_m, tgt, horizon=prog["horizon"], site=site)
        rows.append({
            "id": tgt["messier"],
            "Messier": tgt["name"],
            "Nom commun": tgt.get("common_name", ""),
            "Type": w["type"],
            "Faisable ce soir": "Oui" if w["hours"] > 0 else "Non",
            "Heures": w["hours"],
            "Capture": tgt["messier"] in captured,
        })
    rows.sort(key=lambda r: int(r["id"]))

    for row in rows:
        c1, c2, c3, c4 = st.columns([1, 3, 2, 2])
        c1.write(row["Messier"])
        c2.write(row["Nom commun"] or "—")
        c3.write(f"{row['Type']} · {row['Faisable ce soir']} ({row['Heures']}h)")
        new_val = c4.checkbox("Capture", value=row["Capture"], key=f"cap_{row['id']}")
        if new_val != row["Capture"]:
            progress_store.toggle_messier(prog, row["id"])
            progress_store.save(prog)
            st.rerun()
