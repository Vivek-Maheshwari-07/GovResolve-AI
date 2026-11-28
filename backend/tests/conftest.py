import pytest
from fastapi.testclient import TestClient

from pathlib import Path

from app.config import Settings
from app.main import create_app


DATA = Path(__file__).parent / "data"

# manual/ holds slow end-to-end smoke scripts (they load the real embedding model); run them by hand, see manual/README.md
collect_ignore_glob = ["manual/*"]


@pytest.fixture()
def client(tmp_path):
    """API tests run against the stub engine and the 5 stub-era fixtures (known, hand-written edges)."""
    cfg = Settings(db_path=tmp_path / "t.sqlite", vector_dir=tmp_path / "vec", embed_model="hash",
                   corpus_dir=DATA / "fixtures", lineage_engine="stub", stub_edges=DATA / "fixture_edges.json",
                   engine="retrieval")
    with TestClient(create_app(cfg, persist_vectors=False)) as c:
        yield c


@pytest.fixture(autouse=True)
def no_translation_call_in_tests(monkeypatch):
    """The pipeline renders non-English questions in English with a model call. Tests never make it (and never write the translation
    cache); the cross-lingual tests switch the real function back on and patch the gateway's model call themselves."""
    monkeypatch.setenv("TRANSLATION_CACHE", "")
    monkeypatch.setenv("ANSWER_CACHE", "")              # answers remembered in memory per pipeline only, never on disk
    monkeypatch.setenv("GU_QUERY_TRANSLATION", "off")   # no hidden model call for English questions
    monkeypatch.setenv("GOV_ENGINE", "retrieval")
    monkeypatch.delenv("GOV_ADMIN_TOKEN", raising=False)   # a real admin password in a developer's .env must not lock the tests out; tests that need one set it
    monkeypatch.setenv("EXPLAIN_CACHE", "")                # no explanation cache file in tests
    monkeypatch.setenv("QUERY_REWRITE", "off")          # no hidden model call that rewrites the question; its own tests turn it on
    try:
        import backend.rag.search_engine as se
    except Exception:  # the squad2 modules are optional for the API tests
        yield
        return
    monkeypatch.setattr(se, "translate_to_english", lambda question: None)
    yield
