import pandas as pd

import rows
from config import SITE


def _tgt(**over):
    base = {"name": "M31", "ngc_name": "NGC0224", "common_name": "Andromeda Galaxy",
            "type": "G", "type_fr": "galaxie", "ra": 0.712, "dec": 41.27,
            "w": 190.0, "h": 60.0, "mag": 3.4, "filter": "sans", "messier": "31"}
    base.update(over)
    return base


def _window(**over):
    base = {"name": "M31", "type": "galaxie", "filter": "sans", "messier": "31",
            "hours": 5, "start": pd.Timestamp("2026-09-15 22:00"),
            "end": pd.Timestamp("2026-09-16 03:00"), "max_alt": 70.0,
            "min_moon_sep": 90.0, "size": (190.0, 60.0)}
    base.update(over)
    return base


def test_common_row_fields_maps_target_and_window_into_display_shape():
    fields = rows.common_row_fields(_tgt(), _window(), pd.DataFrame(), {}, SITE,
                                     compute_reasons=False)
    assert fields["Nom commun"] == "Andromeda Galaxy"
    assert fields["NGC"] == "NGC0224"
    assert fields["Type"] == "galaxie"
    assert fields["TypeCode"] == "G"
    assert fields["Debut"] == "22:00"
    assert fields["Fin"] == "03:00"
    assert fields["Heures"] == 5
    assert fields["MessierId"] == "31"
    assert fields["RA"] == 0.712 and fields["Dec"] == 41.27
    assert "hips2fits" in fields["Image"]


def test_common_row_fields_cadrage_from_size():
    assert rows.common_row_fields(_tgt(), _window(size=(190.0, 60.0)), pd.DataFrame(), {}, SITE,
                                   compute_reasons=False)["Cadrage"] == "mosaique large"
    assert rows.common_row_fields(_tgt(), _window(size=(20.0, 20.0)), pd.DataFrame(), {}, SITE,
                                   compute_reasons=False)["Cadrage"] == "cadre unique"
    assert rows.common_row_fields(_tgt(w=None, h=None), _window(size=(None, None)), pd.DataFrame(),
                                   {}, SITE, compute_reasons=False)["Cadrage"] == "taille inconnue"


def test_common_row_fields_skips_reasons_when_feasible():
    # w["hours"] > 0 -- pas d'infaisabilite a expliquer, meme si compute_reasons=True.
    fields = rows.common_row_fields(_tgt(), _window(hours=5), pd.DataFrame(), {}, SITE,
                                     compute_reasons=True)
    assert fields["Raisons"] == []


def test_common_row_fields_computes_reasons_only_when_requested_and_infeasible(monkeypatch):
    monkeypatch.setattr(rows, "target_feasibility_reasons", lambda *a, **k: ["Trop basse."])
    infeasible = _window(hours=0)
    assert rows.common_row_fields(_tgt(), infeasible, pd.DataFrame(), {}, SITE,
                                   compute_reasons=True)["Raisons"] == ["Trop basse."]
    assert rows.common_row_fields(_tgt(), infeasible, pd.DataFrame(), {}, SITE,
                                   compute_reasons=False)["Raisons"] == []


def test_row_from_search_shapes_messier_vs_plain_target(monkeypatch):
    monkeypatch.setattr(rows, "target_windows", lambda *a, **k: _window())
    row_messier = rows.row_from_search(_tgt(messier="31"), pd.DataFrame(), {}, SITE)
    assert row_messier["Cible"] is None and row_messier["Messier"] == "M31" and row_messier["id"] == "31"

    row_plain = rows.row_from_search(_tgt(messier=None), pd.DataFrame(), {}, SITE)
    assert row_plain["Cible"] == "M31" and row_plain["Messier"] is None and row_plain["id"] is None


def test_filter_label_known_and_unknown_codes():
    assert rows.filter_label("sans") == "Aucun"
    assert rows.filter_label("LP") == "Anti-pollution lumineuse (LP)"
    assert rows.filter_label("mystere") == "mystere"


def test_subtitle_with_ngc_combines_or_dedupes():
    assert rows.subtitle_with_ngc("Andromeda Galaxy", "NGC0224", "M31") == "Andromeda Galaxy · NGC0224"
    assert rows.subtitle_with_ngc("", "NGC7380", "NGC7380") is None  # NGC == nom principal affiche
    assert rows.subtitle_with_ngc("", None, "M13") is None


def test_day_frame_spans_19h_to_6h_anchored_on_night_df():
    night_df = pd.DataFrame(index=pd.DatetimeIndex(["2026-09-15 21:48"], name="time"))
    grid = rows.day_frame(night_df, SITE)
    assert len(grid) == 12
    assert grid.index[0] == pd.Timestamp("2026-09-15 19:00")
    assert grid.index[-1] == pd.Timestamp("2026-09-16 06:00")
    assert grid.index.tz is None
