"""Scorecard helpers: matching, retrieval, citation, refusal and chain metrics."""
from types import SimpleNamespace as NS

from scripts.scorecard import (chain_scores, citation_checks, key_point_hits, norm, ranked_docs, refusal_outcome,
                               retrieval_hit, status_ok, summarise)


def test_norm_makes_gujarati_digits_punctuation_and_spacing_comparable():
    assert norm("૨૦ વર્ષ, 40 Years.") == norm("20 વર્ષ 40 years")
    assert norm("30th June, 2013") == "30thjune2013"


def test_key_points_accept_alternatives_and_gujarati_digits():
    answer = "ઉંમર ૨૦ થી ૪૦ વર્ષ, Vodafone ની ઓફર"
    assert key_point_hits(answer, ["20", ["40 વર્ષ", "40 years"], ["વોડાફોન", "Vodafone"], "ten"]) == [True, True, True, False]
    assert key_point_hits("", ["x"]) == [False] and key_point_hits("anything", []) == []


def test_retrieval_ranks_documents_by_first_appearance():
    chunks = [{"metadata": {"gr_id": g}} for g in ("a", "a", "b", "c", "b")]
    ranked = ranked_docs(chunks)
    assert ranked == ["a", "b", "c"]
    assert retrieval_hit(ranked, {"a"}, 1) and not retrieval_hit(ranked, {"b"}, 1) and retrieval_hit(ranked, {"c"}, 3)
    assert not retrieval_hit([], {"a"}, 3)


def test_citations_on_gold_page_and_verbatim():
    pages = {("d1", 1): "The leave shall be admissible for 180 days.", ("d2", 2): "other text"}
    cites = [{"doc_id": "d1", "page": 1, "quote": "shall be admissible for 180  days"},   # whitespace differs: still verbatim
             {"doc_id": "d2", "page": 2, "quote": "text that is not on the page"}]
    got = citation_checks(cites, {("d1", 1)}, lambda d, p: pages.get((d, p), ""))
    assert got == (2, 1, 1)


def test_refusal_outcomes():
    refuse_q = {"expected_verdict": "insufficient_evidence", "expected_reason_code": "OUT_OF_SCOPE"}
    answer_q = {"expected_verdict": "answered"}
    assert refusal_outcome(refuse_q, {"verdict": "insufficient_evidence", "reason_code": "OUT_OF_SCOPE"}) == \
        {"refused": True, "correct": True, "code_ok": True}
    assert refusal_outcome(refuse_q, {"verdict": "insufficient_evidence", "reason_code": "NO_DOCUMENT"})["code_ok"] is False
    assert refusal_outcome(refuse_q, {"verdict": "answered"}) == {"refused": False, "correct": False, "code_ok": False}
    assert refusal_outcome(answer_q, {"verdict": "insufficient_evidence", "reason_code": "NO_DOCUMENT"})["correct"] is False


def test_status_check_only_when_expected():
    resp = {"citations": [{"lineage": {"status": "amended"}}, {"lineage": {"status": "unknown"}}]}
    assert status_ok({}, resp) is None
    assert status_ok({"expected_status_any": ["amended", "superseded"]}, resp) is True
    assert status_ok({"expected_status_any": ["superseded"]}, resp) is False


def test_chain_scores_count_only_edges_touching_gold_documents():
    rows = [{"source_gr": "a1", "target_gr": "base"}, {"source_gr": "a2", "target_gr": "base"}]
    edge = lambda s, t, r="AMENDS": NS(source_gr=s, target_gr=t, rel_type=NS(value=r))   # noqa: E731
    edges = [edge("a1", "base"), edge("a3", "base"), edge("x", "y"), edge("a2", "base", "REFERS"), edge("z", None)]
    out = chain_scores(edges, rows)
    assert (out["true_positive"], out["detected_touching_gold_docs"], out["edges_outside_gold"]) == (1, 2, 1)
    assert out["precision"] == 0.5 and out["recall"] == 0.5


def test_summary_rates_for_both_modes():
    rows = [{"id": "1", "category": "simple", "language": "en", "top1": True, "top3": True},
            {"id": "2", "category": "simple", "language": "gu", "top1": False, "top3": True},
            {"id": "3", "category": "vague", "language": "en"}]
    s = summarise(rows, None, "retrieval")
    assert s["1_retrieval"]["top1"] == 0.5 and s["1_retrieval"]["top3"] == 1.0 and s["by_category"] == {"simple": 2, "vague": 1}
    full = [{"id": "1", "category": "simple", "language": "en", "seconds": 30.0, "refusal_refused": True, "refusal_correct": False,
             "refusal_code_ok": False, "top1": True, "top3": True, "citations": 2, "citations_on_gold_page": 1, "citations_verbatim": 2,
             "points": 2, "points_hit": 1, "all_points": False},
            {"id": "2", "category": "unanswerable", "language": "gu", "seconds": 10.0, "refusal_refused": True,
             "refusal_correct": True, "refusal_code_ok": True}]
    f = summarise(full, None, "full")
    assert f["2_citations"]["on_gold_page"] == 0.5 and f["2_citations"]["quote_verbatim"] == 1.0
    assert f["3_answers"] == {"answered_with_key_points": 1, "all_points_rate": 0.0, "mean_point_coverage": 0.5}
    assert f["5_refusals"]["correctly_refused"] == 1.0 and f["5_refusals"]["wrongly_refused"] == 1.0


def test_key_points_accept_the_same_date_in_another_order_or_format():
    assert key_point_hits("The tariff applied from October 1, 2015.", [["1st October, 2015"]]) == [True]
    assert key_point_hits("in force on October 1, 2006", ["October, 2006"]) == [True]
    assert key_point_hits("૩૦ જૂન ૨૦૦૮ સુધી", [["30th June, 2008", "30 જૂન 2008"]]) == [True]
    # a different day or year is not the same date; one word alone is only matched as written
    assert key_point_hits("applied from October 2, 2015", ["1st October, 2015"]) == [False]
    assert key_point_hits("replaced 31st March, 2007 with 31st December, 2007", ["30th June, 2008"]) == [False]
    assert key_point_hits("the Vodafone offer", ["Vodafone West Limited"]) == [False]


def test_rescore_recomputes_answer_points_only(tmp_path):
    import json

    from scripts.scorecard import rescore
    gold = [{"question_id": "Q-1", "key_points": [["1st October, 2015"]]}]
    saved = {"summary": {"mode": "full", "3_answers": {"all_points_rate": 0.0}, "4_chain": {"precision": 1.0}},
             "questions": [{"id": "Q-1", "category": "simple", "language": "en", "verdict": "answered", "answer": "from October 1, 2015",
                            "points": 1, "points_hit": 0, "all_points": False, "top1": True, "top3": True, "citations": 1,
                            "citations_on_gold_page": 1, "citations_verbatim": 1, "refusal_refused": False, "refusal_correct": True,
                            "refusal_code_ok": True, "seconds": 5.0}]}
    (tmp_path / "s.json").write_text(json.dumps(saved), encoding="utf-8")
    (tmp_path / "g.json").write_text(json.dumps(gold), encoding="utf-8")
    assert rescore(tmp_path / "s.json", tmp_path / "g.json", tmp_path / "o.json") == 0
    out = json.loads((tmp_path / "o.json").read_text(encoding="utf-8"))
    assert out["summary"]["3_answers"]["all_points_rate"] == 1.0 and out["summary"]["4_chain"] == {"precision": 1.0}
