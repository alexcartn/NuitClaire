"""Persistance locale : secteurs d'horizon degages et Messiers captures."""
import json
from pathlib import Path

PROGRESS_PATH = Path(__file__).parent / "data" / "progress.json"

DEFAULT = {
    "horizon": {"N": True, "NE": True, "E": False, "SE": False,
                "S": False, "SW": False, "W": False, "NW": False},
    "messier_captured": [],
}


def load(path: Path = PROGRESS_PATH) -> dict:
    if not path.exists():
        return json.loads(json.dumps(DEFAULT))  # deep copy
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    merged = json.loads(json.dumps(DEFAULT))
    merged.update(data)
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
    data["messier_captured"] = sorted(captured)
    return data
