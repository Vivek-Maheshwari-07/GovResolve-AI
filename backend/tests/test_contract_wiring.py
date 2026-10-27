"""The contract endpoints (Squads 1, 2, 4) must work on the real app and agree with the lineage engine."""
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

FIX = Path(__file__).parents[2] / "data" / "fixtures"


@pytest.fixture()
def api(tmp_path):
    cfg = Settings(db_path=tmp_path / "t.sqlite", embed_model="hash", corpus_dir=FIX, lineage_engine="real")
    with TestClient(create_app(cfg, persist_vectors=False)) as c:
        yield c


def test_contract_routes_exist_on_the_real_app(api):
    assert len(api.get("/documents").json()) == 23
    assert api.get("/documents/HLT-2005-11").json()["meta"]["doc_id"] == "HLT-2005-11"
    assert api.get("/documents/nope").status_code == 404
    assert len(api.get("/edges").json()) == 17


def test_document_status_matches_clause_engine(api):
    s = api.get("/lineage/HLT-2005-11/status").json()
    assert s["status"] == "superseded" and s["latest_doc_ids"]
    assert api.get("/lineage/PWD-2015-05/status").json()["status"] == "no_later_amendment_found"


def test_lineage_timeline_is_oldest_first(api):
    t = api.get("/lineage/HLT-2005-11").json()["timeline"]
    assert t == ["HLT-2005-11", "HLT-2012-30", "HLT-2020-04"]


def test_probable_edges_never_mark_superseded(api):
    probable = [e for e in api.get("/edges").json() if any(w.startswith("probable") for w in e["warnings"])]
    assert probable and all(e["relation"] in ("amends", "refers_to") for e in probable)


def test_broken_link_becomes_external_stub(api):
    ext = [e["target"] for e in api.get("/edges").json() if e["target"].startswith("ext:")]
    assert len(ext) == 1
    assert all(not d["is_external"] for d in api.get("/documents").json())


def test_query_returns_contract_shape_with_lineage_warning(api):
    r = api.post("/query", json={"question": "hospital reimbursement per day"}).json()
    assert r["verdict"] in ("answered", "insufficient_evidence")
    if r["verdict"] == "answered":
        assert all("lineage" in c for c in r["citations"])


def test_query_refuses_when_nothing_matches(api):
    r = api.post("/query", json={"question": "zzzz qqqq xxxx"}).json()
    assert r["verdict"] == "insufficient_evidence" and r["citations"] == [] and r["reason"]


def test_rebuild_keeps_contract_graph_in_sync(api):
    api.post("/admin/rebuild")
    assert len(api.get("/edges").json()) == 17
