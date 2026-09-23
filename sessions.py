"""Persistance locale : journal de session d'observation -- session en cours
(cibles ajoutees ce soir, cochees au fur et a mesure, notes horodatees par
cible et notes libres) et historique des sorties cloturees. Meme pattern
default()/load()/save() que progress.py/settings.py, mais fichier separe :
celui-ci grandit par accumulation (une entree par sortie cloturee) alors que
les deux autres restent des blobs de taille fixe -- deux rythmes de
croissance differents, deux fichiers.

Aucune donnee fabriquee : contrairement au mockup de design (qui affichait
un exemple du type "28 min - 84 poses retenues"), rien ici n'est mesure --
le Seestar n'est pas integre a cette appli. Chaque entree ne contient que ce
que l'utilisateur a explicitement saisi (des notes libres, un temps d'expo
en minutes) ou ce que l'appli sait reellement (l'heure d'ajout, le score de
la nuit au moment de l'ouverture de la session). Le temps d'expo
(`exposureMin`, voir `set_item_exposure`) suit la meme regle : un champ que
l'utilisateur remplit lui-meme apres coup, jamais une valeur calculee ou
estimee par l'appli. Ne jamais reformater une note en un format qui
ressemblerait a des statistiques d'exposition -- ce serait remettre la
donnee fabriquee du mockup par la petite porte.

Deux champs s'ajoutent a ce que l'utilisateur tape. Le `context` d'une note
(temperature, nuages, seeing, transparence, score horaire, Lune) n'est pas
une mesure : c'est ce que la prevision de l'appli annoncait a l'heure ou la
note a ete ecrite, releve par le client au moment de la saisie -- y compris
hors ligne, ou il le lit dans la prevision de la nuit deja telechargee.
Rien n'est donc fabrique : la valeur existait deja, elle est seulement
conservee au lieu d'etre jetee. Elle est stockee telle quelle, jamais
recalculee a la reception : une note ecrite a 22h40 et synchronisee a 1h du
matin doit garder les conditions de 22h40.

Le `feeling` d'une sortie (satisfaction, qualite de ciel percue, ce qu'on
retient, ce qu'on referait autrement) et la note de satisfaction par cible
(`rating`) sont, eux, de la saisie pure : l'appli ne les deduit de rien.
La qualite de ciel percue est volontairement distincte du score calcule --
c'est l'ecart entre les deux qui interesse, pas leur accord.

Tout ce que l'utilisateur a ecrit ou choisi reste modifiable apres coup :
notes, temps de pose, coches, ressenti, resume, lieu. On reconstitue souvent
une nuit le lendemain matin, et une case fermee pour toujours reste vide
pour toujours. Ce que l'appli a releve elle-meme ne l'est pas : les
horodatages, le score de la nuit, le `context` d'une note et les
`conditions` d'une sortie sont des traces de ce que l'appli savait a ce
moment-la. Les rendre modifiables ferait passer de la fiction pour un
releve -- et une sortie rouverte pour correction repart d'ailleurs avec ses
conditions d'origine, jamais avec celles du soir ou on la corrige.

Le lieu suit la meme regle que le score : fige a l'ouverture de la session,
jamais relu ensuite. C'est ce qui permet de savoir d'ou une sortie a ete
faite -- sans lui, changer de position dans les reglages reecrirait le passe
et toutes les sorties passees se retrouveraient au dernier endroit
configure. Ce n'est pas une mesure GPS prise a l'insu de l'utilisateur :
c'est la position que l'appli utilisait deja pour ses calculs ce soir-la.

Le score de la nuit est capture une seule fois, a l'ouverture de la session
(premiere cible ou premiere note libre ajoutee) et reutilise tel quel a la
cloture -- jamais re-interroge en direct a ce moment-la : c'est une
prevision, pas une mesure retrospective, et cloturer une session au petit
matin ne doit pas figer dans l'historique le score d'une tout autre nuit."""
import json
import os
from datetime import date, datetime
from pathlib import Path
from types import MappingProxyType
from uuid import uuid4

