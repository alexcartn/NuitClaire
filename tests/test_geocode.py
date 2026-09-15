import pytest
import requests

from geocode import geocode, GeocodeError


class FakeResponse:
    def __init__(self, payload, status=200):
        self._payload = payload
        self.status_code = status

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"status {self.status_code}")

    def json(self):
        return self._payload


def test_geocode_success(monkeypatch):
    def fake_get(url, params=None, headers=None, timeout=None):
        assert "Marson" in params["q"]
        assert headers["User-Agent"]
        return FakeResponse([{"lat": "48.9124325", "lon": "4.5289924",
                               "display_name": "Rue de Saint-Jean, Marson, France"}])

    monkeypatch.setattr(requests, "get", fake_get)
    result = geocode("7 rue Saint Jean, 51240 Marson, France")
    assert result == {"lat": 48.9124325, "lon": 4.5289924,
                       "display_name": "Rue de Saint-Jean, Marson, France"}


def test_geocode_not_found(monkeypatch):
    monkeypatch.setattr(requests, "get", lambda *a, **k: FakeResponse([]))
    with pytest.raises(GeocodeError, match="introuvable"):
        geocode("adresse qui n'existe pas nulle part")


def test_geocode_network_error(monkeypatch):
    def fake_get(*a, **k):
        raise requests.ConnectionError("boom")

    monkeypatch.setattr(requests, "get", fake_get)
    with pytest.raises(GeocodeError, match="contacter"):
        geocode("7 rue Saint Jean, 51240 Marson, France")
