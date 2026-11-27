"""Speed and live progress: answer cache, instant guard refusals, parallel question rendering, /query/stream, vector-index fallback."""
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

pytest.importorskip("backend.rag.search_engine")
import backend.rag.search_engine as se  # noqa: E402
from app.config import Settings  # noqa: E402
from app.engine import EngineResult  # noqa: E402
from app.main import create_app  # noqa: E402
from app.schemas import RawCitation  # noqa: E402
from tests.test_answer_check import ANSWER, Q, pipeline  # noqa: E402

DATA = Path(__file__).parent / "data"


@pytest.fixture
def model(monkeypatch):
    calls = []

    def fake(system, user, max_tokens=None, json_mode=True):
        calls.append(system)
        return ANSWER, "fake"

    monkeypatch.setattr(se, "execute_llm_generation", fake)
    return calls


def test_a_repeated_question_is_answered_from_the_cache_without_a_model_call(model):
    pipe = pipeline()
    first = pipe.answer(Q)
    second = pipe.answer("  what is the maximum period of LEAVE for state employees ")   # same question, other spacing/case
    assert len(model) == 1 and first.citations and second.model_dump() == first.model_dump()


def test_the_cache_reports_itself_as_a_stage_and_can_be_switched_off(model, monkeypatch):
    pipe = pipeline()
    pipe.answer(Q)
    events = []
    pipe.answer(Q, progress=events.append)
    assert [e["stage"] for e in events] == ["cache"]
    monkeypatch.setenv("ANSWER_CACHE_ENABLED", "0")
    pipe.answer(Q)
    assert len(model) == 2


def test_the_no_model_fallback_is_never_cached(monkeypatch):
    monkeypatch.setattr(se, "execute_llm_generation", lambda *a, **k: ("{}", "fallback"))
    pipe = pipeline()
    pipe.answer(Q)
    assert pipe.answer_cache._mem == {}


def test_the_cache_key_includes_the_collection_and_the_answer_language():
    cache = se.AnswerCache("150:1242:2026-01-01")
    assert cache.key(Q, "en") != cache.key(Q, "gu")
    assert cache.key(Q, "en") != se.AnswerCache("151:1250:2026-01-01").key(Q, "en")


def test_each_stage_is_reported_in_order(model):
    events = []
    resp = pipeline().answer(Q, progress=events.append)
    stages = [e["stage"] for e in events]
    assert stages == ["read", "search", "found", "lineage", "evidence", "generate", "verify"]
    assert resp.citations and all(isinstance(e["detail"], str) and e["detail"] for e in events)


def test_a_broken_progress_callback_never_breaks_the_answer(model):
    def boom(_):
        raise RuntimeError("client went away")
    assert pipeline().answer(Q, progress=boom).citations


def test_legal_advice_is_refused_before_any_model_call(monkeypatch):
    calls = []
    monkeypatch.setattr(se, "translate_to_english", lambda q: calls.append(q))
    monkeypatch.setattr(se, "translate_to_gujarati", lambda q: calls.append(q))
    monkeypatch.setattr(se, "execute_llm_generation", lambda *a, **k: calls.append(a) or ("{}", "fake"))
    resp = pipeline().answer("Mane promotion na male to court ma jaine kes jitish?")
    assert resp.insufficient_reason.value == "OUT_OF_SCOPE" and calls == []


@pytest.mark.parametrize("mode,lang,provider,expected", [
    ("auto", "en", "ollama", False),     # CPU model: skip the slow extra call for plain English
    ("auto", "en", "groq", True),        # hosted model: about a second, worth it for Gujarati documents
    ("auto", "gujlish", "ollama", True),  # Gujlish words match neither script, always rendered
    ("off", "gujlish", "groq", False),
    ("on", "en", "ollama", True),
])
def test_when_a_gujarati_rendering_is_asked_for(monkeypatch, mode, lang, provider, expected):
    monkeypatch.setenv("GU_QUERY_TRANSLATION", mode)
    monkeypatch.setattr(se, "primary_provider_name", lambda: provider)
    assert se.want_gujarati_rendering(lang) is expected