import db

SESSIONS_PATH = Path(__file__).parent / "data" / "sessions.json"

_DEFAULT_FROZEN = MappingProxyType({
    "current": MappingProxyType({"openedAt": None, "scoreAtOpen": None, "siteAtOpen": None,
                                  "items": MappingProxyType({}), "freeNotes": (),
                                  "feeling": MappingProxyType({})}),
    "past": (),
})


def default_feeling() -> dict:
    """Ressenti d'une sortie, vierge. `rating` (satisfaction) et `skyQuality`
    (qualite de ciel percue) valent 1 a 5, ou None tant que rien n'est
    saisi ; `highlight` et `nextTime` sont les deux champs libres de fin de
    nuit."""
    return {"rating": None, "skyQuality": None, "highlight": "", "nextTime": ""}


def default() -> dict:
    """Retourne une copie fraiche et independante des valeurs par defaut."""
    return {
        "current": {"openedAt": None, "scoreAtOpen": None, "siteAtOpen": None,
                    "conditions": None, "items": {}, "freeNotes": [],
                    "feeling": default_feeling()},
        "past": [],
    }


DEFAULT = default()


def _new_note(text: str, at: datetime, context: dict | None = None) -> dict:
    return {"id": uuid4().hex, "text": text, "at": at.isoformat(), "context": context}


def _migrate_note(note: dict) -> dict:
    """Une note ecrite avant l'introduction du contexte n'en a pas : le champ
    existe alors avec la valeur None, jamais reconstitue apres coup -- on ne
    sait plus quel temps il faisait, et l'inventer serait fabriquer."""
    note.setdefault("context", None)
    return note


def _is_active(cur: dict) -> bool:
    """Une session est "en cours" tant qu'elle contient au moins une cible ou
    une note libre -- les deux ouvrent/referment la session de la meme facon
    (voir add_item/add_free_note/remove_item/remove_free_note)."""
    return bool(cur["items"] or cur["freeNotes"])


def _close_if_empty(cur: dict) -> None:
    """Une session vidée de sa derniere entree redevient une session non
    ouverte : ni heure d'ouverture, ni score, ni ressenti. Sans remise a zero
    du ressenti, une note de satisfaction saisie puis annulee se retrouverait
    collee a la sortie suivante."""
    if not _is_active(cur):
        cur["openedAt"] = None
        cur["scoreAtOpen"] = None
        cur["siteAtOpen"] = None
        cur["conditions"] = None
        cur["feeling"] = default_feeling()


def _migrate_item(item: dict) -> dict:
    """Convertit une cible sauvegardee avant l'introduction des notes
    multiples (`note`: str unique) ou du temps d'expo (`exposureMin`) vers la
    forme actuelle -- sans quoi charger un vieux sessions.json ferait planter
    l'appli sur des donnees qu'elle a elle-meme ecrites."""
    if "notes" in item:
        item.setdefault("exposureMin", None)
        item.setdefault("rating", None)
        item["notes"] = [_migrate_note(n) for n in item["notes"]]
        return item
    legacy_note = item.get("note", "")
    notes = [_new_note(legacy_note, datetime.fromisoformat(item["addedAt"]))] if legacy_note else []
    return {"addedAt": item["addedAt"], "done": bool(item.get("done", False)), "notes": notes,
            "exposureMin": None, "rating": None}


