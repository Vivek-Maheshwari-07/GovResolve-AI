from datetime import date, datetime, timedelta, timezone
import html
import json

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from pydantic import BaseModel, Field

from ..config import ROOT
from ..pdf_lookup import find_pdf
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


class ExplainCitation(BaseModel):
    doc_id: str = Field(max_length=200)
    page: int = Field(ge=1, le=5000)


class ExplainIn(BaseModel):
    question: str = Field(default="", max_length=500)
    language: str = Field(default="en", max_length=10)
    citations: list[ExplainCitation] = Field(min_length=1, max_length=6)
    followup: str = Field(default="", max_length=300)   # empty: explain the resolution; else answer this question about it


@router.post("/explain")
def explain_gr(body: ExplainIn, request: Request):
    """A simple-words explanation of one resolution (what it means, steps and documents it names), or an answer to a follow-up question
    about it, written from the resolution's own stored text only (never from text sent by the browser) and checked against it.
    Hosted model only; {"available": false, "reason": ...} when it cannot be produced. See app/explain.py."""
    from ..explain import explain
    st = S(request)
    doc_ids = list(dict.fromkeys(c.doc_id for c in body.citations))
    if len(doc_ids) != 1:
        raise HTTPException(422, "Explain one resolution at a time.")
    rec = _gr_or_404(st, doc_ids[0])
    return explain(rec, [c.page for c in body.citations], body.question, body.language, body.followup.strip())


@router.get("/coverage")
def coverage(request: Request):
    """What the collection covers: totals, date range, languages and topics (with the number of resolutions on each and example
    questions that are known to be answerable). Feeds the "what can I ask?" panel."""
    from backend.rag.topics import compute_coverage
    st = S(request)
    cov = getattr(st, "_coverage", None)
    if cov is None:
        cov = st._coverage = compute_coverage(st.corpus.grs.values())
    return cov


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
        if q:
            ql = q.lower()
            hay = " ".join(filter(None, (g.subject, g.subject_en, g.subject_gu))).lower()
            if ql not in hay:
                continue
        gs = st.lineage.gr_status(g.gr_id).value
        if status and gs != status.upper():
            continue
        out.append(GRSummary(gr_id=g.gr_id, gr_number=g.gr_number, department=g.department,
                             issue_date=g.issue_date, subject=g.subject,
                             subject_en=g.subject_en, subject_gu=g.subject_gu,
                             language=g.language, status=gs))
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
    path = find_pdf(rec.source_pdf, st.settings.pdf_dir, ROOT)
    if path is None:
        raise HTTPException(404, f"PDF for '{gr_id}' is not available")
    return FileResponse(path, media_type="application/pdf", headers={"Content-Disposition": "inline"})


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
    engine = getattr(request.app.state, "engine", None)
    return run_ask(body, store=st.vectors, lineage=st.lineage, corpus=st.corpus, db=st.db, engine=engine)


@router.post("/feedback")
def feedback(body: FeedbackIn, request: Request):
    st = S(request)
    if st.db.get_log(body.query_id) is None:
        raise HTTPException(404, f"Unknown query_id '{body.query_id}'")
    st.db.add_feedback(body.query_id, body.verdict, body.note)
    return {"ok": True}


_IST = timezone(timedelta(hours=5, minutes=30))


