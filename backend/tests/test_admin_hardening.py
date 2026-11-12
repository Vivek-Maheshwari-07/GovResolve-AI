"""Admin routes, the /api/query rate limit and the bounded translation cache."""
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.security import HardeningMiddleware
from rag import llm_gateway as gw


def make_app(**kw):
    app = FastAPI()
    app.add_middleware(HardeningMiddleware, **kw)

    @app.get("/logs")
    def logs():
        return []

    @app.post("/api/upload")
    def upload():
        return {"ok": True}

    @app.post("/api/query")
    def query():
        return {"ok": True}
    return app


def test_admin_routes_need_the_token_when_one_is_set():
    c = TestClient(make_app(admin_token="s3cret", rate_per_min=0))
    assert c.get("/logs").status_code == 401
    assert c.post("/api/upload").status_code == 401
    assert c.get("/logs", headers={"X-Admin-Token": "s3cret"}).status_code == 200


def test_without_a_token_admin_routes_refuse_remote_clients():
    c = TestClient(make_app(admin_token="", rate_per_min=0), client=("203.0.113.9", 5000))
    assert c.get("/logs").status_code == 403
    local = TestClient(make_app(admin_token="", rate_per_min=0), client=("127.0.0.1", 5000))
    assert local.get("/logs").status_code == 200


def test_api_query_alias_is_rate_limited_too():
    c = TestClient(make_app(admin_token="", rate_per_min=2))
    codes = [c.post("/api/query").status_code for _ in range(3)]
    assert codes == [200, 200, 429]


def test_translation_cache_is_bounded(monkeypatch):
    monkeypatch.setattr(gw, "MAX_TRANSLATIONS", 3)
    cache = {}
    for i in range(10):
        gw._remember(cache, f"q{i}", "x")
    assert list(cache) == ["q7", "q8", "q9"]