def load(path: Path = SESSIONS_PATH) -> dict:
    """Charge le journal -- depuis Supabase si configure (voir db.py), sinon
    depuis `path`. Retombe sur les valeurs par defaut si la source est
    absente, illisible ou corrompue."""
    raw = db.load_blob("sessions") if db.enabled() else _read_file(path)
    if raw is None:
        return default()

    merged = default()
    current_override = raw.get("current")
    if isinstance(current_override, dict):
        merged["current"].update(current_override)
        if not isinstance(merged["current"].get("items"), dict):
            merged["current"]["items"] = {}
        if not isinstance(merged["current"].get("freeNotes"), list):
            merged["current"]["freeNotes"] = []
        if not isinstance(merged["current"].get("feeling"), dict):
            merged["current"]["feeling"] = default_feeling()
        merged["current"].setdefault("siteAtOpen", None)
        merged["current"].setdefault("conditions", None)
    merged["current"]["items"] = {k: _migrate_item(v) for k, v in merged["current"]["items"].items()}
    merged["current"]["freeNotes"] = [_migrate_note(n) for n in merged["current"]["freeNotes"]]
    merged["current"]["feeling"] = {**default_feeling(), **merged["current"]["feeling"]}

    past_override = raw.get("past")
    if isinstance(past_override, list):
        merged["past"] = past_override
        for entry in merged["past"]:
            entry.setdefault("freeNotes", [])
            entry["freeNotes"] = [_migrate_note(n) for n in entry["freeNotes"]]
            entry["feeling"] = {**default_feeling(), **(entry.get("feeling") or {})}
            entry.setdefault("conditions", None)
            entry.setdefault("site", None)
            if entry.get("items"):
                entry["items"] = {k: _migrate_item(v) for k, v in entry["items"].items()}
    return merged


def _read_file(path: Path) -> dict | None:
    if not path.exists():
        return None
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            raise TypeError("le fichier de journal doit contenir un objet JSON")
    except (json.JSONDecodeError, TypeError, ValueError, OSError):
        return None
    return data


def save(data: dict, path: Path = SESSIONS_PATH) -> None:
    """Ecrit le journal -- sur Supabase si configure, sinon sur `path` en
    ecriture atomique (fichier temporaire + `os.replace`)."""
    if db.enabled():
        db.save_blob("sessions", data)
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def add_item(data: dict, designation: str, now: datetime, score_now: int | None,
              site_now: dict | None = None) -> dict:
    """Ajoute `designation` a la session en cours. Si la session est vide,
    l'ouvre (fige `openedAt`/`scoreAtOpen`/`siteAtOpen`) -- idempotent si la
    cible y est deja."""
    cur = data["current"]
    if not _is_active(cur):
        cur["openedAt"] = now.isoformat()
        cur["scoreAtOpen"] = score_now
        cur["siteAtOpen"] = site_now
    cur["items"].setdefault(designation, {"addedAt": now.isoformat(), "done": False, "notes": [],
                                           "exposureMin": None, "rating": None})
    return data


def remove_item(data: dict, designation: str) -> dict:
    """Retire `designation` de la session en cours ; referme la session
    (openedAt/scoreAtOpen remis a None) si elle est alors vide (plus aucune
    cible ni note libre)."""
    cur = data["current"]
    cur["items"].pop(designation, None)
    _close_if_empty(cur)
    return data


def toggle_item(data: dict, designation: str) -> dict:
    item = data["current"]["items"].get(designation)
    if item is not None:
        item["done"] = not item["done"]
    return data


def set_item_exposure(data: dict, designation: str, minutes: int | None) -> dict:
    """Fixe le temps d'expo (minutes) d'une cible de la session en cours --
    un seul champ par cible et par sortie (pas d'historique d'increments,
    contrairement aux notes) : la valeur saisie remplace la precedente. Comme
    pour les notes, c'est l'utilisateur qui saisit cette valeur -- l'appli ne
    mesure rien (voir l'en-tete du module)."""
    item = data["current"]["items"].get(designation)
    if item is None:
        raise ValueError(f"« {designation} » n'est pas dans la session en cours.")
    item["exposureMin"] = minutes
    return data


