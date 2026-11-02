"""Part 1: PDF lookup in sub-folders, security middleware, question limit, and the UI mount."""
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from starlette.applications import Starlette
from starlette.responses import PlainTextResponse
from starlette.routing import Route

from app import pdf_lookup
from app.security import HardeningMiddleware


def test_find_pdf_searches_subfolders_and_ignores_paths(tmp_path, monkeypatch):
    pdf_lookup.reset_cache()
    sub = tmp_path / "pdfs" / "a" / "b"
    sub.mkdir(parents=True)
    (sub / "Doc-1.PDF").write_bytes(b"%PDF-1.4")
    (tmp_path / "secret.pdf").write_bytes(b"x")
    monkeypatch.delenv("GOV_PDF_EXTRA_DIRS", raising=False)
    root = tmp_path / "pdfs"
    assert pdf_lookup.find_pdf("Doc-1.PDF", root, tmp_path / "none") == sub / "Doc-1.PDF"
    assert pdf_lookup.find_pdf("doc-1.pdf", root, tmp_path / "none") == sub / "Doc-1.PDF"            # case-insensitive
    assert pdf_lookup.find_pdf(r"..\..\secret.pdf", root, tmp_path / "none") is None                  # only the last name counts
    assert pdf_lookup.find_pdf("../secret.pdf", root, tmp_path / "none") is None
    assert pdf_lookup.find_pdf("notes.txt", root, tmp_path / "none") is None
    assert pdf_lookup.find_pdf(None, root, tmp_path / "none") is None
    pdf_lookup.reset_cache()


def _mini_app(**kw):
    async def ok(request):
        return PlainTextResponse("ok")
    routes = [Route(p, ok, methods=["GET", "POST"]) for p in ("/query", "/admin/rebuild", "/documents", "/health")]
    app = Starlette(routes=routes)
    app.add_middleware(HardeningMiddleware, **kw)
    return TestClient(app)


def test_security_headers():
    r = _mini_app(admin_token="", rate_per_min=0).get("/health")
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "SAMEORIGIN"
    assert r.headers["referrer-policy"] == "no-referrer"


def test_admin_token_guards_writes_only():
    c = _mini_app(admin_token="s3cret", rate_per_min=0)
    assert c.post("/admin/rebuild").status_code == 401
    assert c.post("/admin/rebuild", headers={"X-Admin-Token": "wrong"}).status_code == 401
    assert c.post("/admin/rebuild", headers={"X-Admin-Token": "s3cret"}).status_code == 200
    assert c.post("/documents").status_code == 401
    assert c.get("/documents").status_code == 200       # reading stays open
    assert c.get("/health").status_code == 200


def test_no_token_means_open():
    assert _mini_app(admin_token="", rate_per_min=0).post("/admin/rebuild").status_code == 200


def test_rate_limit_on_questions_only():
    c = _mini_app(admin_token="", rate_per_min=3)
    assert [c.post("/query").status_code for _ in range(5)] == [200, 200, 200, 429, 429]
    assert c.get("/health").status_code == 200
    assert c.post("/query").headers.get("retry-after") == "60"


def test_question_length_limit():
    from app.schemas import QueryRequest
    with pytest.raises(Exception):
        QueryRequest(question="x" * 2001)
    assert QueryRequest(question="x" * 2000)


def test_ui_is_served_when_built(tmp_path):
    from app.config import Settings
    from app.main import create_app
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("<html>GovResolve UI</html>", encoding="utf-8")
    cfg = Settings(frontend_dir=dist)
    with TestClient(create_app(cfg, persist_vectors=False)) as c:
        assert "GovResolve UI" in c.get("/").text
        assert c.get("/health").json()["status"] == "ok"      # API routes still win over the mount
