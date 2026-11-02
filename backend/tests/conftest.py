import pytest
from fastapi.testclient import TestClient

from pathlib import Path

from app.config import Settings
from app.main import create_app


DATA = Path(__file__).parent / "data"


@pytest.fixture()
def client(tmp_path):
    """API tests run against the stub engine and the 5 stub-era fixtures (known, hand-written edges)."""
    cfg = Settings(db_path=tmp_path / "t.sqlite", vector_dir=tmp_path / "vec", embed_model="hash",
                   corpus_dir=DATA / "fixtures", lineage_engine="stub", stub_edges=DATA / "fixture_edges.json")
    with TestClient(create_app(cfg, persist_vectors=False)) as c:
        yield c


@pytest.fixture(autouse=True)
def no_translation_call_in_tests(monkeypatch):
    """The pipeline renders non-English questions in English with a model call. Tests never make it (and never write the translation
    cache); the cross-lingual tests switch the real function back on and patch the gateway's model call themselves."""
    monkeypatch.setenv("TRANSLATION_CACHE", "")
    try:
        import backend.rag.search_engine as se
    except Exception:  # the squad2 modules are optional for the API tests
        yield
        return
    monkeypatch.setattr(se, "translate_to_english", lambda question: None)
    yield
