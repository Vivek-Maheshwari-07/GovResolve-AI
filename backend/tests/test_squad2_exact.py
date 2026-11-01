"""Exact GR-number / date lookup in Squad 2's index (roadmap 2.3, spec AI-8). Needs the squad2 modules (integration branch)."""
import json

import pytest

pytest.importorskip("backend.rag.search_engine")
from backend.rag.search_engine import MAX_DATE_PULL, GRIndex, dates_in, norm_ref  # noqa: E402


def doc(gid, number, issued, n=3):
    return [{"chunk_id": f"{gid}:{i}", "gr_id": gid, "gr_number": number, "issue_date": issued, "text": f"{gid} text {i}",
             "pages": [1], "clause_status": "Unknown", "ocr_conf": 1.0} for i in range(n)]


def index(*docs):
    idx = GRIndex.__new__(GRIndex)  # skip Chroma: only the BM25 corpus is used
    idx.bm25_docs = [c for d in docs for c in d]
    return idx


def hit(gid, i=0):
    return {"chunk_id": f"{gid}:{i}", "text": "x", "rrf_score": 0.1, "metadata": {"gr_id": gid}}


def test_numbers_compare_by_letters_and_digits_only():
    assert norm_ref("MLS/1363 /5421-C") == norm_ref("mls-1363-5421-c") == "mls13635421c"
    assert norm_ref("પીઆરઓ.-૧૦૮૬-૫૦૬૮-ગ-૨") == norm_ref("પીઆરઓ 1086 5068 ગ 2")


def test_dates_in_several_notations_and_impossible_dates_dropped():
    assert dates_in("22/07/1963, 6-2-1963 and 22nd July 1963, ૦૬/૦૨/૧૯૬૩") == {"1963-07-22", "1963-02-06"}
    assert dates_in("31/02/1963 and 5.13.1990") == set()


def test_number_in_question_is_found_even_in_other_notation():
    idx = index(doc("a", "MLS/1363/5421-C", "1963-07-22"), doc("b", "AIS/1098/5302/G", "1998-11-14"))
    assert idx.exact_gr_ids("What does GR no. mls 1363 5421 c say?") == ({"a"}, set())


def test_short_or_numberless_references_never_match():
    idx = index(doc("a", "G-2", "1963-07-22"), doc("b", "Endorsement", "1998-11-14"))
    assert idx.exact_gr_ids("what is g-2 endorsement?") == (set(), set())


def test_named_gr_is_pulled_in_when_search_missed_it_and_goes_first():
    idx = index(doc("a", "MLS/1363/5421-C", "1963-07-22"), doc("other", "X", "2000-01-01"))
    ranked = [hit("other", i) for i in range(5)]
    out = idx.prioritize_exact("GR MLS/1363/5421-C", ranked, top_k=5)
    assert [c["metadata"]["gr_id"] for c in out][:2] == ["a", "a"] and len(out) == 5
    assert json.loads(out[0]["metadata"]["pages"]) == [1]


def test_found_chunks_of_the_named_gr_are_moved_up_and_capped():
    idx = index(doc("a", "MLS/1363/5421-C", "1963-07-22"))
    ranked = [hit("o", 0), hit("a", 1), hit("a", 2), hit("a", 0), hit("a", 3), hit("o", 1)]
    out = [c["chunk_id"] for c in idx.prioritize_exact("MLS/1363/5421-C", ranked, top_k=6)]
    assert out == ["a:1", "a:2", "a:0", "o:0", "a:3", "o:1"]


def test_date_pulls_a_quiet_day_but_only_reorders_a_busy_one():
    quiet = index(doc("a", "N1", "1996-11-01"), doc("o", "N2", "2000-01-01"))
    assert quiet.prioritize_exact("resolution dated 01/11/1996", [hit("o")], 3)[0]["metadata"]["gr_id"] == "a"
    busy = index(*[doc(f"d{i}", f"N{i}", "1996-11-01") for i in range(MAX_DATE_PULL + 1)], doc("o", "N", "2000-01-01"))
    out = busy.prioritize_exact("dated 01/11/1996", [hit("o"), hit("d0")], 5)
    assert [c["metadata"]["gr_id"] for c in out] == ["d0", "o"]  # nothing pulled in, d0 moved up


def test_no_number_or_date_leaves_ranking_untouched():
    idx = index(doc("a", "MLS/1363/5421-C", "1963-07-22"))
    ranked = [hit("o", 0), hit("a", 0)]
    assert idx.prioritize_exact("how many days of casual leave?", ranked, 5) is ranked


def test_pulled_gr_brings_its_best_matching_chunks_not_its_first_ones():
    class Scores:
        def get_scores(self, tokens):
            return [0.1, 5.0, 0.0, 3.0]  # aligned with bm25_docs: chunk 1 best, then chunk 3

    idx = index(doc("a", "MLS/1363/5421-C", "1963-07-22", n=4))
    idx.bm25 = Scores()
    out = idx.prioritize_exact("direct recruitment under MLS/1363/5421-C", [hit("o")], top_k=5, per_doc=2)
    assert [c["chunk_id"] for c in out] == ["a:1", "a:3", "o:0"]


def test_matched_grs_are_ordered_by_how_well_they_match_the_question():
    class Scores:
        def get_scores(self, tokens):
            return [0.2, 0.2, 4.0, 1.0]

    idx = index(doc("a", "MLS/1363/5421-C", "1963-07-22", n=2), doc("b", "MLS/1363/5421-C", "1970-01-01", n=2))
    idx.bm25 = Scores()
    out = idx.prioritize_exact("MLS/1363/5421-C", [], top_k=5, per_doc=1)
    assert [c["chunk_id"] for c in out] == ["b:0", "a:0"]
