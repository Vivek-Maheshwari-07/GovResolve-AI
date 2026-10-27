from fastapi.testclient import TestClient

from app.engine import EngineResult
from app.graph import LineageGraph
from app.main import create_app
from app.schemas import RawCitation
from app.seed import load_demo


class FakeEngine:
    def __init__(self, result: EngineResult):
        self.result = result
        self.seen: tuple[str, str] | None = None

    def answer(self, question: str, language: str) -> EngineResult:
        self.seen = (question, language)
        return self.result


def seeded_client(engine=None, store_path=None):
    graph = LineageGraph()
    load_demo(graph)
    return TestClient(create_app(graph=graph, engine=engine, store_path=store_path))


def test_health_counts_real_documents_only():
    assert seeded_client().get("/health").json() == {"status": "ok", "documents": 4}


def test_ingest_endpoint_returns_edges():
    client = TestClient(create_app(graph=LineageGraph()))
    body = {
        "doc_id": "d1",
        "gr_number": "X/1",
        "issue_date": "2020-01-01",
        "pages": [{"page": 3, "text": "This GR supersedes GR No. Y/9 dated 01/01/2010."}],
    }
    res = client.post("/documents", json=body)
    assert res.status_code == 200
    data = res.json()
    assert data["edges_added"][0]["relation"] == "supersedes"
    assert data["edges_added"][0]["evidence"]["page"] == 3
    assert len(data["external_stubs_created"]) == 1


def test_ingest_rejects_page_zero():
    client = TestClient(create_app(graph=LineageGraph()))
    res = client.post("/documents", json={"doc_id": "d", "pages": [{"page": 0, "text": "x"}]})
    assert res.status_code == 422


def test_document_detail_and_404():
    client = seeded_client()
    res = client.get("/documents/demo-2018-045")
    assert res.json()["lineage"]["status"] == "superseded"
    assert client.get("/documents/nope").status_code == 404
    assert client.get("/lineage/nope").status_code == 404
    assert client.get("/lineage/nope/status").status_code == 404


def test_lineage_endpoint_returns_timeline():
    data = seeded_client().get("/lineage/demo-2021-130").json()
    assert data["timeline"] == ["demo-2014-001", "demo-2018-045", "demo-2021-130"]
    assert {e["relation"] for e in data["edges"]} == {"amends", "supersedes"}


def test_query_without_engine_refuses():
    res = seeded_client().post("/query", json={"question": "maternity leave rule?"}).json()
    assert res["verdict"] == "insufficient_evidence"
    assert res["answer"] is None
    assert res["language"] == "en"


def test_query_attaches_lineage_and_warns_on_superseded_citation():
    engine = FakeEngine(
        EngineResult(
            answer="A medical certificate is required.",
            citations=[RawCitation(doc_id="demo-2018-045", page=2, quote="medical certificate")],
        )
    )
    res = seeded_client(engine).post("/query", json={"question": "પ્રસૂતિ રજા માટે documents?"}).json()
    assert engine.seen[1] == "mixed"
    assert res["verdict"] == "answered"
    cit = res["citations"][0]
    assert cit["issue_date"] == "2018-05-20"
    assert cit["lineage"]["status"] == "superseded"
    assert any("superseded" in w for w in res["warnings"])


def test_query_with_only_unknown_citations_is_insufficient():
    engine = FakeEngine(
        EngineResult(answer="Made up.", citations=[RawCitation(doc_id="ghost", page=1, quote="x")])
    )
    res = seeded_client(engine).post("/query", json={"question": "anything"}).json()
    assert res["verdict"] == "insufficient_evidence"
    assert any("unknown document" in w for w in res["warnings"])


def test_query_answer_without_citations_is_refused():
    engine = FakeEngine(EngineResult(answer="Uncited claim."))
    res = seeded_client(engine).post("/query", json={"question": "anything"}).json()
    assert res["verdict"] == "insufficient_evidence"
    assert res["answer"] is None


def test_store_path_persists_ingested_documents(tmp_path):
    path = tmp_path / "g.json"
    client = TestClient(create_app(store_path=path))
    client.post("/documents", json={"doc_id": "d1", "pages": [{"page": 1, "text": "hello"}]})
    reloaded = TestClient(create_app(store_path=path))
    assert reloaded.get("/health").json()["documents"] == 1
