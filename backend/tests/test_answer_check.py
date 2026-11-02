"""ANSWER_CHECK: an optional second model call, "do the cited sentences answer the question?" (off | warn | refuse)."""
from datetime import date

import pytest

pytest.importorskip("backend.rag.search_engine")
import backend.rag.search_engine as se  # noqa: E402
from app.schemas import BBox, Chunk, GRRecord  # noqa: E402
from app.squad2_bridge import to_engine_result, to_squad2_records  # noqa: E402
from backend.rag.search_engine import RAGPipeline  # noqa: E402

TEXT = "The leave shall be admissible for a maximum period of 180 days."
ANSWER = '{"statements": [{"t": "Up to 180 days.", "k": "E", "ids": ["S1"]}]}'
Q = "What is the maximum period of leave for state employees?"


def pipeline():
    rec = GRRecord(gr_id="GR-1", gr_number="X/2020/1", issue_date=date(2020, 1, 1), subject="Leave rules",
                   chunks=[Chunk(chunk_id="GR-1:1", page=1, text=TEXT, bbox=BBox(x0=1, y0=2, x1=3, y1=4))])
    hit = {"chunk_id": "GR-1:1", "text": TEXT, "rrf_score": 1.0,
           "metadata": {"gr_id": "GR-1", "gr_number": "X/2020/1", "issue_date": "2020-01-01", "pages": "[1]"}}

    class Index:
        def search(self, bundle, top_k=20, filters=None):
            return [hit]
    return RAGPipeline(Index(), to_squad2_records([rec]))


@pytest.fixture
def model(monkeypatch):
    """Fake model: answers the question with ANSWER, and the check with state['check'] (provider state['provider'] for the check)."""
    calls, state = [], {"check": "YES", "provider": "fake"}

    def fake(system, user, max_tokens=None, json_mode=True):
        calls.append((system, user, max_tokens, json_mode))
        if system is se.CHECK_SYSTEM:
            return state["check"], state["provider"]
        return ANSWER, "fake"

    monkeypatch.setattr(se, "execute_llm_generation", fake)
    return calls, state


def check_calls(calls):
    return [c for c in calls if c[0] is se.CHECK_SYSTEM]


def test_the_check_is_off_by_default_and_costs_nothing(model, monkeypatch):
    calls, _ = model
    monkeypatch.setattr(se, "ANSWER_CHECK", "off")
    resp = pipeline().answer(Q)
    assert check_calls(calls) == [] and resp.citations and resp.warnings == []


@pytest.mark.parametrize("mode", ["warn", "refuse"])
def test_a_confirmed_answer_passes_untouched(model, monkeypatch, mode):
    calls, _ = model
    monkeypatch.setattr(se, "ANSWER_CHECK", mode)
    resp = pipeline().answer(Q)
    sent = check_calls(calls)
    assert len(sent) == 1 and sent[0][2] == 3 and sent[0][3] is False          # one short plain-text call
    assert Q in sent[0][1] and "Up to 180 days." in sent[0][1] and TEXT in sent[0][1]   # question, answer and the cited sentence
    assert resp.answer_status.value != "Insufficient Evidence" and resp.citations and resp.warnings == []


def test_warn_mode_keeps_the_answer_and_adds_a_warning(model, monkeypatch):
    _, state = model
    state["check"] = "NO"
    monkeypatch.setattr(se, "ANSWER_CHECK", "warn")
    resp = pipeline().answer(Q)
    assert resp.summary == "Up to 180 days." and resp.citations
    assert len(resp.warnings) == 1 and "could not confirm" in resp.warnings[0]
    assert to_engine_result(resp).warnings == resp.warnings                    # reaches /query's warnings


def test_refuse_mode_gives_no_answer_when_the_check_says_no(model, monkeypatch):
    _, state = model
    state["check"] = "No, the evidence is about something else."
    monkeypatch.setattr(se, "ANSWER_CHECK", "refuse")
    resp = pipeline().answer(Q)
    assert resp.answer_status.value == "Insufficient Evidence" and resp.citations == [] and resp.insufficient_reason.value == "NO_DOCUMENT"
    assert "could not confirm" in resp.summary


@pytest.mark.parametrize("reply,provider", [("MAYBE", "fake"), ("", "fake"), ("NO", "fallback")])
def test_an_unreadable_check_or_no_model_never_blocks_an_answer(model, monkeypatch, reply, provider):
    _, state = model
    state["check"], state["provider"] = reply, provider
    monkeypatch.setattr(se, "ANSWER_CHECK", "refuse")
    resp = pipeline().answer(Q)
    assert resp.citations and resp.warnings == [] and resp.answer_status.value != "Insufficient Evidence"


def test_a_refusal_by_the_model_is_not_checked_again(model, monkeypatch):
    calls, _ = model
    monkeypatch.setattr(se, "ANSWER_CHECK", "warn")
    monkeypatch.setattr(se, "execute_llm_generation", lambda s, u, max_tokens=None, json_mode=True:
                        (calls.append((s, u)) or '{"statements": [], "insufficient_reason": "Not stated."}', "fake"))
    resp = pipeline().answer(Q)
    assert resp.answer_status.value == "Insufficient Evidence" and [c for c in calls if c[0] is se.CHECK_SYSTEM] == []
