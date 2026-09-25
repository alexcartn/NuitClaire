"""Forme commune d'une 'ligne cible' partagee par les deux catalogues
(targets/messier), la recherche et la modale de detail -- extrait de app.py
pour que l'API mobile et l'appli Streamlit calculent exactement la meme
chose, plutot que deux implementations qui divergent au premier correctif."""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pandas as pd

from optics import framing
from imagery import dss_image_url
from scoring import target_windows, target_feasibility_reasons

_FILTER_LABELS = {"sans": "Aucun", "LP": "Anti-pollution lumineuse (LP)"}


def filter_label(code: str) -> str:
    """Libelle FR lisible pour un code filtre du catalogue ('sans'/'LP') --
    affiche tel quel si le code est inconnu plutot que de planter."""
    return _FILTER_LABELS.get(code, code)


def subtitle_with_ngc(common_name: str, ngc_name: str | None, primary_name: str) -> str | None:
    """Combine le nom usuel et la designation NGC/IC alternative, quand elle
    differe du nom principal affiche -- pertinent uniquement pour les objets
    Messier, dont le nom principal est "M##" plutot que la designation NGC/IC
    (ex. M31 -> sous-titre "Andromeda Galaxy - NGC0224")."""
    parts = [p for p in (common_name or None, ngc_name if ngc_name and ngc_name != primary_name else None)
             if p]
    return " · ".join(parts) or None


def common_row_fields(tgt: dict, w: dict, night_df: pd.DataFrame, horizon: dict,
                       site: dict, compute_reasons: bool) -> dict:
    """Champs communs aux deux catalogues (targets/messier) et a la recherche.
    `compute_reasons` ne calcule `target_feasibility_reasons` que lorsque
    c'est utile (cible infaisable), pour ne pas payer ce calcul supplementaire
    sur les dizaines de cibles faisables d'une nuit normale."""
    reasons = (target_feasibility_reasons(night_df, tgt, horizon=horizon, site=site)
               if compute_reasons and w["hours"] == 0 else [])
    return {
        "Nom commun": tgt.get("common_name", ""), "NGC": tgt.get("ngc_name"),
        "Type": w["type"], "TypeCode": tgt.get("type"),
        "Filtre": w["filter"],
        "Debut": w["start"].strftime("%H:%M") if w["start"] is not None else None,
        "Fin": w["end"].strftime("%H:%M") if w["end"] is not None else None,
        "Heures": w["hours"],
        "Alt max deg": w["max_alt"], "Lune deg": w["min_moon_sep"],
        "Cadrage": framing(tgt, w["size"]),
        "Image": dss_image_url(tgt["ra"], tgt["dec"], tgt.get("w"), tgt.get("h")),
        "RA": tgt["ra"], "Dec": tgt["dec"], "Mag": tgt.get("mag"),
        "TailleW": tgt.get("w"), "TailleH": tgt.get("h"),
        "MessierId": tgt.get("messier"),
        "Raisons": reasons,
    }


def row_from_search(tgt: dict, night_df: pd.DataFrame, horizon: dict, site: dict) -> dict:
    """Construit une ligne (meme forme que `common_row_fields`) pour un objet
    trouve par recherche, faisable ou non -- sur la nuit complete (`night_df`,
    pas la fenetre Habituelle/Nuit complete active), avec les raisons
    d'infaisabilite toujours calculees."""
    w = target_windows(night_df, tgt, horizon=horizon, site=site)
    common = common_row_fields(tgt, w, night_df, horizon, site, compute_reasons=True)
    is_messier = bool(tgt.get("messier"))
    return {"Cible": None if is_messier else w["name"],
            "Messier": w["name"] if is_messier else None,
            "id": tgt.get("messier"), **common}


def day_frame(night_df: pd.DataFrame, site: dict) -> pd.DataFrame:
    """Grille horaire ancree sur la nuit de `night_df` (son premier
    horodatage, toujours en soiree) -- fenetre fixe 19h-6h pour le graphe de
    detail : plus large que `night_hours` (crepuscule astro, variable selon
    la saison) mais sans aller jusqu'a la pleine journee (altitude negative
    la plupart du temps, qui ecrase l'echelle du graphe pour un interet
    limite). Aucune colonne meteo requise : `target_altitude_series` ne
    garde que les colonnes ephemerides qu'elle calcule elle-meme."""
    anchor = night_df.index.min().date()
    tz = ZoneInfo(site["tz"])
    start = datetime(anchor.year, anchor.month, anchor.day, 19, tzinfo=tz)
    hours = [(start + timedelta(hours=i)).replace(tzinfo=None) for i in range(12)]  # 19h -> 6h
    return pd.DataFrame(index=pd.DatetimeIndex(hours, name="time"))
