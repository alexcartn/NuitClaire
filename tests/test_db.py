import pytest
import requests

import db


class _Resp:
    def __init__(self, payload=None, status=200):
        self.payload, self.status_code = payload, status

    def json(self):
        return self.payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(str(self.status_code))


@pytest.fixture
def env(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://abc.supabase.co/")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "secret")


def test_enabled_only_with_credentials(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    assert not db.enabled()
    monkeypatch.setenv("SUPABASE_URL", "https://abc.supabase.co")
    monkeypatch.setenv("SUPABASE_KEY", "k")
    assert db.enabled()


def test_load_blob_reads_one_row(env, monkeypatch):
    seen = {}

    def fake_get(url, headers, timeout, params):
        seen.update(url=url, headers=headers, params=params)
        return _Resp([{"data": {"a": 1}}])

    monkeypatch.setattr(db.requests, "get", fake_get)
    assert db.load_blob("settings") == {"a": 1}
    assert seen["url"] == "https://abc.supabase.co/rest/v1/app_state"
    assert seen["params"] == {"select": "data", "store": "eq.settings", "limit": 1}
    assert seen["headers"]["Authorization"] == "Bearer secret"


def test_load_blob_absent_and_errors(env, monkeypatch):
    monkeypatch.setattr(db.requests, "get", lambda *a, **k: _Resp([]))
    assert db.load_blob("sessions") is None
    monkeypatch.setattr(db.requests, "get", lambda *a, **k: _Resp(status=401))
    with pytest.raises(requests.HTTPError):
        db.load_blob("sessions")


def test_save_blob_upserts_on_store(env, monkeypatch):
    seen = {}

    def fake_post(url, timeout, params, headers, json):
        seen.update(params=params, headers=headers, json=json)
        return _Resp(status=201)

    monkeypatch.setattr(db.requests, "post", fake_post)
    db.save_blob("progress", {"x": 2})
    assert seen["params"] == {"on_conflict": "store"}
    assert "merge-duplicates" in seen["headers"]["Prefer"]
    assert seen["json"] == {"store": "progress", "data": {"x": 2}}
