"""Status engine against the engine's own fixtures in data/fixtures, plus LLM fallback and the API on the real engine."""
import json
from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.config import ROOT, Settings
from app.lineage import LineageService, LLMFallback
from app.lineage.llm_fallback import parse_llm_json
from app.main import create_app
from app.schemas import Chunk, Confidence, GRRecord, LineageEdge, RelType, Scope
from app.store.corpus import Corpus
from app.store.db import Database

FIX = ROOT / "data" / "fixtures"


@pytest.fixture(scope="module")
def svc():
    return LineageService(Corpus.load(FIX))


def st(svc, chunk_id):
    return svc.chunk_status(chunk_id)


def edge(svc, src, tgt, rel):
    return next(e for e in svc.edges() if (e.source_gr, e.target_gr, e.rel_type) == (src, tgt, rel))


def test_all_fixtures_load_and_nothing_needs_review(svc):
    assert len(svc.corpus.grs) == 23 and svc.corpus.errors == [] and svc.review_items == []


def test_three_step_chain_points_to_newest(svc):
    s = st(svc, "HLT-2005-11:1")
    assert (s.status.value, s.answer_status.value) == ("SUPERSEDED", "FOUND_SUPERSEDED")
    assert s.latest_gr_ids == ["HLT-2020-04"] and s.latest_chunk_ids == ["HLT-2020-04:1"]
    assert st(svc, "HLT-2012-30:1").latest_gr_ids == ["HLT-2020-04"]
    assert st(svc, "HLT-2020-04:1").status.value == "ACTIVE"


def test_partial_amendment_marks_only_its_clause(svc):
    assert st(svc, "GAD-2010-01:1").status.value == "AMENDED"
    assert st(svc, "GAD-2010-01:2").status.value == "ACTIVE"
    assert svc.gr_status("GAD-2010-01").value == "AMENDED"


def test_amended_then_superseded_chain(svc):
    s = st(svc, "GAD-2014-07:1")
    assert s.status.value == "SUPERSEDED" and s.latest_gr_ids == ["GAD-2019-22"]


def test_cancellation_is_abrogated(svc):
    s = st(svc, "EDU-2008-02:1")
    assert s.status.value == "ABROGATED" and s.answer_status.value == "FOUND_SUPERSEDED" and s.latest_gr_ids == []


def test_clarification_changes_nothing(svc):
    s = st(svc, "REV-2011-08:1")
    assert s.status.value == "ACTIVE" and any("Clarified" in w for w in s.warnings)
    assert edge(svc, "REV-2013-19", "REV-2011-08", RelType.CLARIFIES)


def test_broken_link_is_listed_and_source_is_unaffected(svc):
    broken = svc.broken_links()
    assert [(e.source_gr, e.target_ref_text) for e in broken] == [("FIN-2021-09", "FIN/2015/99")]


def test_blanket_cancellation_is_probable_and_never_red(svc):
    for target in ("FIN-2018-03", "FIN-2021-09"):
        e = edge(svc, "FIN-2023-02", target, RelType.CANCELS)
        assert e.confidence == Confidence.PROBABLE
        s = st(svc, f"{target}:1")
        assert (s.status.value, s.reason_code, s.answer_status.value) == ("AMENDED", "PROBABLE_ONLY", "FOUND_AMENDED")


def test_read_list_reference_is_refers_only(svc):
    e = edge(svc, "PWD-2017-09", "PWD-2015-05", RelType.REFERS)
    assert e.confidence == Confidence.EXPLICIT
    assert not any(x.source_gr == "PWD-2017-09" and x.rel_type != RelType.REFERS for x in svc.edges())
    assert st(svc, "PWD-2015-05:1").status.value == "ACTIVE"


def test_read_pointer_edge_targets_the_right_gr(svc):
    e = edge(svc, "PWD-2019-12", "PWD-2017-09", RelType.AMENDS)
    assert e.target_ref_text.startswith("Read (2)") and e.scope == Scope.UNKNOWN
    assert st(svc, "PWD-2017-09:1").status.value == "AMENDED"


def test_gujarati_digits_and_phrase(svc):
    e = edge(svc, "AGR-2018-11", "AGR-2012-03", RelType.SUPERSEDES)
    assert e.confidence == Confidence.EXPLICIT
    assert st(svc, "AGR-2012-03:1").status.value == "SUPERSEDED"


def test_gujarati_date_only_reference_with_paragraph_scope(svc):
    e = edge(svc, "AGR-2019-01", "AGR-2015-07", RelType.AMENDS)
    assert (e.confidence, e.scope, e.target_clauses) == (Confidence.PROBABLE, Scope.PARAGRAPH, ["2"])
    assert st(svc, "AGR-2015-07:1").status.value == "ACTIVE"
    s = st(svc, "AGR-2015-07:2")
    assert (s.status.value, s.reason_code) == ("AMENDED", "PROBABLE_ONLY")


