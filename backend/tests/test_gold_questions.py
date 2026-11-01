"""Structure of eval/gold_questions.json (the content is checked against the corpus text by scripts.make_gold_questions)."""
import json
from collections import Counter
from pathlib import Path

GOLD = Path(__file__).resolve().parents[2] / "eval" / "gold_questions.json"
CATEGORIES = {"simple", "amended", "superseded", "unanswerable", "vague"}
CODES = {"NO_DOCUMENT", "TOO_VAGUE", "MISSING_FACTS", "BROKEN_CHAIN", "POOR_SCAN", "OUT_OF_SCOPE"}
QS = json.loads(GOLD.read_text(encoding="utf-8"))


def test_ids_are_unique_and_fields_present():
    assert len({q["question_id"] for q in QS}) == len(QS) >= 40
    for q in QS:
        assert q["category"] in CATEGORIES and q["language"] in {"en", "gu", "mixed"} and q["question"].strip()
        assert q["expected_verdict"] in {"answered", "insufficient_evidence"} and q["validated_by"]


def test_answerable_questions_have_evidence_and_refusals_have_a_reason_code():
    for q in QS:
        if q["expected_verdict"] == "answered":
            assert q["category"] in {"simple", "amended", "superseded"} and q["gold_docs"] and q["key_points"], q["question_id"]
            assert all(d["doc_id"].startswith("GR-") and d["page"] >= 1 for d in q["gold_docs"])
        else:
            assert q["category"] in {"unanswerable", "vague"} and not q["gold_docs"], q["question_id"]
            assert q["expected_reason_code"] in CODES, q["question_id"]
    assert all(q["expected_reason_code"] == "TOO_VAGUE" for q in QS if q["category"] == "vague")


def test_mix_follows_the_brief_where_the_corpus_allows():
    cats, langs = Counter(q["category"] for q in QS), Counter(q["language"] for q in QS)
    n = len(QS)
    assert cats["simple"] / n >= 0.35 and cats["amended"] / n >= 0.15 and cats["unanswerable"] / n >= 0.15 and cats["vague"] / n >= 0.08
    assert all(langs[l] / n >= 0.2 for l in ("en", "gu", "mixed"))   # the brief asks for about a third each
    assert cats["superseded"] == 0   # no superseded document exists in the demo corpus; revisit when one does


def test_status_expectations_use_contract_values():
    for q in QS:
        assert set(q.get("expected_status_any", [])) <= {"amended", "superseded", "no_later_amendment_found", "unknown"}


def test_questions_are_not_officer_validated_and_say_so():
    assert all("not officer-validated" in q["validated_by"] for q in QS)
