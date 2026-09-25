"""Traduction des dicts internes (cles francaises/snake_case, voir `rows.py`
et `config.SITE`) vers le contrat JSON camelCase de l'API mobile."""
import sessions as sessions_store
from rows import filter_label


def site_to_out(site: dict) -> dict:
    return {"name": site["name"], "lat": site["lat"], "lon": site["lon"],
            "elevationM": site["elevation_m"], "tz": site["tz"]}


def _items_to_out(items: dict) -> list[dict]:
    """Cibles d'une session, triees par designation : forme de liste pour
    l'API, la ou le stockage les indexe par designation."""
    return [{"designation": designation, **item} for designation, item in sorted(items.items())]


def sessions_to_out(data: dict) -> dict:
    cur = data["current"]
    items = _items_to_out(cur["items"])
    # `timeline` (notes par cible + notes libres fusionnees et triees, voir
    # sessions.timeline) est calculee ici plutot que stockee : c'est une vue
    # derivee de `items`/`freeNotes`, jamais une source de verite a part.
    past = [
        {**entry, "items": _items_to_out(entry.get("items") or {}),
         "timeline": sessions_store.timeline(entry)}
        for entry in data["past"]
    ]
    return {
        "current": {"openedAt": cur["openedAt"], "scoreAtOpen": cur["scoreAtOpen"],
                    "siteAtOpen": cur["siteAtOpen"], "conditions": cur["conditions"],
                    "items": items,
                    "freeNotes": cur["freeNotes"], "timeline": sessions_store.timeline(cur),
                    "feeling": cur["feeling"]},
        "past": past,
    }


def row_to_target_out(row: dict) -> dict:
    is_messier = row.get("Messier") is not None
    feasible = None
    if "Faisable ce soir" in row:
        feasible = row["Faisable ce soir"] == "Oui"
    return {
        "designation": row.get("Cible") or row.get("Messier"),
        "isMessier": is_messier,
        "messierId": row.get("MessierId") or row.get("id"),
        "commonName": row.get("Nom commun", ""),
        "ngc": row.get("NGC"),
        "type": row.get("Type", ""),
        "typeCode": row.get("TypeCode", ""),
        "filter": filter_label(row.get("Filtre", "sans")),
        "start": row.get("Debut"),
        "end": row.get("Fin"),
        "hours": row.get("Heures", 0),
        "altMaxDeg": row.get("Alt max deg", 0.0),
        "moonSepDeg": row.get("Lune deg", 0.0),
        "cadrage": row.get("Cadrage", ""),
        "imageUrl": row.get("Image", ""),
        "ra": row["RA"], "dec": row["Dec"], "mag": row.get("Mag"),
        "sizeW": row.get("TailleW"), "sizeH": row.get("TailleH"),
        "reasons": row.get("Raisons") or [],
        "feasibleTonight": feasible,
    }


def binoculars_to_out(optics: dict) -> dict:
    from optics import visual_limit_mag

    return {"label": optics["label"], "fovDeg": optics["fov_deg"], "apertureMm": optics["aperture_mm"],
            "minAltDeg": optics["min_alt_deg"], "limitMag": round(visual_limit_mag(optics["aperture_mm"]), 1)}
