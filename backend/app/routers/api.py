from datetime import date

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import FileResponse

from ..schemas import (
    AnnotateRequest, AskRequest, AskResponse, ChunkLineage, EdgeOverrideIn, FeedbackIn, GRRecord, GRSummary,
    LineageEdge,
)
from ..services.ask import run_ask

router = APIRouter()


def S(request: Request):
    return request.app.state.gov


def _gr_or_404(st, gr_id: str) -> GRRecord:
    rec = st.corpus.get(gr_id)
    if rec is None:
        raise HTTPException(404, f"Unknown GR '{gr_id}'")
    return rec


@router.get("/health")
def health(request: Request):
    st = S(request)
    return {
        "status": "ok", "version": st.settings.version, "gr_count": len(st.corpus.grs),
        "chunk_count": len(st.corpus.all_chunks()), "edge_count": len(st.lineage.edges()),
        "broken_link_count": len(st.lineage.broken_links()), "cycles": st.lineage.cycles(),
        "lineage_engine": st.lineage_kind, "vector_count": st.vectors.count(),
        "bad_files": st.corpus.errors, "build_ms": st.build_ms,
    }


@router.get("/grs", response_model=list[GRSummary])
def list_grs(request: Request, department: str | None = None, year: int | None = None,
             status: str | None = None, q: str | None = None):
    st = S(request)
    out = []
    for g in st.corpus.grs.values():
        if department and (g.department or "").lower() != department.lower():
            continue
        if year and (g.issue_date is None or g.issue_date.year != year):
            continue
        if q and q.lower() not in (g.subject or "").lower():
            continue
        gs = st.lineage.gr_status(g.gr_id).value
        if status and gs != status.upper():
            continue
        out.append(GRSummary(gr_id=g.gr_id, gr_number=g.gr_number, department=g.department,
                             issue_date=g.issue_date, subject=g.subject, language=g.language, status=gs))
    return out


@router.get("/grs/{gr_id}")
def get_gr(gr_id: str, request: Request):
    st = S(request)
    rec = _gr_or_404(st, gr_id)
    return {**rec.model_dump(mode="json"), "status": st.lineage.gr_status(gr_id).value}


@router.get("/grs/{gr_id}/pdf")
def get_pdf(gr_id: str, request: Request):
    st = S(request)
    rec = _gr_or_404(st, gr_id)
    path = (st.settings.pdf_dir / rec.source_pdf) if rec.source_pdf else None
    if path is None or not path.is_file():
        raise HTTPException(404, f"PDF for '{gr_id}' is not available")
    return FileResponse(path, media_type="application/pdf")


@router.get("/grs/{gr_id}/pages/{n}")
def get_page(gr_id: str, n: int, request: Request):
    rec = _gr_or_404(S(request), gr_id)
    if n < 1 or n > rec.page_count:
        raise HTTPException(404, f"GR '{gr_id}' has no page {n}")
    return {"gr_id": gr_id, "page": n,
            "blocks": [c.model_dump(mode="json") for c in rec.chunks if c.page == n]}


@router.get("/grs/{gr_id}/lineage")
def gr_lineage(gr_id: str, request: Request, hops: int = Query(5, ge=1, le=10)):
    st = S(request)
    _gr_or_404(st, gr_id)
    return st.lineage.timeline(gr_id, hops)


@router.get("/clauses/{chunk_id}/status", response_model=ChunkLineage)
def clause_status(chunk_id: str, request: Request):
    try:
        return S(request).lineage.chunk_status(chunk_id)
    except KeyError:
        raise HTTPException(404, f"Unknown chunk '{chunk_id}'")


@router.post("/lineage/annotate", response_model=list[ChunkLineage])
def annotate(body: AnnotateRequest, request: Request):
    st = S(request)
    try:
        return [st.lineage.chunk_status(c) for c in body.chunk_ids]
    except KeyError as exc:
        raise HTTPException(404, f"Unknown chunk {exc}")


@router.get("/lineage/as-of")
def as_of(request: Request, gr_id: str, date_: date = Query(..., alias="date")):
    st = S(request)
    _gr_or_404(st, gr_id)
    return {"gr_id": gr_id, "date": date_, "chunk_ids": st.lineage.as_of(gr_id, date_)}


@router.get("/lineage/broken", response_model=list[LineageEdge])
def broken(request: Request):
    return S(request).lineage.broken_links()


@router.post("/ask", response_model=AskResponse)
def ask(body: AskRequest, request: Request):
    st = S(request)
    return run_ask(body, store=st.vectors, lineage=st.lineage, corpus=st.corpus, db=st.db)


@router.post("/feedback")
def feedback(body: FeedbackIn, request: Request):
    st = S(request)
    if st.db.get_log(body.query_id) is None:
        raise HTTPException(404, f"Unknown query_id '{body.query_id}'")
    st.db.add_feedback(body.query_id, body.verdict, body.note)
    return {"ok": True}


@router.get("/logs")
def logs(request: Request, limit: int = Query(20, ge=1, le=500)):
    return S(request).db.recent_logs(limit)


@router.post("/admin/rebuild")
def rebuild(request: Request):
    st = S(request)
    st.rebuild()
    return {"ok": True, "gr_count": len(st.corpus.grs), "edge_count": len(st.lineage.edges()), "build_ms": st.build_ms}


@router.get("/admin/edges/overrides")
def list_overrides(request: Request):
    return S(request).db.list_overrides()


@router.post("/admin/edges/overrides")
def add_overrides(body: EdgeOverrideIn, request: Request):
    st = S(request)
    for e in body.added:
        st.db.add_override(e, body.author, body.note)
    for edge_id in body.removed:
        st.db.remove_override(edge_id, body.author, body.note)
    st.reapply_overrides()
    return {"ok": True, "edge_count": len(st.lineage.edges())}


@router.delete("/admin/edges/overrides/{edge_id}")
def delete_override(edge_id: str, request: Request):
    st = S(request)
    if not st.db.delete_override(edge_id):
        raise HTTPException(404, f"No override for edge '{edge_id}'")
    st.reapply_overrides()
    return {"ok": True}
