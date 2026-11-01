import json

from tests.conftest import DATA
from app.schemas import AnswerStatus, worst_status
from app.services.vector_store import VectorStore
from app.store.corpus import Corpus
from app.store.db import Database


def test_worst_status_order():
    A = AnswerStatus
    assert worst_status([A.FOUND_NO_LATER_CHANGE, A.FOUND_AMENDED]) == A.FOUND_AMENDED
    assert worst_status([A.FOUND_SUPERSEDED, A.CONFLICT]) == A.CONFLICT
    assert worst_status([A.CONFLICT, A.INSUFFICIENT_EVIDENCE]) == A.INSUFFICIENT_EVIDENCE
    assert worst_status([]) == A.INSUFFICIENT_EVIDENCE


def test_corpus_reports_bad_files_without_crashing(tmp_path):
    (tmp_path / "bad.json").write_text("{not json")
    (tmp_path / "wrong.json").write_text(json.dumps({"gr_id": "x", "chunks": "nope"}))
    (tmp_path / "ok.json").write_text(json.dumps({"gr_id": "ok", "chunks": []}))
    c = Corpus.load(tmp_path)
    assert list(c.grs) == ["ok"] and {e["file"] for e in c.errors} == {"bad.json", "wrong.json"}


def test_db_cache_and_logs():
    db = Database(":memory:")
    assert db.cache_get("h") is None
    db.cache_put("h", {"rel_type": None})
    assert db.cache_get("h") == {"rel_type": None}
    db.log_query(query_id="q", question="?", answer="", answer_status="X", refusal_reason=None,
                 citations=[], latency_ms=1)
    assert db.get_log("q")["question"] == "?"


def test_vector_store_indexes_in_batches(monkeypatch):
    import app.services.vector_store as vsm
    monkeypatch.setattr(vsm, "UPSERT_BATCH", 4)  # fixtures hold 6 chunks -> two upserts
    vs = VectorStore(None, "hash", name="batched")
    sizes = []
    real = vs.col.upsert
    monkeypatch.setattr(vs.col, "upsert", lambda **kw: (sizes.append(len(kw["ids"])), real(**kw)))
    assert vs.index_corpus(Corpus.load(DATA / "fixtures")) == 6
    assert sizes == [4, 2] and vs.count() == 6


def test_vector_store_search_and_filters():
    vs = VectorStore(None, "hash", name="unit")
    corpus = Corpus.load(DATA / "fixtures")
    assert vs.index_corpus(corpus) == 6
    top = vs.search("medical reimbursement ceiling per year", k=1)[0]
    assert top["gr_id"] == "FIN-2018-03"
    gad = vs.search("ceiling allowance", k=6, filters={"department": "General Administration Department"})
    assert gad and all(h["gr_id"].startswith("GAD") for h in gad)
    assert vs.search("x", filters={"department": "none"}) == []
