"""GET /api/stats -- vue agregee du journal de session (voir stats.py) :
nombre de sorties, cibles capturees par mois, score moyen des sorties
reussies, temps d'expo cumule par cible."""
from fastapi import APIRouter

import sessions as sessions_store
import stats as stats_store
from api.schemas import StatsOut

router = APIRouter()


@router.get("/api/stats", response_model=StatsOut)
def get_stats() -> dict:
    return stats_store.compute(sessions_store.load())
