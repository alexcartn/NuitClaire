"""Statistiques agregees calculees a partir du journal de session (voir
sessions.py) -- vue lecture seule, rien n'est stocke ici. Toutes les valeurs
viennent de ce que l'utilisateur a deja saisi (sessions cloturees, cibles
cochees, temps d'expo) : aucune moyenne ou estimation fabriquee au-dela des
agregations elementaires (compter, sommer, moyenner) decrites ci-dessous."""
from collections import Counter

import progress as progress_store
import sessions as sessions_store


def _month(date_str: str) -> str:
    """'2026-09-16' -> '2026-09'."""
    return date_str[:7]


def outings_by_month(past: list[dict]) -> list[dict]:
    """Nombre de sorties cloturees par mois, triees chronologiquement."""
    counts = Counter(_month(p["date"]) for p in past)
    return [{"month": m, "count": c} for m, c in sorted(counts.items())]


def captures_by_month(past: list[dict]) -> list[dict]:
    """Nombre de cibles cochees "capturee" par mois (une sortie peut compter
    pour plusieurs mois si elle a plusieurs cibles, mais une seule date --
    la sienne, pas celle de chaque coche individuelle)."""
    counts: Counter = Counter()
    for p in past:
        month = _month(p["date"])
        counts[month] += sum(1 for item in p.get("items", {}).values() if item.get("done"))
    return [{"month": m, "count": c} for m, c in sorted(counts.items())]


def successful_outings(past: list[dict]) -> list[dict]:
    """Sorties avec au moins une cible cochee "capturee" -- seule notion de
    "reussite" disponible ici, rien d'autre n'est mesure objectivement."""
    return [p for p in past if any(item.get("done") for item in p.get("items", {}).values())]


def avg_score_successful(past: list[dict]) -> tuple[float | None, int]:
    """Moyenne du score astro (capture a l'ouverture, voir sessions.py) des
    sorties reussies -- sert de proxy "meteo moyenne" : c'est la seule donnee
    meteo conservee par sortie, aucune mesure detaillee (nuages/vent/etc.)
    n'est archivee au-dela du score du soir."""
    successful = successful_outings(past)
    scored = [p["score"] for p in successful if p["score"] is not None]
    avg = round(sum(scored) / len(scored), 1) if scored else None
    return avg, len(successful)


def avg_rating(past: list[dict]) -> tuple[float | None, int]:
    """Satisfaction moyenne des sorties notees, et leur nombre. Agregation
    elementaire d'une saisie pure (voir sessions.set_feeling) : une sortie
    sans note n'est pas comptee, et surtout pas comptee comme moyenne."""
    rated = [p["feeling"]["rating"] for p in past
             if (p.get("feeling") or {}).get("rating") is not None]
    avg = round(sum(rated) / len(rated), 1) if rated else None
    return avg, len(rated)


def exposure_by_target(sessions_data: dict, progress_data: dict) -> list[dict]:
    """Minutes d'expo cumulees par cible, deux sources sommees : le temps
    saisi par session (sessions.exposure_totals) et le journal d'expo libre
    par cible (progress.exposure_totals, voir progress.py) -- une meme
    cible peut avoir des entrees dans les deux, ca s'additionne. Triees par
    temps decroissant puis designation."""
    totals = sessions_store.exposure_totals(sessions_data)
    for designation, minutes in progress_store.exposure_totals(progress_data).items():
        totals[designation] = totals.get(designation, 0) + minutes
    return sorted(
        ({"designation": d, "totalMin": m} for d, m in totals.items()),
        key=lambda x: (-x["totalMin"], x["designation"]),
    )


def compute(sessions_data: dict, progress_data: dict) -> dict:
    """Agrege toutes les statistiques en un seul appel -- forme consommee
    telle quelle par l'API (`GET /api/stats`) et par les deux frontends
    (onglet/ecran Journal)."""
    past = sessions_data["past"]
    avg_score, nb_successful = avg_score_successful(past)
    rating, nb_rated = avg_rating(past)
    exposure = exposure_by_target(sessions_data, progress_data)
    return {
        "totalOutings": len(past),
        "avgRating": rating,
        "ratedOutings": nb_rated,
        "outingsByMonth": outings_by_month(past),
        "capturesByMonth": captures_by_month(past),
        "successfulOutings": nb_successful,
        "avgScoreSuccessful": avg_score,
        "exposureByTarget": exposure,
        "totalExposureMin": sum(e["totalMin"] for e in exposure),
    }
