from urllib.parse import urlparse, parse_qs

from imagery import dss_image_url, MIN_SIZE_ARCMIN, MAX_SIZE_ARCMIN, SIZE_MARGIN, THUMB_SIZE_PX


def _params(url: str) -> dict:
    return parse_qs(urlparse(url).query)


def test_ra_hours_converted_to_degrees():
    # M31 : ra_h=0.7123 -> ra_deg proche de 10.68 (0.7123 * 15)
    url = dss_image_url(ra_h=0.7123, dec_deg=41.2691)
    params = _params(url)
    ra_deg = float(params["ra"][0])
    assert abs(ra_deg - 10.68) < 0.01


def test_dec_passed_through_unchanged():
    url = dss_image_url(ra_h=0.7123, dec_deg=41.2691)
    params = _params(url)
    dec_deg = float(params["dec"][0])
    assert abs(dec_deg - 41.2691) < 1e-6


def test_size_defaults_to_minimum_when_unknown():
    url = dss_image_url(ra_h=5.5, dec_deg=-5.39, size_w_arcmin=None, size_h_arcmin=None)
    params = _params(url)
    fov_arcmin = float(params["fov"][0]) * 60.0
    assert abs(fov_arcmin - MIN_SIZE_ARCMIN) < 1e-6


def test_size_clamped_to_maximum_for_large_object():
    url = dss_image_url(ra_h=5.5, dec_deg=-5.39, size_w_arcmin=200, size_h_arcmin=50)
    params = _params(url)
    fov_arcmin = float(params["fov"][0]) * 60.0
    assert abs(fov_arcmin - MAX_SIZE_ARCMIN) < 1e-6


def test_size_derived_from_catalog_size_with_margin():
    # max(w, h) * marge, dans les bornes
    w_arcmin, h_arcmin = 20.0, 10.0
    expected = max(w_arcmin, h_arcmin) * SIZE_MARGIN
    assert MIN_SIZE_ARCMIN < expected < MAX_SIZE_ARCMIN  # sanity check on fixture values

    url = dss_image_url(ra_h=5.5, dec_deg=-5.39, size_w_arcmin=w_arcmin, size_h_arcmin=h_arcmin)
    params = _params(url)
    fov_arcmin = float(params["fov"][0]) * 60.0
    assert abs(fov_arcmin - expected) < 1e-6


def test_url_contains_expected_query_keys():
    url = dss_image_url(ra_h=5.5877, dec_deg=-5.3911, size_w_arcmin=85, size_h_arcmin=85)
    params = _params(url)
    for key in ("ra", "dec", "fov", "width", "height"):
        assert key in params
    assert int(params["width"][0]) == THUMB_SIZE_PX
    assert int(params["height"][0]) == THUMB_SIZE_PX
    assert url.startswith("https://alasky.cds.unistra.fr/hips-image-services/hips2fits?")
