from catalog import find_target, load_binocular_extras
from optics import binocular_optics, framing, optics_from_settings, visible_in_binoculars, visual_limit_mag, with_optics

BINO = binocular_optics()


def test_seestar_is_the_default_instrument():
    assert optics_from_settings({"instrument": "seestar"}) is None
    assert optics_from_settings({"instrument": "jumelles"})["fov_deg"] == 6.5


def test_visual_limit_grows_with_aperture():
    assert round(visual_limit_mag(50), 1) == 8.5
    assert visual_limit_mag(70) > visual_limit_mag(50)


def test_binoculars_keep_bright_extended_objects_and_drop_faint_ones():
    assert visible_in_binoculars(find_target("M31"), BINO)
    assert visible_in_binoculars(find_target("M45"), BINO)
    assert not visible_in_binoculars(find_target("NGC7814"), BINO)  # galaxie mag 10,6


def test_binocular_classics_are_in_the_catalogue():
    names = {t["name"] for t in load_binocular_extras()}
    assert {"Cr399", "Mel20", "Albireo"} <= names
    assert find_target("Cr 399")["common_name"] == "Coathanger"


def test_framing_follows_the_instrument_field():
    m31 = find_target("M31")
    assert framing(m31) == "mosaique large"                          # Seestar
    assert framing(with_optics(m31, BINO)) == "tient dans le champ"  # 190' < 6,5 deg
    assert framing(with_optics(find_target("Mel25"), BINO)) == "déborde du champ"


def test_binoculars_change_altitude_limits_and_moon_tolerance():
    import scoring

    cluster = with_optics(find_target("M45"), BINO)
    galaxy = with_optics(find_target("M31"), BINO)
    assert scoring.max_alt_for(cluster) == 90
    assert scoring.min_alt_for(galaxy, {"lat": 48.9}) == 15
    assert scoring._uses_lp(cluster) is True    # amas : peu gene par la Lune
    assert scoring._uses_lp(galaxy) is False