def _fmt_ist(iso_str: str) -> str:
    try:
        dt = datetime.fromisoformat(iso_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(_IST).strftime("%d %b %Y, %I:%M:%S %p IST")
    except Exception:
        return iso_str or ""


def render_logs_html(rows: list[dict], limit: int = 20) -> str:
    """Render query/voice logs as a clean, auto-refreshing UTF-8 HTML table."""
    items_html = []
    for r in rows:
        qid = str(r.get("query_id") or "")
        is_voice = qid.startswith("voice_")
        src_badge = '<span class="pill voice">Voice</span>' if is_voice else '<span class="pill web">Web</span>'
        status = str(r.get("answer_status") or "")
        ok = status == "answered"
        status_badge = f'<span class="pill {"ok" if ok else "ref"}">{html.escape(status)}</span>'
        cits = r.get("citations") or []
        cite_labels = []
        for c in cits:
            doc = c.get("doc_id") or c.get("gr_id") or ""
            page = c.get("page")
            if doc:
                cite_labels.append(f"{doc} (p.{page})" if page else doc)
        cite_str = ", ".join(dict.fromkeys(cite_labels)) or "—"
        lat_ms = r.get("latency_ms") or 0
        lat_str = f"{lat_ms / 1000:.2f} s" if lat_ms >= 100 else f"{lat_ms} ms"
        body_text = r.get("answer") or r.get("refusal_reason") or ""
        items_html.append(
            f"<tr>"
            f"<td class='nowrap'><div class='time'>{html.escape(_fmt_ist(str(r.get('created_at') or '')))}</div>"
            f"<div class='meta'>{src_badge} <code>{html.escape(qid)}</code></div></td>"
            f"<td class='nowrap'>{status_badge}<div class='lat'>{html.escape(lat_str)}</div></td>"
            f"<td class='cites'>{html.escape(cite_str)}</td>"
            f"<td class='qa'><div class='q'>{html.escape(str(r.get('question') or ''))}</div>"
            f"<div class='a'>{html.escape(str(body_text))}</div></td>"
            f"</tr>"
        )
    rows_markup = "\n".join(items_html) or "<tr><td colspan='4' class='empty'>No queries logged yet.</td></tr>"
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>GovResolve-AI — Query &amp; Voice Logs</title>
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans Gujarati", sans-serif; background:#f8f7f4; color:#1e293b; margin:0; padding:24px; }}
  .wrap {{ max-width:1200px; margin:0 auto; }}
  header {{ display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px; }}
  h1 {{ font-size:20px; margin:0; }}
  .controls {{ display:flex; gap:10px; align-items:center; font-size:13px; color:#475569; }}
  a.btn {{ background:#fff; border:1px solid #cbd5e1; border-radius:6px; padding:6px 10px; color:#1e293b; text-decoration:none; font-size:12px; }}
  a.btn:hover {{ background:#f1f5f9; }}
  table {{ width:100%; border-collapse:collapse; background:#fff; border:1px solid #e2e8f0; border-radius:10px; overflow:hidden; box-shadow:0 1px 3px rgba(15,23,42,.05); }}
  th {{ text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:.04em; color:#64748b; background:#f1efe9; padding:10px 12px; border-bottom:1px solid #e2e8f0; }}
  td {{ padding:12px; border-bottom:1px solid #f1f5f9; vertical-align:top; font-size:13.5px; line-height:1.45; }}
  tr:last-child td {{ border-bottom:none; }}
  .nowrap {{ white-space:nowrap; }}
  .time {{ font-weight:600; font-size:12.5px; }}
  .meta {{ margin-top:4px; font-size:11.5px; color:#64748b; }}
  .lat {{ margin-top:5px; font-size:11.5px; color:#475569; font-family:ui-monospace,monospace; }}
  .pill {{ display:inline-block; padding:2px 7px; border-radius:999px; font-size:11px; font-weight:600; }}
  .pill.voice {{ background:#eef2ff; color:#3730a3; }}
  .pill.web {{ background:#f1f5f9; color:#334155; }}
  .pill.ok {{ background:#dcfce7; color:#166534; }}
  .pill.ref {{ background:#ffe4e6; color:#9f1239; }}
  .cites {{ font-size:12px; color:#334155; min-width:160px; }}
  .qa .q {{ font-weight:600; color:#0f172a; margin-bottom:4px; }}
  .qa .a {{ color:#334155; }}
  .empty {{ text-align:center; color:#64748b; padding:28px; }}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div>
      <h1>GovResolve-AI — Live Query &amp; Voice Logs</h1>
    </div>
    <div class="controls">
      <label><input type="checkbox" id="auto" checked> Auto-refresh (3s)</label>
      <a class="btn" href="/logs?format=json&amp;limit={limit}">Raw JSON</a>
      <a class="btn" href="/">Open App</a>
    </div>
  </header>
  <table>
    <thead><tr><th>Time / Source</th><th>Status</th><th>Citations</th><th>Question &amp; Answer</th></tr></thead>
    <tbody id="rows">{rows_markup}</tbody>
  </table>
</div>
<script>
const limit = {limit};
function fmtIst(iso) {{
  try {{ return new Date(iso).toLocaleString('en-IN', {{ timeZone: 'Asia/Kolkata', day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' }}) + ' IST'; }}
  catch {{ return iso || ''; }}
}}
function el(tag, cls, text) {{
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}}
async function refresh() {{
  if (!document.getElementById('auto').checked) return;
  try {{
    const res = await fetch('/logs?format=json&limit=' + limit);
    if (!res.ok) return;
    const data = await res.json();
    const tbody = document.getElementById('rows');
    tbody.replaceChildren();
    if (!data.length) {{
      const tr = el('tr'); const td = el('td', 'empty', 'No queries logged yet.'); td.colSpan = 4; tr.appendChild(td); tbody.appendChild(tr); return;
    }}
    for (const r of data) {{
      const tr = el('tr');
      const td1 = el('td', 'nowrap');
      td1.appendChild(el('div', 'time', fmtIst(r.created_at)));
      const meta = el('div', 'meta');
      const qid = String(r.query_id || '');
      meta.appendChild(el('span', 'pill ' + (qid.startsWith('voice_') ? 'voice' : 'web'), qid.startsWith('voice_') ? 'Voice' : 'Web'));
      meta.appendChild(document.createTextNode(' '));
      meta.appendChild(el('code', '', qid));
      td1.appendChild(meta);

      const td2 = el('td', 'nowrap');
      const st = String(r.answer_status || '');
      td2.appendChild(el('span', 'pill ' + (st === 'answered' ? 'ok' : 'ref'), st));
      const ms = r.latency_ms || 0;
      td2.appendChild(el('div', 'lat', ms >= 100 ? (ms/1000).toFixed(2) + ' s' : ms + ' ms'));

      const seen = new Set();
      for (const c of (r.citations || [])) {{
        const doc = c.doc_id || c.gr_id || '';
        if (doc) seen.add(c.page ? doc + ' (p.' + c.page + ')' : doc);
      }}
      const td3 = el('td', 'cites', [...seen].join(', ') || '—');

      const td4 = el('td', 'qa');
      td4.appendChild(el('div', 'q', String(r.question || '')));
      td4.appendChild(el('div', 'a', String(r.answer || r.refusal_reason || '')));

      tr.append(td1, td2, td3, td4);
      tbody.appendChild(tr);
    }}
  }} catch {{}}
}}
setInterval(refresh, 3000);
</script>
</body>
</html>"""


@router.get("/logs")
def logs(request: Request, limit: int = Query(20, ge=1, le=500), format: str | None = None):
    rows = S(request).db.recent_logs(limit)
    accept = request.headers.get("accept", "")
    if format != "json" and "text/html" in accept:
        return HTMLResponse(render_logs_html(rows, limit), media_type="text/html; charset=utf-8")
    return JSONResponse(content=json.loads(json.dumps(rows, default=str)), media_type="application/json; charset=utf-8")


@router.get("/admin/session")
def admin_session():
    """Login check for the admin page: reaching this handler means the middleware accepted the admin token (or, with no token set, that the
    call came from this machine). With no `GOV_ADMIN_TOKEN` configured there is no password to check, so the page is told to stay locked."""
    import os
    if not os.environ.get("GOV_ADMIN_TOKEN", ""):
        raise HTTPException(503, "No admin password is set. Set GOV_ADMIN_TOKEN in .env and restart the server.")
    return {"ok": True, "max_upload_mb": int(os.getenv("GOV_MAX_UPLOAD_MB", "50"))}


@router.post("/admin/rebuild")
def rebuild(request: Request):
    st = S(request)
    st.rebuild()
    cg = getattr(request.app.state, "contract_graph", None)
    if cg is not None:
        from ..graph import load_corpus
        load_corpus(cg, st.corpus, st.lineage)  # idempotent: re-ingest recomputes each document's outgoing links
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


class TranslateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2500)
    target_language: str = Field(default="gu", pattern="^(en|gu|english|gujarati)$")


@router.post("/translate")
def translate_passage(body: TranslateRequest):
    """On-demand official Gujarati/English helper translation for verbatim GR quotes and blocks."""
    try:
        from backend.rag.llm_gateway import translate_answer_text
    except ImportError:
        from rag.llm_gateway import translate_answer_text

    tgt = "gu" if body.target_language.lower().startswith("gu") else "en"
    translated = translate_answer_text(body.text, tgt)
    if not translated:
        raise HTTPException(503, "Translation model is currently unavailable.")
    return {"translated": translated, "target_language": tgt}
