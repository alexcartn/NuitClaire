"""Geocodage d'adresse en lat/lon via Nominatim (OpenStreetMap)."""
import requests

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse"
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


def reverse_geocode(lat: float, lon: float) -> str:
    """Nom court du lieu (commune, sinon village/hameau/ville) pour des
    coordonnees GPS -- ce que « Ma position » enregistrait sous le nom
    generique "Ma position", indiscernable d'une sortie a l'autre dans le
    journal. Leve GeocodeError si le service ne repond pas ou ne connait
    aucun nom a cet endroit."""
    params = {"lat": lat, "lon": lon, "format": "json", "zoom": 14}
    headers = {"User-Agent": USER_AGENT}
    try:
        r = requests.get(NOMINATIM_REVERSE_URL, params=params, headers=headers, timeout=10)
        r.raise_for_status()
        result = r.json()
    except requests.RequestException as e:
        raise GeocodeError(f"Impossible de contacter le service de geocodage : {e}") from e
    address = result.get("address") or {}
    for key in ("village", "town", "city", "hamlet", "municipality", "suburb"):
        if address.get(key):
            return address[key]
    display = result.get("display_name")
    if display:
        return display.split(",")[0]
    raise GeocodeError("Aucun nom de lieu connu a cette position.")
