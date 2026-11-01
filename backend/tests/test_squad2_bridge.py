"""The Squad 2 bridge, tested with stand-ins shaped like their `QueryResponse` (no Squad 2 code needed)."""
from types import SimpleNamespace as NS

import pytest

from app.main import create_app
from app.squad2_bridge import Squad2Engine, to_engine_result, to_squad2_records


def box(x0=1.0, y0=2.0, x1=3.0, y1=4.0):
    return NS(x0=x0, y0=y0, x1=x1, y1=y1, page=2)


def resp(status="Found, no later change", summary="A medical certificate is required.", reason=None, cites=None, follow=None):
    return NS(answer_status=NS(value=status), summary=summary, insufficient_reason=NS(value=reason) if reason else None,
              citations=cites if cites is not None else [], follow_up_question=follow)


CITE = NS(gr_id="gr-1", gr_number="X/1", issue_date="2021-01-01", page=2, passage="a medical certificate shall be submitted",
          bbox=box(), ocr_confidence=None)


def test_answer_maps_summary_citation_and_bbox():
    out = to_engine_result(resp(cites=[CITE]))
    assert out.answer == "A medical certificate is required."
    assert (out.citations[0].doc_id, out.citations[0].page, out.citations[0].quote) == ("gr-1", 2, CITE.passage)
    assert out.citations[0].bbox == [1.0, 2.0, 3.0, 4.0]
    assert out.insufficient_reason is None


def test_refusal_keeps_the_reason_code_and_follow_up():
    out = to_engine_result(resp(status="Insufficient Evidence", summary="x", reason="TOO_VAGUE", follow="Which leave type?"))
    assert out.answer is None and out.citations == []
    assert out.insufficient_reason.startswith("TOO_VAGUE:") and "Which leave type?" in out.insufficient_reason


def test_empty_summary_is_a_refusal_not_an_empty_answer():
    out = to_engine_result(resp(summary="  ", cites=[CITE]))
    assert out.answer is None


def test_page_zero_is_clamped_to_one_and_blank_passages_are_dropped():
    blank = NS(gr_id="gr-1", gr_number="X", issue_date=None, page=0, passage="", bbox=None, ocr_confidence=None)
    ok = NS(gr_id="gr-1", gr_number="X", issue_date=None, page=0, passage="text", bbox=None, ocr_confidence=None)
    out = to_engine_result(resp(cites=[blank, ok]))
    assert [(c.page, c.quote, c.bbox) for c in out.citations] == [(1, "text", None)]


def test_engine_error_becomes_a_refusal():
    class Boom:
        def answer(self, q, f):
            raise RuntimeError("model down")
    out = Squad2Engine(Boom()).answer("q", "en")
    assert out.answer is None and "RuntimeError" in out.insufficient_reason


def test_query_endpoint_uses_the_bridge_and_drops_citations_to_unknown_documents():
    from fastapi.testclient import TestClient

    class Pipe:
        def answer(self, q, filters):
            return resp(cites=[NS(**{**CITE.__dict__, "gr_id": "not-ingested"})])
    client = TestClient(create_app(engine=Squad2Engine(Pipe())))
    body = client.post("/query", json={"question": "medical certificate?"}).json()
    assert body["verdict"] == "insufficient_evidence" and body["citations"] == []


def test_refusal_sets_reason_code_and_unknown_codes_stay_text_only():
    out = to_engine_result(resp(status="Insufficient Evidence", summary="x", reason="BROKEN_CHAIN"))
    assert out.reason_code.value == "BROKEN_CHAIN"
    assert to_engine_result(resp(status="Insufficient Evidence", summary="x", reason="SOMETHING_NEW")).reason_code is None


def test_statements_keep_labels_and_point_at_citations_by_index():
    other = NS(**{**CITE.__dict__, "page": 3, "passage": "within 30 days"})
    stmts = [NS(text="A certificate is required.", label=NS(value="Established"), citations=[CITE]),
             NS(text="It probably applies to adoption too.", label=NS(value="Inferred"), citations=[]),
             NS(text="Deadline is 30 days.", label=NS(value="Established"), citations=[other])]
    r = resp(cites=[CITE, other])
    r.statements = stmts
    out = to_engine_result(r)
    assert [(s.label.value, s.citations) for s in out.statements] == [
        ("established", [0]), ("inferred", []), ("established", [1])]


def test_records_convert_to_squad2_models():
    pytest.importorskip("backend.models", reason="needs the squad2 branch merged")
    from datetime import date
    from app.schemas import BBox, Chunk, GRRecord
    g = GRRecord(gr_id="G1", gr_number="GS/1", issue_date=date(2020, 1, 2), language="en", source_pdf="g1.pdf",
                 chunks=[Chunk(chunk_id="G1:1", page=2, text="hello world text", bbox=BBox(x0=1, y0=2, x1=3, y1=4))])
    rec = to_squad2_records([g])[0]
    assert rec.gr_id == "G1" and rec.pages[0].page_number == 2 and rec.chunks[0].pages == [2]
    assert rec.chunks[0].bboxes[0].x1 == 3 and rec.issue_date == "2020-01-02"


def test_refusal_shows_the_pipelines_own_reason_not_only_the_generic_text():
    out = to_engine_result(resp(status="Insufficient Evidence", summary="The sentences do not give the age range.", reason="NO_DOCUMENT"))
    assert out.insufficient_reason == "NO_DOCUMENT: The sentences do not give the age range."
    generic = to_engine_result(resp(status="Insufficient Evidence", summary="  ", reason="NO_DOCUMENT"))
    assert generic.insufficient_reason == "NO_DOCUMENT: No relevant GR found in the corpus."
