"""The held-out question set must stay separate from the gold (dev) set and keep the same shape."""
import json
from pathlib import Path

EVAL = Path(__file__).resolve().parents[2] / "data" / "eval"


def _load(name):
    return json.loads((EVAL / name).read_text(encoding="utf-8"))


def test_heldout_uses_no_gold_document():
    gold_docs = {d["doc_id"] for q in _load("gold_questions.json") for d in q["gold_docs"]}
    held_docs = {d["doc_id"] for q in _load("heldout_questions.json") for d in q["gold_docs"]}
    assert held_docs and not (held_docs & gold_docs)


def test_heldout_ids_and_questions_are_new():
    gold = _load("gold_questions.json")
    held = _load("heldout_questions.json")
    ids = [q["question_id"] for q in held]
    assert len(ids) == len(set(ids)) and all(i.startswith("H-") for i in ids)
    assert not ({q["question"] for q in held} & {q["question"] for q in gold})


def test_heldout_shape():
    held = _load("heldout_questions.json")
    assert {q["language"] for q in held} == {"en", "gu", "mixed"}
    for q in held:
        if q["expected_verdict"] == "answered":
            assert q["gold_docs"] and q["key_points"]
        else:
            assert q["expected_reason_code"] and not q["gold_docs"]
        assert "not officer-validated" in q["validated_by"]