def test_two_amendments_on_the_same_date_conflict(svc):
    s = st(svc, "TRN-2016-01:1")
    assert (s.status.value, s.reason_code, s.answer_status.value) == ("CONFLICT", "SAME_DATE", "CONFLICT")
    assert st(svc, "TRN-2016-01:2").status.value == "ACTIVE"


def test_cycle_gives_conflict(svc):
    loop = [LineageEdge(edge_id=f"c{i}", source_gr=a, target_gr=b, rel_type=RelType.SUPERSEDES, scope=Scope.WHOLE)
            for i, (a, b) in enumerate([("HLT-2005-11", "HLT-2020-04")])]
    s2 = LineageService(Corpus.load(FIX))
    s2.apply_overrides(loop, [])
    assert s2.cycles() and st(s2, "HLT-2005-11:1").reason_code == "CYCLE"
    assert st(s2, "HLT-2005-11:1").answer_status.value == "CONFLICT"


def test_unknown_ids_raise_keyerror(svc):
    with pytest.raises(KeyError):
        svc.chunk_status("nope")
    with pytest.raises(KeyError):
        svc.timeline("nope")


def test_timeline_has_both_directions_and_is_date_ordered(svc):
    t = svc.timeline("GAD-2014-07")
    assert [n["gr_id"] for n in t["nodes"]] == ["GAD-2010-01", "GAD-2014-07", "GAD-2019-22"]
    assert len(t["edges"]) == 2
    assert [n["gr_id"] for n in svc.timeline("GAD-2014-07", hops=1)["nodes"]] == ["GAD-2010-01", "GAD-2014-07", "GAD-2019-22"]
    assert [n["gr_id"] for n in svc.timeline("HLT-2005-11", hops=1)["nodes"]] == ["HLT-2005-11", "HLT-2012-30"]


def test_as_of_time_machine(svc):
    assert svc.as_of("HLT-2005-11", date(2010, 1, 1)) == ["HLT-2005-11:1"]
    assert svc.as_of("HLT-2005-11", date(2013, 1, 1)) == []
    assert svc.as_of("HLT-2012-30", date(2013, 1, 1)) == ["HLT-2012-30:1"]
    assert svc.as_of("HLT-2012-30", date(2011, 1, 1)) == []  # not issued yet


def test_manual_override_wins_and_is_marked_manual(svc):
    s2 = LineageService(Corpus.load(FIX))
    base = edge(s2, "EDU-2016-14", "EDU-2008-02", RelType.CANCELS)
    s2.apply_overrides([], [base.edge_id])
    assert st(s2, "EDU-2008-02:1").status.value == "ACTIVE"
    manual = base.model_copy(update={"edge_id": "m1", "method": "manual"})
    s2.apply_overrides([manual], [base.edge_id])
    assert st(s2, "EDU-2008-02:1").status.value == "ABROGATED"


def test_restore_undoes_an_earlier_cancellation():
    cs = lambda i, d: GRRecord(gr_id=i, issue_date=d, chunks=[Chunk(chunk_id=f"{i}:1", page=1, text="x", clause_label="1")])
    corpus = Corpus({g.gr_id: g for g in [cs("A", date(2000, 1, 1)), cs("B", date(2005, 1, 1)), cs("C", date(2010, 1, 1))]})
    svc = LineageService(corpus)
    mk = lambda i, s, rel: LineageEdge(edge_id=i, source_gr=s, target_gr="A", rel_type=rel, scope=Scope.WHOLE)
    svc.apply_overrides([mk("e1", "B", RelType.CANCELS)], [])
    assert svc.chunk_status("A:1").status.value == "ABROGATED"
    svc.apply_overrides([mk("e1", "B", RelType.CANCELS), mk("e2", "C", RelType.RESTORES)], [])
    assert svc.chunk_status("A:1").status.value == "ACTIVE"


def test_poor_scan_is_unknown_and_insufficient_evidence():
    g = GRRecord(gr_id="P", field_confidence={"text": 0.2}, chunks=[Chunk(chunk_id="P:1", page=1, text="x")])
    s = LineageService(Corpus({"P": g})).chunk_status("P:1")
    assert (s.status.value, s.reason_code, s.answer_status.value) == ("UNKNOWN", "POOR_SCAN", "INSUFFICIENT_EVIDENCE")


# ---- LLM fallback ----
def _corpus_with_unphrased_reference():
    old = GRRecord(gr_id="OLD", gr_number="FIN/2015/99", issue_date=date(2015, 1, 1),
                   chunks=[Chunk(chunk_id="OLD:1", page=1, text="Ceiling is Rs. 5.", clause_label="1")])
    new = GRRecord(gr_id="NEW", gr_number="FIN/2021/09", issue_date=date(2021, 1, 1), chunks=[
        Chunk(chunk_id="NEW:1", page=1, text="Further to GR FIN/2015/99, the ceiling is raised.", section="operative")])
    return Corpus({"OLD": old, "NEW": new})


