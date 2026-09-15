"""Dashboard Streamlit : go/no-go par nuit + fenêtres par cible pour le Seestar S50."""
from datetime import date, timedelta
import pandas as pd
import streamlit as st

from config import SITE, NB_NIGHTS
from weather import fetch_all
from astro import night_hours, sky_frame, fits_in_fov
from scoring import score_frame, night_summary, target_windows
from catalog import TARGETS

st.set_page_config(page_title="Seestar Planner", page_icon="🔭", layout="wide")
st.title(f"🔭 Seestar Planner : {SITE['name']}")


@st.cache_data(ttl=1800)
def load():
    wx = fetch_all(days=NB_NIGHTS + 1)
    nights = {}
    for i in range(NB_NIGHTS):
        d = date.today() + timedelta(days=i)
        hrs = night_hours(d)
        if not hrs:
            continue
        sky = sky_frame(hrs)
        df = sky.join(wx, how="left")
        nights[d] = score_frame(df)
    return nights


with st.spinner("Chargement météo + éphémérides..."):
    nights = load()

# --- Vue nuits -------------------------------------------------------------
st.subheader("Nuits à venir")
cols = st.columns(len(nights))
for col, (d, df) in zip(cols, nights.items()):
    s = night_summary(df)
    emoji = "🟢" if s["score"] >= 0.7 else "🟡" if s["score"] >= 0.5 else "🔴"
    col.metric(f"{emoji} {d.strftime('%a %d/%m')}", f"{s['score']:.2f}",
               f"{s['go_hours']} h exploitables")
    col.caption(f"Lune {s['moon_illum']:.0f} %")

sel = st.selectbox("Détail de la nuit", list(nights.keys()),
                   format_func=lambda d: d.strftime("%A %d %B"))
df = nights[sel]

c1, c2 = st.columns(2)
c1.line_chart(df[["score"]], height=200)
c2.line_chart(df[["cloud_cover_low", "cloud_cover_mid", "cloud_cover_high"]], height=200)

with st.expander("Données horaires"):
    st.dataframe(df[["score", "cloud_cover_low", "cloud_cover_mid", "cloud_cover_high",
                     "wind_gusts_10m", "temperature_2m", "dew_point_2m",
                     "moon_alt", "moon_illum", "seeing", "transparency"]].round(1))

# --- Vue cibles ------------------------------------------------------------
st.subheader(f"Cibles faisables : nuit du {sel.strftime('%d/%m')}")
rows = []
for tgt in TARGETS:
    w = target_windows(df, tgt)
    if w["hours"] == 0:
        continue
    rows.append({
        "Cible": w["name"], "Type": w["type"], "Filtre": w["filter"],
        "Début": w["start"].strftime("%H:%M"), "Fin": w["end"].strftime("%H:%M"),
        "Heures": w["hours"], "Alt max °": w["max_alt"], "Lune °": w["min_moon_sep"],
        "Cadrage": fits_in_fov(*w["size"]),
    })
if rows:
    st.dataframe(pd.DataFrame(rows).sort_values("Heures", ascending=False),
                 use_container_width=True, hide_index=True)
else:
    st.info("Aucune cible exploitable cette nuit (météo ou Lune).")