def exposure_totals(data: dict) -> dict[str, int]:
    """Minutes d'expo cumulees par designation, sur la session en cours et
    tout l'historique -- seule agregation qui a du sens ici : une meme cible
    peut etre pointee sur plusieurs sorties, le temps d'integration s'ajoute
    d'une nuit a l'autre. Ignore les cibles sans valeur saisie."""
    totals: dict[str, int] = {}
    entries = [data["current"]["items"], *(p.get("items", {}) for p in data["past"])]
    for items in entries:
        for designation, item in items.items():
            minutes = item.get("exposureMin")
            if minutes:
                totals[designation] = totals.get(designation, 0) + minutes
    return totals


def add_item_note(data: dict, designation: str, text: str, now: datetime,
                   context: dict | None = None) -> dict:
    """Ajoute une note horodatee a une cible deja dans la session en cours --
    plusieurs notes possibles par cible (ex. une remarque a 22h, une autre
    apres un changement de filtre a 23h30), jamais d'ecrasement. `context`
    est ce que la prevision annoncait a `now` (voir l'en-tete du module),
    conserve tel quel."""
    item = data["current"]["items"].get(designation)
    if item is None:
        raise ValueError(f"« {designation} » n'est pas dans la session en cours.")
    item["notes"].append(_new_note(text, now, context))
    return data


def remove_item_note(data: dict, designation: str, note_id: str) -> dict:
    item = data["current"]["items"].get(designation)
    if item is None:
        raise ValueError(f"« {designation} » n'est pas dans la session en cours.")
    item["notes"] = [n for n in item["notes"] if n["id"] != note_id]
    return data


def add_free_note(data: dict, text: str, now: datetime, score_now: int | None,
                   context: dict | None = None, site_now: dict | None = None) -> dict:
    """Ajoute une note libre (sans cible associee) a la session en cours --
    l'ouvre si c'est la toute premiere entree de la nuit, meme regle que
    `add_item` (une note libre a 21h avant la premiere cible pointee compte
    comme le debut de la sortie)."""
    cur = data["current"]
    if not _is_active(cur):
        cur["openedAt"] = now.isoformat()
        cur["scoreAtOpen"] = score_now
        cur["siteAtOpen"] = site_now
    cur["freeNotes"].append(_new_note(text, now, context))
    return data


def remove_free_note(data: dict, note_id: str) -> dict:
    cur = data["current"]
    cur["freeNotes"] = [n for n in cur["freeNotes"] if n["id"] != note_id]
    _close_if_empty(cur)
    return data


RATING_RANGE = (1, 5)


def _check_rating(value: int | None, field: str) -> None:
    lo, hi = RATING_RANGE
    if value is not None and not (isinstance(value, int) and lo <= value <= hi):
        raise ValueError(f"{field} doit etre compris entre {lo} et {hi}, ou absent.")


def set_item_rating(data: dict, designation: str, rating: int | None) -> dict:
    """Note de satisfaction d'une cible sur cette sortie (1 a 5, ou None pour
    effacer). Saisie pure : l'appli ne deduit rien d'une image qu'elle ne voit
    pas."""
    _check_rating(rating, "rating")
    item = data["current"]["items"].get(designation)
    if item is None:
        raise ValueError(f"« {designation} » n'est pas dans la session en cours.")
    item["rating"] = rating
    return data


def set_feeling(data: dict, patch: dict) -> dict:
    """Met a jour le ressenti de la sortie en cours, champ par champ : seules
    les cles fournies sont remplacees, pour que deux ecrans (ou deux saisies
    differees) ne s'ecrasent pas l'un l'autre. Refuse sur une session non
    ouverte : un ressenti sans sortie n'a pas de sens, et il serait repris
    par la sortie suivante."""
    cur = data["current"]
    if not _is_active(cur):
        raise ValueError("aucune session en cours")
    _check_rating(patch.get("rating"), "rating")
    _check_rating(patch.get("skyQuality"), "skyQuality")
    unknown = set(patch) - set(default_feeling())
    if unknown:
        raise ValueError(f"champ(s) de ressenti inconnu(s) : {', '.join(sorted(unknown))}")
    cur["feeling"] = {**cur["feeling"], **patch}
    return data