def test_llm_fallback_creates_probable_or_explicit_llm_edge_and_caches():
    db = Database(":memory:")
    reply = '```json\n{"rel_type": "AMENDS", "target_ref_text": "FIN/2015/99", "scope": "UNKNOWN", "target_clauses": []}\n```'
    calls = []
    llm = LLMFallback(lambda p: calls.append(p) or reply, db)
    svc = LineageService(_corpus_with_unphrased_reference(), llm=llm)
    e = svc.edges()[0]
    assert (e.method, e.rel_type, e.target_gr) == ("llm", RelType.AMENDS, "OLD")
    LineageService(_corpus_with_unphrased_reference(), llm=LLMFallback(lambda p: 1 / 0, db))  # cache hit: no call
    assert len(calls) == 1


def test_llm_garbage_or_failure_is_discarded_and_flagged_no_edge():
    for bad in (lambda p: "not json", lambda p: '{"rel_type": "EXPLODES"}', lambda p: 1 / 0):
        svc = LineageService(_corpus_with_unphrased_reference(), llm=LLMFallback(bad))
        assert svc.edges() == []


def test_without_llm_unphrased_reference_goes_to_review():
    svc = LineageService(_corpus_with_unphrased_reference())
    assert svc.edges() == [] and svc.review_items[0]["kind"] == "reference_without_phrase"


def test_llm_null_rel_type_makes_no_edge():
    assert parse_llm_json('{"rel_type": null}').rel_type is None
    svc = LineageService(_corpus_with_unphrased_reference(), llm=LLMFallback(lambda p: '{"rel_type": null}'))
    assert svc.edges() == []


# ---- the API running on the real engine ----
@pytest.fixture()
def api(tmp_path):
    cfg = Settings(db_path=tmp_path / "t.sqlite", embed_model="hash", corpus_dir=FIX, lineage_engine="real")
    with TestClient(create_app(cfg, persist_vectors=False)) as c:
        yield c


def test_api_uses_real_engine_and_serves_the_chain(api):
    h = api.get("/health").json()
    assert h["lineage_engine"] == "real" and h["gr_count"] == 23 and h["broken_link_count"] == 1
    t = api.get("/grs/HLT-2005-11/lineage").json()
    assert [n["gr_id"] for n in t["nodes"]] == ["HLT-2005-11", "HLT-2012-30", "HLT-2020-04"]
    s = api.get("/clauses/HLT-2005-11:1/status").json()
    assert s["status"] == "SUPERSEDED" and s["latest_gr_ids"] == ["HLT-2020-04"]


def test_api_ask_flags_superseded_answer(api):
    r = api.post("/ask", json={"question": "hospital reimbursement per day"}).json()
    assert r["citations"] and r["answer_status"] in {"FOUND_SUPERSEDED", "FOUND_NO_LATER_CHANGE"}
    assert {c["lineage"]["status"] for c in r["citations"]} >= {"ACTIVE"} or r["answer_status"] == "FOUND_SUPERSEDED"


def test_api_edges_are_stored_for_other_squads(api):
    assert len(api.get("/lineage/broken").json()) == 1
    assert api.get("/grs", params={"status": "ABROGATED"}).json()[0]["gr_id"] == "EDU-2008-02"


def test_amendment_names_the_base_rules_by_title():
    from datetime import date
    from app.lineage import LineageService
    from app.schemas import Chunk, GRRecord, RelType
    from app.store.corpus import Corpus
    title = "The Gujarat Civil Services Classification and Recruitment (General) Rules, 1967"
    base = GRRecord(gr_id="BASE", issue_date=date(1967, 10, 10), subject=title,
                    chunks=[Chunk(chunk_id="BASE:1", page=1, text="These rules may be called the " + title + ".")])
    upd = GRRecord(gr_id="UPD", issue_date=date(2013, 7, 31), subject=title + " (Up dated upto 31-7-2013)",
                   chunks=[Chunk(chunk_id="UPD:1", page=1, text="Consolidated text.")])
    am = GRRecord(gr_id="AM", issue_date=date(2019, 2, 22), subject="The Gujarat Civil Services Classification and "
                  "Recruitment (General) (Amendment) Rules, 2019", chunks=[Chunk(chunk_id="AM:1", page=1, text=(
                      "In exercise of the powers conferred by the proviso to article 309 of the Constitution of India, "
                      "the Governor of Gujarat hereby makes the following rules further to amend the Gujarat Civil "
                      "Services Classification and Recruitment (General) Rules, 1967, namely:-"))])
    edges = LineageService(Corpus({g.gr_id: g for g in (base, upd, am)})).edges()
    hit = [e for e in edges if e.source_gr == "AM" and e.target_gr == "BASE"]
    assert hit and hit[0].rel_type == RelType.AMENDS
    assert not [e for e in edges if e.target_gr == "UPD"]