def test_both_renderings_of_a_gujlish_question_run_at_the_same_time(monkeypatch):
    import threading
    both_started = threading.Barrier(2, timeout=5)   # deadlocks (and fails) if the two calls ran one after the other

    def english(q):
        both_started.wait()
        return "What is the age limit for a stenographer?"

    def gujarati(q):
        both_started.wait()
        return "સ્ટેનોગ્રાફર માટે ઉંમર મર્યાદા"

    monkeypatch.setenv("GU_QUERY_TRANSLATION", "on")
    # LOCAL_FAST_MODE skips the Gujarati rendering on a CPU model; this test is about the two calls running together.
    monkeypatch.setattr(se, "local_fast_mode_enabled", lambda: False)
    monkeypatch.setattr(se, "translate_to_english", english)
    monkeypatch.setattr(se, "translate_to_gujarati", gujarati)
    events = []
    bundle = pipeline().prepare("stenographer mate age limit ketli che?", progress=events.append)
    assert bundle.query_en.startswith("What is") and bundle.query_gu.startswith("સ્ટેનો")
    assert events[0]["stage"] == "translate" and "English and Gujarati" in events[0]["detail"]


class StreamingEngine:
    supports_progress = True

    def answer(self, question, language, progress=None):
        report = progress or (lambda ev: None)
        report({"stage": "search", "detail": "Searching"})
        report({"stage": "generate", "detail": "Writing"})
        return EngineResult(answer="Medical certificate.", citations=[RawCitation(doc_id="GAD-2010-01", page=1, quote="q")])


def stream_client(tmp_path, engine):
    cfg = Settings(db_path=tmp_path / "t.sqlite", vector_dir=tmp_path / "vec", embed_model="hash", corpus_dir=DATA / "fixtures",
                   lineage_engine="stub", stub_edges=DATA / "fixture_edges.json", engine="retrieval")
    return TestClient(create_app(cfg, engine=engine, persist_vectors=False))


def test_query_stream_sends_stages_then_exactly_the_query_response(tmp_path):
    with stream_client(tmp_path, StreamingEngine()) as c:
        r = c.post("/query/stream", json={"question": "Which documents are required for leave?", "language": "en"})
        assert r.status_code == 200 and r.headers["content-type"].startswith("application/x-ndjson")
        lines = [json.loads(x) for x in r.text.splitlines() if x.strip()]
        plain = c.post("/query", json={"question": "Which documents are required for leave?", "language": "en"}).json()
    assert [x["type"] for x in lines] == ["stage", "stage", "result"]
    assert [x["stage"] for x in lines[:2]] == ["search", "generate"] and all("t" in x for x in lines)
    assert lines[-1]["response"] == plain and plain["verdict"] == "answered"


def test_query_stream_works_with_an_engine_that_reports_no_progress(tmp_path):
    class Plain:
        def answer(self, question, language):
            return EngineResult(insufficient_reason="nothing")
    with stream_client(tmp_path, Plain()) as c:
        lines = [json.loads(x) for x in c.post("/query/stream", json={"question": "x y z"}).text.splitlines()]
    assert lines[-1]["type"] == "result" and lines[-1]["response"]["verdict"] == "insufficient_evidence"


def test_query_stream_reports_an_engine_crash_instead_of_hanging(tmp_path):
    class Broken:
        def answer(self, question, language):
            raise RuntimeError("boom")
    with stream_client(tmp_path, Broken()) as c:
        lines = [json.loads(x) for x in c.post("/query/stream", json={"question": "x y z"}).text.splitlines()]
    assert lines[-1]["type"] == "error" and "boom" in lines[-1]["reason"]


def test_an_index_built_with_another_embedder_falls_back_to_keyword_search(monkeypatch):
    class Client:
        def __init__(self, path):
            pass

        def get_or_create_collection(self, **kw):
            raise ValueError("Embedding function conflict: new: ollama vs persisted: sentence_transformer")

        def get_collection(self, name):
            raise ValueError("sentence_transformers is not installed")

    monkeypatch.setattr(se.chromadb, "PersistentClient", Client)
    monkeypatch.setattr(se.embedding_functions, "OllamaEmbeddingFunction", lambda **k: object())
    monkeypatch.setattr(se, "EMBEDDING_MODEL", "ollama:bge-m3")
    index = se.GRIndex("unused")     # must not raise
    assert index.collection is None and "Keyword search still works" in index.vector_error