def close_session(data: dict, today: date, now: datetime,
                   conditions: dict | None = None) -> dict:
    """Cloture la session en cours : si elle contient au moins une cible ou
    une note libre, la range dans `past` (triee la plus recente en tete) puis
    la vide. Sans effet si la session en cours est deja vide.

    La date de la sortie est celle de son ouverture, pas celle de la cloture :
    une nuit se nomme par le soir ou elle commence, et on la cloture souvent
    apres minuit -- la dater du jour de cloture la decalerait d'un jour. Meme
    raison pour une cloture partie hors ligne et synchronisee le lendemain.
    `today` ne sert que de repli, quand la session n'a pas d'heure d'ouverture
    (entree ancienne).

    `conditions` resume ce que la prevision annoncait sur la duree de la
    sortie (voir l'en-tete du module) : releve par le client, conserve tel
    quel. Une sortie rouverte pour correction garde en revanche les siennes,
    meme si le client en propose de nouvelles : rouvrir sert a corriger ce
    qu'on a ecrit, pas a refaire dire a l'appli ce qu'elle annoncait cette
    nuit-la -- d'autant qu'entre-temps la position a pu changer, et la
    prevision avec elle.

    `openedAt`, `items` et `freeNotes` (copie complete : cochees et toutes
    les notes horodatees incluses) sont conserves dans l'entree passee en
    plus de `targets`/`note` (formes resumees pour l'affichage) : c'est ce
    qui permet a `reopen_session` de restaurer une sortie cloturee par
    erreur a l'identique plutot qu'a vide."""
    cur = data["current"]
    if _is_active(cur):
        texts = [n["text"] for item in cur["items"].values() for n in item["notes"]]
        texts += [n["text"] for n in cur["freeNotes"]]
        opened = cur.get("openedAt")
        night = datetime.fromisoformat(opened).date() if opened else today
        data["past"].insert(0, {
            "date": night.isoformat(),
            "score": cur["scoreAtOpen"],
            "site": cur["siteAtOpen"],
            "targets": sorted(cur["items"].keys()),
            "note": "; ".join(texts),
            "closedAt": now.isoformat(),
            "openedAt": cur["openedAt"],
            "items": {k: {**v, "notes": list(v["notes"])} for k, v in cur["items"].items()},
            "freeNotes": list(cur["freeNotes"]),
            "feeling": dict(cur["feeling"]),
            "conditions": cur.get("conditions") if cur.get("conditions") is not None else conditions,
        })
    data["current"] = default()["current"]
    return data


def set_past_note(data: dict, closed_at: str, note: str) -> dict:
    """Modifie la note-resume d'une sortie cloturee -- independamment des
    notes horodatees (par cible ou libres) figees a la cloture, pour laisser
    corriger ou completer ce resume apres-coup sans devoir rouvrir la session."""
    entry = next((p for p in data["past"] if p["closedAt"] == closed_at), None)
    if entry is None:
        raise ValueError(f"aucune sortie cloturee a {closed_at}")
    entry["note"] = note
    return data


def set_past_feeling(data: dict, closed_at: str, patch: dict) -> dict:
    """Complete ou corrige le ressenti d'une sortie deja cloturee, champ par
    champ. On rentre rarement remplir « ce que je retiens » avant d'avoir
    range le materiel : pouvoir l'ecrire le lendemain evite que la case reste
    vide pour toujours."""
    _check_rating(patch.get("rating"), "rating")
    _check_rating(patch.get("skyQuality"), "skyQuality")
    unknown = set(patch) - set(default_feeling())
    if unknown:
        raise ValueError(f"champ(s) de ressenti inconnu(s) : {', '.join(sorted(unknown))}")
    entry = next((p for p in data["past"] if p["closedAt"] == closed_at), None)
    if entry is None:
        raise ValueError(f"aucune sortie cloturee a {closed_at}")
    entry["feeling"] = {**default_feeling(), **(entry.get("feeling") or {}), **patch}
    return data


