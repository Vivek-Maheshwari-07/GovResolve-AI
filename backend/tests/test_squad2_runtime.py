"""The lineage adapter and lazy engine that plug Squad 2's pipeline into the app (roadmap 2.1, 2.2). Needs squad2 modules."""
from types import SimpleNamespace as NS

import pytest

pytest.importorskip("backend.models")
from backend.models import ClauseStatus  # noqa: E402

from app.engine import EngineResult  # noqa: E402
from app.graph import LineageGraph  # noqa: E402
from app.seed import load_demo  # noqa: E402
from app.squad2_runtime import LazySquad2Engine, OurLineageAdapter  # noqa: E402


def adapter(edges=()):
    g = LineageGraph()
    load_demo(g)
    return OurLineageAdapter(g, lambda: list(edges))


def test_statuses_come_from_our_graph_and_never_invent_a_current_one():
    a = adapter()
    assert a.get_clause_status("demo-2018-045") is ClauseStatus.SUPERSEDED
    assert a.get_clause_status("demo-2014-001") is ClauseStatus.AMENDED
    assert a.get_clause_status("demo-2021-130") is ClauseStatus.ACTIVE  # internal "no later change found"; relabelled in the prompt
    assert a.get_clause_status("not-in-corpus") is ClauseStatus.UNKNOWN


def test_latest_version_is_the_newest_document_that_changes_it():
    a = adapter()
    assert a.get_latest_version("demo-2018-045") == "demo-2021-130"
    assert a.get_latest_version("demo-2021-130") == "demo-2021-130"
    assert a.get_latest_version("not-in-corpus") == "not-in-corpus"


def test_evidence_chunks_are_those_where_the_newer_gr_cites_the_older():
    edges = [NS(source_gr="n", target_gr="o", evidence_chunk_id="n:7"), NS(source_gr="n", target_gr="o", evidence_chunk_id=None),
             NS(source_gr="n", target_gr="x", evidence_chunk_id="n:2")]
    assert adapter(edges).evidence_chunk_ids("o", "n") == ["n:7"]


def test_lazy_engine_waits_for_startup_and_reports_a_failed_build_without_caching_it(tmp_path):
    state = {"gov": None}
    eng = LazySquad2Engine(lambda: state["gov"], LineageGraph(), tmp_path)
    assert "still starting" in eng.answer("q", "en").insufficient_reason
    state["gov"] = NS(corpus=NS(grs=None), lineage=None)  # unusable state -> build fails
    out = eng.answer("q", "en")
    assert out.answer is None and "unavailable" in out.insufficient_reason and eng._engine is None
    assert isinstance(out, EngineResult)
