"""Geocodage d'adresse en lat/lon via Nominatim (OpenStreetMap)."""
import requests

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "seestar-planner/1.0 (usage personnel)"


class GeocodeError(Exception):
    pass


def geocode(address: str) -> dict:
    """Retourne {'lat': float, 'lon': float, 'display_name': str} ou leve GeocodeError."""
    params = {"q": address, "format": "json", "limit": 1}
    headers = {"User-Agent": USER_AGENT}
    try:
        r = requests.get(NOMINATIM_URL, params=params, headers=headers, timeout=10)
        r.raise_for_status()
        results = r.json()
    except requests.RequestException as e:
        raise GeocodeError(f"Impossible de contacter le service de geocodage : {e}") from e
    if not results:
        raise GeocodeError(f"Adresse introuvable : {address}")
    top = results[0]
    return {"lat": float(top["lat"]), "lon": float(top["lon"]),
            "display_name": top["display_name"]}
