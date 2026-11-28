"""The /admin page: public login form, every admin call behind it needs the admin token, wrong guesses are throttled."""
from pathlib import Path

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

DATA = Path(__file__).parent / "data"
TOKEN = "correct-horse-battery-staple"


def make_client(tmp_path, monkeypatch, token=TOKEN):
    if token:
        monkeypatch.setenv("GOV_ADMIN_TOKEN", token)
    else:
        monkeypatch.delenv("GOV_ADMIN_TOKEN", raising=False)
    ui = tmp_path / "dist"
    ui.mkdir()
    (ui / "index.html").write_text("<!doctype html><title>app</title>", encoding="utf-8")
    cfg = Settings(db_path=tmp_path / "t.sqlite", vector_dir=tmp_path / "vec", embed_model="hash", corpus_dir=DATA / "fixtures",
                   lineage_engine="stub", stub_edges=DATA / "fixture_edges.json", engine="retrieval", frontend_dir=ui,
                   pdf_dir=tmp_path / "raw")
    return TestClient(create_app(cfg, persist_vectors=False))


def test_the_admin_page_itself_is_public_html_with_no_data(tmp_path, monkeypatch):
    with make_client(tmp_path, monkeypatch) as c:
        for path in ("/admin", "/admin/"):
            r = c.get(path)
            assert r.status_code == 200 and "<title>app</title>" in r.text
            assert r.headers["x-robots-tag"] == "noindex" and r.headers["cache-control"] == "no-store"


def test_login_check_needs_the_right_password(tmp_path, monkeypatch):
    with make_client(tmp_path, monkeypatch) as c:
        assert c.get("/admin/session").status_code == 401
        assert c.get("/admin/session", headers={"X-Admin-Token": "wrong"}).status_code == 401
        ok = c.get("/admin/session", headers={"X-Admin-Token": TOKEN})
        assert ok.status_code == 200 and ok.json()["ok"] is True and ok.json()["max_upload_mb"] > 0


def test_no_password_configured_keeps_the_page_locked(tmp_path, monkeypatch):
    with make_client(tmp_path, monkeypatch, token=None) as c:
        r = c.get("/admin/session")
        assert r.status_code == 503 and "GOV_ADMIN_TOKEN" in r.json()["reason"]


def test_upload_is_refused_without_the_password_and_checks_the_file_with_it(tmp_path, monkeypatch):
    with make_client(tmp_path, monkeypatch) as c:
        files = {"file": ("note.txt", b"not a pdf", "text/plain")}
        assert c.post("/api/upload", files=files).status_code == 401
        assert c.post("/api/upload", files=files, headers={"X-Admin-Token": "wrong"}).status_code == 401
        r = c.post("/api/upload", files=files, headers={"X-Admin-Token": TOKEN})
        assert r.status_code == 400                      # reached the handler, which rejects a non-PDF
        fake = {"file": ("fake.pdf", b"hello world", "application/pdf")}
        assert c.post("/api/upload", files=fake, headers={"X-Admin-Token": TOKEN}).status_code == 400
        assert not list((tmp_path / "raw").glob("*")) if (tmp_path / "raw").exists() else True   # nothing was written


def test_five_wrong_passwords_lock_the_address_out_for_a_minute(tmp_path, monkeypatch):
    with make_client(tmp_path, monkeypatch) as c:
        for _ in range(5):
            assert c.get("/admin/session", headers={"X-Admin-Token": "guess"}).status_code == 401
        locked = c.get("/admin/session", headers={"X-Admin-Token": TOKEN})   # even the right one is refused now
        assert locked.status_code == 429 and locked.headers["retry-after"] == "60"


def test_other_admin_paths_stay_protected(tmp_path, monkeypatch):
    with make_client(tmp_path, monkeypatch) as c:
        for method, path in (("get", "/logs"), ("post", "/admin/rebuild"), ("get", "/admin/edges/overrides")):
            assert getattr(c, method)(path).status_code == 401, path
