def test_health(client):
    r = client.get("/health").json()
    assert r["gr_count"] == 5 and r["edge_count"] == 4 and r["vector_count"] == 6
    assert r["broken_link_count"] == 1 and r["bad_files"] == []


def test_list_grs_and_filters(client):
    assert len(client.get("/grs").json()) == 5
    assert [g["gr_id"] for g in client.get("/grs", params={"status": "SUPERSEDED"}).json()] == ["GAD-2014-07"]
    assert len(client.get("/grs", params={"department": "Finance Department"}).json()) == 2


def test_get_gr(client):
    assert client.get("/grs/GAD-2019-22").json()["status"] == "ACTIVE"
    r = client.get("/grs/NOPE")
    assert r.status_code == 404 and "reason" in r.json()


def test_pdf_and_pages(client):
    assert client.get("/grs/GAD-2019-22/pdf").status_code == 404  # no PDF bundled in fixtures
    assert client.get("/grs/GAD-2019-22/pages/1").json()["blocks"]
    assert client.get("/grs/GAD-2019-22/pages/9").status_code == 404


def test_three_step_chain_timeline(client):
    t = client.get("/grs/GAD-2010-01/lineage").json()
    assert [n["gr_id"] for n in t["nodes"]] == ["GAD-2010-01", "GAD-2014-07", "GAD-2019-22"]
    assert {e["edge_id"] for e in t["edges"]} == {"e1", "e2"}
    assert client.get("/grs/NOPE/lineage").status_code == 404
    assert client.get("/grs/GAD-2010-01/lineage", params={"hops": 99}).status_code == 422


def test_partial_amendment_only_marks_its_clause(client):
    assert client.get("/clauses/GAD-2010-01:1/status").json()["status"] == "AMENDED"
    assert client.get("/clauses/GAD-2010-01:2/status").json()["status"] == "ACTIVE"


def test_superseded_points_to_latest(client):
    s = client.get("/clauses/GAD-2014-07:1/status").json()
    assert s["status"] == "SUPERSEDED" and s["answer_status"] == "FOUND_SUPERSEDED"
    assert s["latest_gr_ids"] == ["GAD-2019-22"]


def test_probable_edge_never_supersedes(client):
    s = client.get("/clauses/FIN-2018-03:1/status").json()
    assert s["status"] == "AMENDED" and s["reason_code"] == "PROBABLE_ONLY"


def test_unknown_clause_404(client):
    assert client.get("/clauses/zzz/status").status_code == 404


def test_annotate(client):
    r = client.post("/lineage/annotate", json={"chunk_ids": ["GAD-2014-07:1", "GAD-2019-22:1"]}).json()
    assert [x["status"] for x in r] == ["SUPERSEDED", "ACTIVE"]
    assert client.post("/lineage/annotate", json={"chunk_ids": ["bad"]}).status_code == 404
    assert client.post("/lineage/annotate", json={}).status_code == 422


def test_broken_links(client):
    b = client.get("/lineage/broken").json()
    assert len(b) == 1 and b[0]["target_ref_text"] == "FIN/2015/99"


def test_as_of(client):
    r = client.get("/lineage/as-of", params={"gr_id": "GAD-2014-07", "date": "2016-01-01"}).json()
    assert r["chunk_ids"] == ["GAD-2014-07:1"]
    r = client.get("/lineage/as-of", params={"gr_id": "GAD-2014-07", "date": "2020-01-01"}).json()
    assert r["chunk_ids"] == []
    assert client.get("/lineage/as-of", params={"gr_id": "NOPE", "date": "2020-01-01"}).status_code == 404


def test_ask_attaches_lineage_and_logs(client):
    r = client.post("/ask", json={"question": "what is the daily allowance on tour"}).json()
    assert r["citations"] and all(c["lineage"] for c in r["citations"])
    assert r["answer_status"] in {"FOUND_SUPERSEDED", "FOUND_AMENDED"}  # worst citation wins
    assert client.get("/logs").json()[0]["query_id"] == r["query_id"]


def test_ask_refuses_without_evidence(client):
    r = client.post("/ask", json={"question": "zzqqxx"}).json()
    assert r["answer_status"] == "INSUFFICIENT_EVIDENCE" and r["refusal_reason"]
    assert client.post("/ask", json={"question": ""}).status_code == 422


def test_feedback(client):
    q = client.post("/ask", json={"question": "medical reimbursement ceiling"}).json()["query_id"]
    assert client.post("/feedback", json={"query_id": q, "verdict": "up"}).json() == {"ok": True}
    assert client.post("/feedback", json={"query_id": "nope", "verdict": "up"}).status_code == 404


def test_overrides_survive_rebuild(client):
    edge = {"edge_id": "m1", "source_gr": "FIN-2021-09", "target_gr": "FIN-2018-03", "rel_type": "SUPERSEDES",
            "confidence": "EXPLICIT", "scope": "WHOLE"}
    assert client.post("/admin/edges/overrides", json={"added": [edge], "author": "vivek"}).status_code == 200
    assert client.get("/clauses/FIN-2018-03:1/status").json()["status"] == "SUPERSEDED"
    client.post("/admin/rebuild")
    assert client.get("/clauses/FIN-2018-03:1/status").json()["status"] == "SUPERSEDED"
    assert client.delete("/admin/edges/overrides/m1").status_code == 200
    assert client.get("/clauses/FIN-2018-03:1/status").json()["status"] == "AMENDED"
    assert client.delete("/admin/edges/overrides/m1").status_code == 404


def test_removed_edge_override(client):
    client.post("/admin/edges/overrides", json={"removed": ["e2"], "author": "vivek"})
    assert client.get("/clauses/GAD-2014-07:1/status").json()["status"] == "ACTIVE"