def set_current_site(data: dict, site: dict | None) -> dict:
    """Corrige le lieu de la sortie en cours -- on s'apercoit souvent une
    fois installe qu'on est parti sans changer sa position dans les reglages.
    Refuse sur une session non ouverte : un lieu sans sortie n'a pas de sens,
    et il serait repris par la suivante."""
    cur = data["current"]
    if not _is_active(cur):
        raise ValueError("aucune session en cours")
    cur["siteAtOpen"] = site
    return data


def set_past_site(data: dict, closed_at: str, site: dict | None) -> dict:
    """Corrige le lieu d'une sortie cloturee -- typiquement quand on est
    parti observer ailleurs sans penser a changer sa position dans les
    reglages.

    Les `conditions` de la sortie ne sont pas retouchees : elles disent ce
    que la prevision annoncait la ou l'appli se croyait, et il n'existe pas
    de prevision retrospective pour le vrai lieu. Corriger le lieu repare ce
    qu'on sait, pas ce qu'on ne sait pas."""
    entry = next((p for p in data["past"] if p["closedAt"] == closed_at), None)
    if entry is None:
        raise ValueError(f"aucune sortie cloturee a {closed_at}")
    entry["site"] = site
    return data


def timeline(cur: dict) -> list[dict]:
    """Fil chronologique unique d'une session (en cours ou une entree de
    `past`, meme forme `items`/`freeNotes`) : notes par cible et notes libres
    fusionnees et triees par horodatage -- pour lire la nuit comme un vrai
    carnet d'observation plutot que deux listes separees. `.get(...)` plutot
    que `[...]` : une vieille entree `past` peut ne pas avoir `items`/
    `freeNotes` du tout (creee avant leur introduction, voir `load`)."""
    entries = [
        {"id": note["id"], "at": note["at"], "text": note["text"], "target": designation,
         "context": note.get("context")}
        for designation, item in cur.get("items", {}).items()
        for note in item.get("notes", [])
    ]
    entries += [
        {"id": note["id"], "at": note["at"], "text": note["text"], "target": None,
         "context": note.get("context")}
        for note in cur.get("freeNotes", [])
    ]
    entries.sort(key=lambda e: e["at"])
    return entries


def reopen_session(data: dict, closed_at: str) -> dict:
    """Rouvre une sortie cloturee par erreur : la retire de `past` et restaure
    son etat (cibles, coches, notes par cible, notes libres) comme session en
    cours. Refuse si une session est deja en cours -- il n'y en a jamais deux
    a la fois. Sur une entree ancienne sans `items`/`openedAt`/`freeNotes`
    (creee avant ces champs), reconstruit un etat minimal plutot que d'echouer."""
    if _is_active(data["current"]):
        raise ValueError("une session est deja en cours")
    idx = next((i for i, p in enumerate(data["past"]) if p["closedAt"] == closed_at), None)
    if idx is None:
        raise ValueError(f"aucune sortie cloturee a {closed_at}")
    entry = data["past"].pop(idx)
    items = entry.get("items")
    if not items:
        items = {t: {"addedAt": entry["closedAt"], "done": False, "notes": [], "exposureMin": None}
                 for t in entry["targets"]}
    else:
        items = {k: _migrate_item(dict(v)) for k, v in items.items()}
    data["current"] = {
        "openedAt": entry.get("openedAt") or entry["closedAt"],
        "scoreAtOpen": entry["score"],
        "siteAtOpen": entry.get("site"),
        "conditions": entry.get("conditions"),
        "items": items,
        "freeNotes": list(entry.get("freeNotes") or []),
        "feeling": {**default_feeling(), **(entry.get("feeling") or {})},
    }
    return data