def _amended_pipeline():
    """Base rules (age 33) amended by a later order whose preamble names the base and whose next chunk changes rule 3(a)."""
    from datetime import date
    from app.schemas import BBox, Chunk, GRRecord
    from app.squad2_bridge import to_squad2_records
    from backend.models import ClauseStatus
    base_text = "To be eligible for appointment by direct selection a candidate shall not be more than 33 years of age."
    recs = [
        GRRecord(gr_id="BASE", gr_number="KP/1 of 2022", issue_date=date(2022, 3, 30), subject="Health Worker Recruitment Rules, 2022",
                 chunks=[Chunk(chunk_id="BASE:1", page=1, text=base_text, bbox=BBox(x0=1, y0=2, x1=3, y1=4))]),
        GRRecord(gr_id="AMD", gr_number="KP/2 of 2022", issue_date=date(2022, 4, 12), subject="Health Worker Recruitment (Amendment) Rules",
                 chunks=[Chunk(chunk_id="AMD:1", page=1, text="The Government hereby makes the following rules further to amend the Health Worker Recruitment Rules, 2022."),
                         Chunk(chunk_id="AMD:2", page=1, text="Provided that the upper age limit shall not be applicable to a candidate appointed on contract basis."),
                         Chunk(chunk_id="AMD:3", page=2, text="By order and in the name of the Governor of Gujarat, Deputy Secretary.")]),
    ]
    hit = {"chunk_id": "BASE:1", "text": base_text, "rrf_score": 1.0,
           "metadata": {"gr_id": "BASE", "gr_number": "KP/1 of 2022", "issue_date": "2022-03-30", "pages": "[1]"}}

    class Index:
        def search(self, bundle, top_k=20, filters=None):
            return [hit]

    class Lineage:
        def get_clause_status(self, gr_id):
            return ClauseStatus.AMENDED if gr_id == "BASE" else ClauseStatus.ACTIVE

        def get_latest_version(self, gr_id):
            return "AMD" if gr_id == "BASE" else gr_id

        def evidence_chunk_ids(self, gr_id, latest_id):
            return ["AMD:1"]
    return se.RAGPipeline(Index(), to_squad2_records(recs), lineage_graph=Lineage())


def test_the_operative_change_of_an_amending_order_reaches_the_evidence_verbatim():
    pipe = _amended_pipeline()
    context, registry, _ = pipe.build_evidence("What is the upper age limit and was it amended?", pipe.index.search(None))
    texts = [e["verbatim_text"] for e in registry.values()]
    assert any(t.startswith("Provided that the upper age limit shall not be applicable") for t in texts)   # chunk after the preamble
    assert not any("OPERATIVE" in t or t.startswith("[") for t in texts)                                     # quotes stay verbatim
    assert "AMENDING ORDER: it changes GR KP/1 of 2022" in context and "Deputy Secretary" not in context


def test_one_citation_per_quote_even_when_two_statements_cite_it(monkeypatch):
    reply = '{"statements": [{"t": "Up to 180 days.", "k": "E", "ids": ["S1"]}, {"t": "Also 180 days.", "k": "E", "ids": ["S1"]}]}'
    monkeypatch.setattr(se, "execute_llm_generation", lambda *a, **k: (reply, "fake"))
    resp = pipeline().answer(Q)
    assert len(resp.citations) == 1 and all(len(st.citations) == 1 for st in resp.statements)


class DenyingEngine:
    """Cites an amended GR (FIN-2018-03 is amended by FIN-2021-09 in the fixtures) and wrongly says nothing was amended."""
    def answer(self, question, language):
        from app.schemas import Statement, StatementLabel
        cite = RawCitation(doc_id="FIN-2018-03", page=1, quote="q")
        return EngineResult(answer="The limit is 33 years (S1). No amendment has changed this limit.", citations=[cite], statements=[
            Statement(text="The limit is 33 years (S1).", label=StatementLabel.ESTABLISHED, citations=[0]),
            Statement(text="No amendment has changed this limit.", label=StatementLabel.INFERRED, citations=[0])])


def test_a_statement_denying_a_recorded_amendment_is_removed_and_the_amendment_named(tmp_path):
    with stream_client(tmp_path, DenyingEngine()) as c:
        r = c.post("/query", json={"question": "What is the limit and was it amended?", "language": "en"}).json()
    assert r["verdict"] == "answered" and r["citations"][0]["lineage"]["status"] == "amended"
    assert [s["text"] for s in r["statements"]] == ["The limit is 33 years."] and r["answer"] == "The limit is 33 years."
    assert any("no amendment was made was removed" in w and "FIN-2018-03" in w for w in r["warnings"])
