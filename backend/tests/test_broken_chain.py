"""BROKEN_CHAIN: a cited GR that changes a GR we do not hold (roadmap 2.6, spec reason code)."""
from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.engine import EngineResult
from app.graph import LineageGraph, looks_like_gr_number
from app.main import create_app
from app.schemas import DocumentMeta, Evidence, RawCitation, Relation


class FakeEngine:
    def __init__(self, result):
        self.result = result

    def answer(self, question, language):
        return self.result


def graph_with(*docs, links=()):
    """docs: ids. links: (source, relation, reference as written) pointing at a GR that is not in the corpus."""
    g = LineageGraph()
    for i, d in enumerate(docs):
        g._g.add_node(d, meta=DocumentMeta(doc_id=d, gr_number=f"N/{i}", issue_date=date(2020, 1, 1 + i)))
    for n, (src, rel, ref) in enumerate(links):
        stub = f"ext:{n}"
        g._g.add_node(stub, meta=DocumentMeta(doc_id=stub, gr_number=ref, is_external=True))
        g._g.add_edge(src, stub, key=f"e{n}", relation=rel, evidence=Evidence(page=1, quote="q"), extra_warnings=[])
    return g


def ask(graph, *doc_ids):
    cites = [RawCitation(doc_id=d, page=1, quote="text") for d in doc_ids]
    engine = FakeEngine(EngineResult(answer="An answer.", citations=cites))
    return TestClient(create_app(graph=graph, engine=engine)).post("/query", json={"question": "what?"}).json()


@pytest.mark.parametrize("ref,ok", [("GS/83/45/CH", True), ("US/84/42", True), ("GS-85-23", True), ("૧૨૩/૪૫૬/ગ", True),
                                    ("1991-07-05", False), ("05/07/1991", False), ("નિયમ-9", False), ("Rule 9", False),
                                    ("", False)])
def test_what_counts_as_a_gr_number(ref, ok):
    assert looks_like_gr_number(ref) is ok


def test_broken_links_lists_only_changing_links_to_missing_gr_numbers():
    g = graph_with("a", links=[("a", Relation.AMENDS, "GS/83/45/CH"), ("a", Relation.SUPERSEDES, "US/84/42"),
                               ("a", Relation.REFERS_TO, "XX/11/222"), ("a", Relation.AMENDS, "1991-07-05")])
    assert g.broken_links("a") == [(Relation.AMENDS, "GS/83/45/CH"), (Relation.SUPERSEDES, "US/84/42")]
    assert g.broken_links("nobody") == []


def test_answer_resting_only_on_an_amendment_of_a_missing_gr_is_refused():
    g = graph_with("a", links=[("a", Relation.AMENDS, "GS/83/45/CH")])
    res = ask(g, "a")
    assert res["verdict"] == "insufficient_evidence" and res["answer"] is None and res["citations"] == []
    assert res["reason_code"] == "BROKEN_CHAIN" and "a" in res["reason"]
    assert any(w.startswith("BROKEN_CHAIN: a amends GS/83/45/CH") for w in res["warnings"])


def test_one_complete_document_among_the_citations_keeps_the_answer_with_a_warning():
    g = graph_with("a", "b", links=[("a", Relation.AMENDS, "GS/83/45/CH")])
    res = ask(g, "a", "b")
    assert res["verdict"] == "answered" and res["reason_code"] is None and len(res["citations"]) == 2
    assert any(w.startswith("BROKEN_CHAIN:") for w in res["warnings"])


def test_a_gr_that_supersedes_a_missing_one_still_answers_but_warns():
    g = graph_with("a", links=[("a", Relation.SUPERSEDES, "GS/83/45/CH")])
    res = ask(g, "a")
    assert res["verdict"] == "answered"
    assert any(w.startswith("BROKEN_CHAIN: a supersedes") for w in res["warnings"])


def test_no_broken_link_no_warning():
    res = ask(graph_with("a"), "a")
    assert res["verdict"] == "answered" and not any("BROKEN_CHAIN" in w for w in res["warnings"])
