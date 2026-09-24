"""Alertes de la nuit, evaluees une fois en fin d'apres-midi par la tache
planifiee (voir GET /api/cron/alerts et vercel.json) : de quoi decider de
sortir ou de preparer l'anti-buee avant la nuit, pas une surveillance en
direct. Pur et sans reseau : prend le resume de la nuit, rend les messages.

Deux alertes, activables dans Reglages (`settings.alerts`) :
- "score" : la nuit atteint le seuil des bonnes conditions ;
- "dew" : l'ecart temperature/point de rosee passe sous le seuil de buee
  a un moment de la fenetre d'observation."""
import pandas as pd

SCORE_THRESHOLD_PCT = 70
DEW_SPREAD_C = 1.5


def night_facts(view_df: pd.DataFrame, score_pct: int, best_window: str | None,
                moon_illum: float) -> dict:
    """Ce dont les alertes ont besoin, extrait de la nuit calculee."""
    facts = {"score_pct": score_pct, "best_window": best_window, "moon_illum": moon_illum,
             "dew_spread": None, "dew_time": None}
    if {"temperature_2m", "dew_point_2m"} <= set(view_df.columns) and not view_df.empty:
        spread = (view_df["temperature_2m"] - view_df["dew_point_2m"]).dropna()
        if not spread.empty:
            facts["dew_spread"] = round(float(spread.min()), 1)
            facts["dew_time"] = spread.idxmin().strftime("%H:%M")
    return facts


def evaluate(night_date: str, enabled: dict, facts: dict, sent: dict) -> list[dict]:
    """Messages a envoyer pour la nuit `night_date` : alertes activees, dont
    la condition est remplie, et pas deja envoyees pour cette nuit."""
    messages = []
    if enabled.get("score") and sent.get("score") != night_date \
            and facts["score_pct"] >= SCORE_THRESHOLD_PCT:
        body = f"Score {facts['score_pct']}/100"
        if facts["best_window"]:
            body += f", meilleure fenêtre {facts['best_window']}"
        body += f", Lune {round(facts['moon_illum'])} %."
        messages.append({"alert": "score", "title": "Bonne nuit en vue", "body": body,
                         "url": "/", "tag": f"score-{night_date}"})
    if enabled.get("dew") and sent.get("dew") != night_date \
            and facts["dew_spread"] is not None and facts["dew_spread"] < DEW_SPREAD_C:
        spread = f"{facts['dew_spread']:.1f}".replace(".", ",")
        messages.append({"alert": "dew", "title": "Risque de buée cette nuit",
                         "body": f"Écart température/rosée de {spread} °C vers {facts['dew_time']} : "
                                 "prévoyez l'anti-buée.",
                         "url": "/", "tag": f"dew-{night_date}"})
    return messages
