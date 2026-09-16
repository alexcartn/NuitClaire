"""Composants d'affichage HTML/CSS pour app.py : barre de crepuscule et cartes de
cibles. Fonctions pures (aucun appel Streamlit) rendues via
st.markdown(html, unsafe_allow_html=True) depuis app.py -- ce qui permet de les
tester sans lancer Streamlit (voir tests/test_components.py)."""
from datetime import datetime, timedelta
from html import escape

_ONE_HOUR = timedelta(hours=1)

# Couleurs des bandes jour -> nuit, en rgba semi-transparentes (meme logique que le
# style .card existant dans app.py) pour rester lisibles sur theme clair et sombre.
_BAND_COLORS = {
    "day": "rgba(255, 200, 80, 0.65)",
    "civil": "rgba(255, 140, 70, 0.6)",
    "nautical": "rgba(90, 105, 180, 0.6)",
    "night": "rgba(12, 16, 38, 0.92)",
}

# (cle dans `tw`, etiquette FR, mise en avant) -- l'astronomique est la frontiere
# du "ciel vraiment noir", donc visuellement plus marquee que civil/nautique.
_TWILIGHT_TICKS = [
    ("civil_dusk", "Civil", False),
    ("nautical_dusk", "Nautique", False),
    ("astro_dusk", "Astro", True),
    ("astro_dawn", "Astro", True),
    ("nautical_dawn", "Nautique", False),
    ("civil_dawn", "Civil", False),
]

# Meme grammaire visuelle que .card h4 dans app.py (petit, majuscules, attenue)
# pour toutes les etiquettes secondaires des nouveaux composants -- l'oeil doit
# accrocher la valeur (le chiffre, l'heure), pas l'etiquette qui la precede.
_LABEL_CSS = "font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.65;"

TWILIGHT_BAR_CSS = f"""
.twilight-bar-wrap {{ margin: 8px 0 24px 0; }}
.twilight-bar {{ position: relative; height: 34px; border-radius: 8px; overflow: hidden;
    border: 1px solid rgba(127,127,127,0.25); }}
.twilight-highlight {{ position: absolute; top: 0; bottom: 0;
    background: rgba(90, 220, 140, 0.35);
    border-left: 2px solid rgba(90, 220, 140, 0.9);
    border-right: 2px solid rgba(90, 220, 140, 0.9); }}
.twilight-now {{ position: absolute; top: -4px; bottom: -4px; width: 2px; background: #e2434f; }}
.twilight-now::after {{ content: "maintenant"; position: absolute; top: -18px; left: 50%;
    transform: translateX(-50%); font-size: 0.65rem; font-weight: 600; color: #e2434f;
    white-space: nowrap; }}
.twilight-ticks {{ position: relative; height: 66px; margin-top: 4px; }}
.twilight-tick {{ position: absolute; top: 0; transform: translateX(-50%); text-align: center;
    white-space: nowrap; }}
/* Les 6 ticks sont dans l'ordre chronologique (trio crepuscule, trio aube) :
   decaler une rangee sur deux separe verticalement les ticks les plus proches
   dans le temps (ex. civil_dusk/nautical_dusk), qui se chevauchent sinon a
   l'etroit -- notamment sur mobile ou les % de l'axe valent peu de pixels. */
.twilight-tick:nth-child(even) {{ top: 24px; }}
.twilight-tick .time {{ display: block; font-size: 0.75rem; opacity: 0.75; }}
.twilight-tick .label {{ display: block; margin-top: 2px; {_LABEL_CSS} }}
.twilight-tick.astro .time {{ font-weight: 700; opacity: 1; }}
.twilight-tick.astro .label {{ opacity: 0.85; }}

@media (max-width: 480px) {{
    .twilight-tick .time {{ font-size: 0.66rem; }}
    .twilight-tick .label {{ font-size: 0.58rem; }}
}}
"""

CARD_CSS = f"""
.target-card {{ background: rgba(127,127,127,0.07); border: 1px solid rgba(127,127,127,0.2);
    border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; height: 100%; }}
.target-card img {{ width: 100%; aspect-ratio: 1 / 1; object-fit: cover; display: block; }}
.target-card-body {{ padding: 12px 12px 16px 12px; display: flex; flex-direction: column; gap: 8px; }}
.target-card-title {{ font-weight: 600; font-size: 0.95rem; }}
.target-card-subtitle {{ font-size: 0.8rem; opacity: 0.7; margin-top: -6px; }}
.target-card-badges {{ display: flex; flex-wrap: wrap; gap: 4px; }}
.target-card-badge {{ {_LABEL_CSS} padding: 2px 8px; border-radius: 999px;
    background: rgba(127,127,127,0.18); }}
.target-card-meta {{ display: flex; flex-direction: column; gap: 4px; }}
.target-card-meta-row {{ display: flex; justify-content: space-between; align-items: baseline;
    gap: 8px; }}
.target-card-meta-label {{ {_LABEL_CSS} flex-shrink: 0; }}
.target-card-meta-value {{ font-size: 0.85rem; font-weight: 600; text-align: right; }}
"""


