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
