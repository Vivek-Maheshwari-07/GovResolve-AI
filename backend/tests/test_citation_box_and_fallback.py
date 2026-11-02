"""Part 2 items 1.4b and 1.5: a citation carries its chunk's box, and with no language model the answer is an extractive quote."""
from datetime import date

import pytest
from fastapi.testclient import TestClient

pytest.importorskip("backend.rag.search_engine")
import backend.rag.search_engine as se  # noqa: E402
from app.engine import EngineResult  # noqa: E402
from app.graph import LineageGraph  # noqa: E402
from app.main import create_app  # noqa: E402
from app.schemas import BBox, Chunk, DocumentMeta, GRRecord, RawCitation  # noqa: E402
from app.squad2_bridge import to_engine_result, to_squad2_records  # noqa: E402
from backend.rag.search_engine import RAGPipeline  # noqa: E402

TEXT = ("The leave shall be admissible for a maximum period of 180 days. "
        "The officer shall apply to the head of the department in the prescribed form at least ten days before.")
BOX = (72.0, 410.5, 520.0, 438.0)


def pipeline(text=TEXT):
    rec = GRRecord(gr_id="GR-1", gr_number="X/2020/1", issue_date=date(2020, 1, 1), subject="Leave rules",
                   chunks=[Chunk(chunk_id="GR-1:1", page=2, text=text, bbox=BBox(x0=BOX[0], y0=BOX[1], x1=BOX[2], y1=BOX[3]))])
    hit = {"chunk_id": "GR-1:1", "text": text, "rrf_score": 1.0,
           "metadata": {"gr_id": "GR-1", "gr_number": "X/2020/1", "issue_date": "2020-01-01", "pages": "[2]"}}

    class Index:
        def search(self, bundle, top_k=20, filters=None):
            return [hit]
    return RAGPipeline(Index(), to_squad2_records([rec]))


def ask(monkeypatch, reply, provider="fake"):
    monkeypatch.setattr(se, "execute_llm_generation", lambda sp, up: (reply, provider))
    return pipeline().answer("What is the maximum period of leave for state employees?")


def test_a_citation_carries_the_box_of_its_chunk_and_the_page(monkeypatch):
    resp = ask(monkeypatch, '{"statements": [{"t": "Up to 180 days.", "k": "E", "ids": ["S1"]}]}')
    cit = resp.citations[0]
    assert cit.page == 2 and (cit.bbox.x0, cit.bbox.y0, cit.bbox.x1, cit.bbox.y1) == BOX and cit.bbox.page == 2
    out = to_engine_result(resp)
    assert out.citations[0].bbox == list(BOX) and out.citations[0].page == 2   # [x0, y0, x1, y1], same page as the citation


def test_a_chunk_without_a_box_gives_a_citation_without_one(monkeypatch):
    rec = GRRecord(gr_id="GR-1", gr_number="X/2020/1", issue_date=date(2020, 1, 1),
                   chunks=[Chunk(chunk_id="GR-1:1", page=1, text=TEXT)])
    squad2 = to_squad2_records([rec])
    squad2[0].chunks[0].bboxes = []
    monkeypatch.setattr(se, "execute_llm_generation", lambda sp, up: ('{"statements": [{"t": "x", "ids": ["S1"]}]}', "fake"))
    pipe = pipeline()
    pipe._chunk_box = {}
    assert pipe.answer("What is the maximum period of leave for state employees?").citations[0].bbox is None


def test_without_a_language_model_the_best_passages_are_quoted_with_a_warning(monkeypatch):
    resp = ask(monkeypatch, "{}", provider="fallback")
    assert resp.citations and resp.citations[0].passage in TEXT          # verbatim from the document
    assert resp.citations[0].bbox is not None and resp.summary
    assert [s.label.value for s in resp.statements] == ["Inferred"] * len(resp.statements)   # nobody checked they answer the question
    assert resp.warnings and "language model is unavailable" in resp.warnings[0] and "nobody has checked" in resp.warnings[0]
    out = to_engine_result(resp)
    assert out.answer and out.citations and out.warnings == resp.warnings
    assert all(s.label.value == "inferred" for s in out.statements)


def test_the_most_relevant_sentence_comes_first_in_the_fallback(monkeypatch):
    resp = ask(monkeypatch, "{}", provider="fallback")
    assert "180 days" in resp.citations[0].passage                        # shares words with the question, so it ranks first


def test_a_passage_that_shares_almost_none_of_the_questions_words_is_not_quoted(monkeypatch):
    monkeypatch.setattr(se, "execute_llm_generation", lambda sp, up: ("{}", "fallback"))
    resp = pipeline().answer("What is the monthly salary of the Chief Minister of Gujarat?")   # only 'maximum'-style filler overlaps
    assert resp.citations == [] and resp.answer_status.value == "Insufficient Evidence"
    assert "language model is unavailable" in resp.summary


def test_with_no_evidence_at_all_the_fallback_still_refuses(monkeypatch):
    monkeypatch.setattr(se, "execute_llm_generation", lambda sp, up: ("{}", "fallback"))
    resp = pipeline("ok").answer("What is the maximum period of leave for state employees?")
    assert resp.answer_status.value == "Insufficient Evidence" and resp.citations == [] and resp.insufficient_reason.value == "NO_DOCUMENT"


class FakeEngine:
    def __init__(self, result):
        self.result = result

    def answer(self, question, language):
        return self.result


def test_query_shows_the_engines_own_warnings_with_the_lineage_ones():
    g = LineageGraph()
    g._g.add_node("a", meta=DocumentMeta(doc_id="a", gr_number="N/1", issue_date=date(2020, 1, 1)))
    engine = FakeEngine(EngineResult(answer="Quoted passage.", citations=[RawCitation(doc_id="a", page=1, quote="Quoted passage.")],
                                     warnings=["The language model is unavailable."]))
    res = TestClient(create_app(graph=g, engine=engine)).post("/query", json={"question": "what?"}).json()
    assert res["verdict"] == "answered" and "The language model is unavailable." in res["warnings"]