def _pct(t: datetime, axis_start: datetime, axis_end: datetime) -> float:
    """Position de `t` en % le long de [axis_start, axis_end], bornee a [0, 100]."""
    span = (axis_end - axis_start).total_seconds()
    if span <= 0:
        return 0.0
    frac = (t - axis_start).total_seconds() / span
    return max(0.0, min(100.0, frac * 100))


def twilight_bar_html(tw: dict, best_span: tuple[datetime, datetime] | None = None,
                       now: datetime | None = None) -> str:
    """Barre horizontale jour -> crepuscule -> nuit -> aube -> jour pour la nuit
    decrite par `tw` (sortie de astro.twilight_times), avec les 6 heures de
    croisement civil/nautique/astronomique. `best_span` (sortie de
    scoring.best_window_span) est surligne par-dessus si fourni ; `now`, si fourni
    et compris dans l'axe, ajoute un repere "maintenant"."""
    axis_start = tw["civil_dusk"] - _ONE_HOUR
    axis_end = tw["civil_dawn"] + _ONE_HOUR

    stops = [
        (0.0, "day"),
        (_pct(tw["civil_dusk"], axis_start, axis_end), "civil"),
        (_pct(tw["nautical_dusk"], axis_start, axis_end), "nautical"),
        (_pct(tw["astro_dusk"], axis_start, axis_end), "night"),
        (_pct(tw["astro_dawn"], axis_start, axis_end), "nautical"),
        (_pct(tw["nautical_dawn"], axis_start, axis_end), "civil"),
        (_pct(tw["civil_dawn"], axis_start, axis_end), "day"),
        (100.0, "day"),
    ]
    gradient = ", ".join(f"{_BAND_COLORS[band]} {pct:.2f}%" for pct, band in stops)

    overlays = ""
    if best_span is not None:
        start_pct = _pct(best_span[0], axis_start, axis_end)
        end_pct = _pct(best_span[1], axis_start, axis_end)
        if end_pct > start_pct:
            overlays += (f'<div class="twilight-highlight" '
                         f'style="left:{start_pct:.2f}%;width:{end_pct - start_pct:.2f}%" '
                         f'title="Meilleure fenetre"></div>')
    if now is not None and axis_start <= now <= axis_end:
        now_pct = _pct(now, axis_start, axis_end)
        overlays += f'<div class="twilight-now" style="left:{now_pct:.2f}%"></div>'

    ticks = ""
    for key, label, is_astro in _TWILIGHT_TICKS:
        pct = _pct(tw[key], axis_start, axis_end)
        cls = "twilight-tick astro" if is_astro else "twilight-tick"
        ticks += (f'<div class="{cls}" style="left:{pct:.2f}%">'
                  f'<span class="time">{tw[key].strftime("%H:%M")}</span>'
                  f'<span class="label">{escape(label)}</span></div>')

    return (
        '<div class="twilight-bar-wrap">'
        f'<div class="twilight-bar" style="background: linear-gradient(to right, {gradient});">'
        f'{overlays}</div>'
        f'<div class="twilight-ticks">{ticks}</div>'
        '</div>'
    )


def card_html(image: str, title: str, subtitle: str | None,
              badges: list[str], meta: list[tuple[str, str]]) -> str:
    """Une carte cible : image + titre + badges + lignes cle/valeur. Rendue
    directement, colonne par colonne (`st.columns`), dans les onglets "Ce soir"
    et "Catalogue Messier" -- ou des widgets Streamlit reels (bouton Detail,
    case a cocher Messier) doivent rester a cote de la carte (impossible a
    exprimer dans du HTML statique)."""
    subtitle_html = f'<div class="target-card-subtitle">{escape(subtitle)}</div>' if subtitle else ""
    badges_html = "".join(f'<span class="target-card-badge">{escape(b)}</span>' for b in badges if b)
    meta_html = "".join(
        f'<div class="target-card-meta-row"><span class="target-card-meta-label">{escape(label)}</span>'
        f'<span class="target-card-meta-value">{escape(str(value))}</span></div>'
        for label, value in meta)
    return (
        '<div class="target-card">'
        f'<img src="{escape(image)}" loading="lazy" alt="{escape(title)}">'
        '<div class="target-card-body">'
        f'<div class="target-card-title">{escape(title)}</div>'
        f'{subtitle_html}'
        f'<div class="target-card-badges">{badges_html}</div>'
        f'<div class="target-card-meta">{meta_html}</div>'
        '</div></div>'
    )
