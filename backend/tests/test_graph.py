from datetime import date

from app.graph import LineageGraph
from app.schemas import DocumentIn, LineageStatus, PageText, Relation
from app.seed import load_demo


def doc(doc_id, gr, d, text, **kw):
    return DocumentIn(
        doc_id=doc_id,
        gr_number=gr,
        issue_date=d,
        pages=[PageText(page=1, text=text)],
        **kw,
    )


def demo_graph() -> LineageGraph:
    g = LineageGraph()
    load_demo(g)
    return g


def test_three_step_chain_statuses():
    g = demo_graph()
    assert g.status_of("demo-2021-130").status is LineageStatus.NO_LATER_AMENDMENT_FOUND
    assert g.status_of("demo-2018-045").status is LineageStatus.SUPERSEDED
    first = g.status_of("demo-2014-001")
    assert first.status is LineageStatus.AMENDED
    assert any("demo-2018-045" in n and "superseded" in n for n in first.notes)


def test_summary_keeps_gr_number_case():
    info = demo_graph().status_of("demo-2014-001")
    assert info.summary == "Amended by DEMO-GAD-2018-045 dated 2018-05-20."


def test_superseded_status_points_to_latest():
    info = demo_graph().status_of("demo-2018-045")
    assert info.latest_doc_ids == ["demo-2021-130"]
    assert info.acted_on_by[0].evidence.page == 1


def test_amendment_evidence_comes_from_amending_page():
    g = demo_graph()
    edge = next(e for e in g.edges() if e.source == "demo-2018-045")
    assert edge.target == "demo-2014-001"
    assert edge.relation is Relation.AMENDS
    assert edge.evidence.page == 2


def test_missing_target_becomes_external_stub():
    g = demo_graph()
    stubs = [m for m in g.list_documents(include_external=True) if m.is_external]
    assert len(stubs) == 1
    assert stubs[0].issue_date == date(2012, 3, 12)
    info = g.status_of(stubs[0].doc_id)
    assert info.status is LineageStatus.SUPERSEDED
    assert any("not in the corpus" in n for n in info.notes)


def test_stub_merges_when_real_document_arrives_later():
    g = LineageGraph()
    g.add_document(doc("new", "N/2", date(2020, 1, 1), "This GR supersedes GR No. OLD/1 dated 01/01/2015."))
    assert any(m.is_external for m in g.list_documents(include_external=True))
    g.add_document(doc("old", "OLD/1", date(2015, 1, 1), "Original order."))
    assert not any(m.is_external for m in g.list_documents(include_external=True))
    assert g.status_of("old").status is LineageStatus.SUPERSEDED
    assert [e.target for e in g.edges()] == ["old"]


def test_unreferenced_document_is_not_declared_current():
    g = LineageGraph()
    g.add_document(doc("a", "A/1", date(2020, 1, 1), "Some order."))
    info = g.status_of("a")
    assert info.status is LineageStatus.NO_LATER_AMENDMENT_FOUND
    assert any("does not prove" in n for n in info.notes)


def test_unknown_document_status():
    assert LineageGraph().status_of("nope").status is LineageStatus.UNKNOWN


def test_date_conflict_edge_is_ignored_for_status():
    g = LineageGraph()
    g.add_document(doc("old", "OLD/1", date(2015, 1, 1), "Order."))
    g.add_document(doc("odd", "ODD/1", date(2010, 1, 1), "This GR supersedes GR No. OLD/1 dated 01/01/2015."))
    info = g.status_of("old")
    assert info.status is LineageStatus.UNKNOWN
    assert any("dated before" in n for n in info.notes)
    edge = g.edges()[0]
    assert any(w.startswith("date_conflict") for w in edge.warnings)


def test_ocr_error_matched_when_dates_agree():
    g = LineageGraph()
    g.add_document(doc("old", "GAD-2014-1234", date(2014, 3, 12), "Order."))
    result = g.add_document(
        doc("new", "GAD-2020-9", date(2020, 1, 1), "This GR supersedes GR No. GAD-2014-1Z34 dated 12/03/2014.")
    )
    assert result.external_stubs_created == []
    assert any("approximately" in w for w in result.warnings)
    assert g.status_of("old").status is LineageStatus.SUPERSEDED


def test_same_gr_number_different_date_is_a_different_document():
    g = LineageGraph()
    g.add_document(doc("a2014", "GAD-1", date(2014, 1, 1), "Order."))
    result = g.add_document(
        doc("new", "GAD-9", date(2020, 1, 1), "This GR supersedes GR No. GAD-1 dated 01/01/2016.")
    )
    assert len(result.external_stubs_created) == 1
    assert g.status_of("a2014").status is LineageStatus.NO_LATER_AMENDMENT_FOUND


def test_self_reference_ignored():
    g = LineageGraph()
    result = g.add_document(doc("a", "A/1", date(2020, 1, 1), "This GR amends GR No. A/1 dated 01/01/2020."))
    assert result.edges_added == []


def test_unresolved_trigger_is_reported():
    g = LineageGraph()
    result = g.add_document(doc("a", "A/1", date(2020, 1, 1), "The above order is hereby cancelled."))
    assert len(result.unresolved) == 1
    assert g.edges() == []


def test_reingest_replaces_outgoing_edges():
    g = LineageGraph()
    g.add_document(doc("old", "OLD/1", date(2015, 1, 1), "Order."))
    g.add_document(doc("new", "N/1", date(2020, 1, 1), "This GR supersedes GR No. OLD/1 dated 01/01/2015."))
    g.add_document(doc("new", "N/1", date(2020, 1, 1), "Corrected text with no references."))
    assert g.status_of("old").status is LineageStatus.NO_LATER_AMENDMENT_FOUND


def test_circular_chain_is_unknown():
    g = LineageGraph()
    g.add_document(doc("a", "A/1", date(2020, 1, 1), "Order."))
    g.add_document(doc("b", "B/1", date(2020, 1, 1), "This GR supersedes GR No. A/1 dated 01/01/2020."))
    g.add_document(doc("a", "A/1", date(2020, 1, 1), "This GR supersedes GR No. B/1 dated 01/01/2020."))
    assert g.status_of("a").status is LineageStatus.UNKNOWN
    assert g.status_of("b").status is LineageStatus.UNKNOWN


def test_lineage_graph_component_and_timeline_order():
    g = demo_graph()
    resp = g.lineage("demo-2014-001")
    assert resp.timeline == ["demo-2014-001", "demo-2018-045", "demo-2021-130"]
    assert {n.meta.doc_id for n in resp.nodes} == set(resp.timeline)
    assert len(resp.edges) == 2
    assert g.lineage("missing") is None


def test_persistence_round_trip(tmp_path):
    g = demo_graph()
    path = tmp_path / "graph.json"
    g.save(path)
    loaded = LineageGraph.load(path)
    assert loaded.status_of("demo-2018-045").status is LineageStatus.SUPERSEDED
    assert loaded.status_of("demo-2014-001").status is LineageStatus.AMENDED
    assert len(loaded.edges()) == len(g.edges())
