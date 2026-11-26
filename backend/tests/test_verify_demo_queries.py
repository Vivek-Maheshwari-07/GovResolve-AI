"""Grading rules of scripts/verify_demo_queries.py (the 36-query demo verification)."""
from scripts.verify_demo_queries import SUITE_IDS, grade, load_questions, overall_status

ANSWERABLE = {"expected_verdict": "answered", "category": "fact", "gold_docs": [{"doc_id": "D1", "page": 2}], "key_points": [["63", "sixty three"]]}
AMENDED = {**ANSWERABLE, "category": "amended"}
REFUSAL = {"expected_verdict": "insufficient_evidence", "expected_reason_code": "NO_DOCUMENT", "gold_docs": [], "key_points": []}


def ans(answer="It is 63 days.", page=2, status="no_later_amendment_found"):
    return {"verdict": "answered", "answer": answer, "citations": [{"doc_id": "D1", "page": page, "quote": "q", "lineage": {"status": status}}]}


def test_suite_has_36_ids_all_present_in_the_eval_sets():
    assert len(SUITE_IDS) == 36 and len(set(SUITE_IDS)) == 36
    rows = load_questions()
    assert all(q in rows for q in SUITE_IDS)


def test_answerable_pass_partial_fail():
    assert grade(ANSWERABLE, ans(), 0, None)[0] == "PASS"
    assert grade(ANSWERABLE, ans(page=5), 0, None)[0] == "PARTIAL"
    assert grade(ANSWERABLE, ans(answer="It is forty days."), 0, None)[0] == "PARTIAL"
    assert grade(ANSWERABLE, {"verdict": "insufficient_evidence", "reason_code": "NO_DOCUMENT"}, 0, None)[0] == "FAIL"
    assert grade(ANSWERABLE, None, 0, "request failed")[0] == "FAIL"


def test_amended_needs_status_and_edges():
    assert grade(AMENDED, ans(status="amended"), 2, None)[0] == "PASS"
    assert grade(AMENDED, ans(status="amended"), 0, None)[0] == "PARTIAL"
    assert grade(AMENDED, ans(), 3, None)[0] == "PARTIAL"


def test_refusals():
    assert grade(REFUSAL, {"verdict": "insufficient_evidence", "reason_code": "NO_DOCUMENT"}, 0, None)[0] == "PASS"
    assert grade(REFUSAL, {"verdict": "insufficient_evidence", "reason_code": "TOO_VAGUE"}, 0, None)[0] == "PARTIAL"
    assert grade(REFUSAL, ans(), 0, None)[0] == "FAIL"


def test_retrieval_only_fallback_is_never_a_pass():
    assert grade(ANSWERABLE, ans(answer="Retrieval-only answer (answer engine not connected). 63 days"), 0, None)[0] == "PARTIAL"


def test_overall_status_matches_the_ui():
    assert overall_status({"verdict": "insufficient_evidence"}) == "insufficient"
    r = {"verdict": "answered", "citations": [{"lineage": {"status": "amended"}}, {"lineage": {"status": "superseded"}}]}
    assert overall_status(r) == "superseded"
    assert overall_status(ans()) == "no_change"
