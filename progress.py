"""Persistance locale : secteurs d'horizon degages et Messiers captures."""
import json
from pathlib import Path
from types import MappingProxyType

PROGRESS_PATH = Path(__file__).parent / "data" / "progress.json"

# Source de verite interne, totalement figee (MappingProxyType) : aucun code,
# y compris ce module, ne peut la muter par accident. N'y accedez jamais
# directement en dehors de default() ci-dessous.
# Le sous-dict "horizon" duplique intentionnellement config.DEFAULT_HORIZON
# (repli utilise ici quand aucun progress.json n'existe encore) : garder les
# deux synchronises.
_DEFAULT_FROZEN = MappingProxyType({
    "horizon": MappingProxyType({"N": True, "NE": True, "E": False, "SE": False,
                                  "S": False, "SW": False, "W": False, "NW": False}),
    "messier_captured": (),
})


def default() -> dict:
    """Retourne une copie fraiche et independante des valeurs par defaut."""
    return {
        "horizon": dict(_DEFAULT_FROZEN["horizon"]),
        "messier_captured": list(_DEFAULT_FROZEN["messier_captured"]),
    }


# Conserve pour compatibilite (comparaisons `data == DEFAULT`, `dict(DEFAULT)`,
# etc.) : c'est un dict normal et donc techniquement mutable, mais load()/
# save()/toggle_messier() s'appuient uniquement sur default()/_DEFAULT_FROZEN,
# jamais sur cet objet -- le muter directement (ex: DEFAULT["messier_captured"]
# .append(...)) reste une mauvaise idee mais ne corrompra plus les chargements
# futurs. Preferez default() si vous avez besoin d'une copie garantie propre.
DEFAULT = default()


def load(path: Path = PROGRESS_PATH) -> dict:
    """Charge la progression depuis `path`. Retombe sur les valeurs par defaut
    si le fichier est absent, illisible ou corrompu (JSON invalide ou racine
    non-objet), pour ne jamais faire planter l'appli sur un fichier edite
    a la main."""
    if not path.exists():
        return default()

    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            raise TypeError("le fichier de progression doit contenir un objet JSON")
    except (json.JSONDecodeError, TypeError, ValueError, OSError):
        return default()

    merged = default()
    merged.update(data)
    # Fusion cle-par-cle de "horizon" pour ne pas perdre les secteurs absents
    # d'un fichier partiel (un simple dict.update ecraserait tout le sous-dict).
    horizon_override = data.get("horizon")
    if not isinstance(horizon_override, dict):
        horizon_override = {}
    merged["horizon"] = {**_DEFAULT_FROZEN["horizon"], **horizon_override}
    return merged


def save(data: dict, path: Path = PROGRESS_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def toggle_messier(data: dict, messier_id: str) -> dict:
    captured = set(data["messier_captured"])
    if messier_id in captured:
        captured.discard(messier_id)
    else:
        captured.add(messier_id)
    # Tri lexicographique (pas numerique) : "10" passe avant "2". Sans
    # consequence pour l'instant, rien ne depend d'un ordre numerique ici.
    data["messier_captured"] = sorted(captured)
    return data
