"""
Squad 3 + Squad 2 — FastAPI Backend
Serves all endpoints needed by the frontend and evaluation script.

Endpoints:
  POST /api/query          — main RAG query
  GET  /api/gr/{gr_id}     — get GR record
  GET  /api/lineage/{gr_id}— lineage chain for a GR
  GET  /api/pdf/{gr_id}    — stream original PDF
  POST /api/ingest         — trigger ingestion (admin)
  GET  /api/health         — health check
  GET  /api/stats          — collection stats
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from loguru import logger
from dotenv import load_dotenv

load_dotenv()

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from backend.models import (
    AnswerStatus, ClauseStatus, GRRecord, InsufficientReason,
    Language, LineageEdge, LineageNode, QueryResponse,
)
from backend.ingestion.ingest import ingest_directory
from backend.lineage.lineage_graph import LineageGraph, apply_lineage_to_records
from backend.rag.search_engine import GRIndex, RAGPipeline

# ── Config ────────────────────────────────────
GR_PDF_DIR     = os.getenv("GR_PDF_DIR",     "./data/grs")
PROCESSED_DIR  = os.getenv("PROCESSED_DIR",  "./data/processed")
CHROMA_DIR     = os.getenv("CHROMA_PERSIST_DIR", "./data/index/chroma")
LINEAGE_GRAPH  = "./data/index/lineage_graph.json"

app = FastAPI(
    title="GovResolve-AI API",
    description="Bilingual Gujarati-English Government Resolution RAG System",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],     # tighten for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Global state ──────────────────────────────
_records: list[GRRecord]      = []
_index:   Optional[GRIndex]   = None
_pipeline: Optional[RAGPipeline] = None
_lineage: Optional[LineageGraph]  = None


def _load_records() -> list[GRRecord]:
    records = []
    for jf in Path(PROCESSED_DIR).glob("*.json"):
        try:
            with open(jf, encoding="utf-8") as f:
                records.append(GRRecord.model_validate_json(f.read()))
        except Exception as e:
            logger.warning(f"Could not load {jf.name}: {e}")
    return records


@app.on_event("startup")
async def startup():
    global _records, _index, _pipeline, _lineage
    logger.info("GovResolve-AI API starting up …")

    _records = _load_records()
    logger.info(f"Loaded {len(_records)} GR records.")

    # Build / load lineage graph
    _lineage = LineageGraph()
    if Path(LINEAGE_GRAPH).exists():
        _lineage = LineageGraph.load(LINEAGE_GRAPH)
    elif _records:
        _lineage.build(_records)
        apply_lineage_to_records(_records, _lineage)
        _lineage.save(LINEAGE_GRAPH)

    # Build search index
    _index = GRIndex(persist_dir=CHROMA_DIR)
    _index.load_bm25()
    if _records:
        _index.build(_records)

    _pipeline = RAGPipeline(_index, _records, lineage_graph=_lineage)
    logger.success("Startup complete.")


# ──────────────────────────────────────────────
# Request / Response models
# ──────────────────────────────────────────────

class QueryRequest(BaseModel):
    question:   str
    department: Optional[str] = None
    year:       Optional[int] = None
    gr_id:      Optional[str] = None   # direct GR lookup


class IngestRequest(BaseModel):
    pdf_dir: Optional[str] = None


# ──────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "records": len(_records),
        "index_docs": _index.collection.count() if _index and _index.collection else 0,
    }


@app.get("/api/stats")
def stats():
    return {
        "total_grs":    len(_records),
        "departments":  list({r.department for r in _records}),
        "latest_date":  max((r.issue_date for r in _records if r.issue_date), default=None),
        "graph_nodes":  _lineage.G.number_of_nodes() if _lineage else 0,
        "graph_edges":  _lineage.G.number_of_edges() if _lineage else 0,
    }


@app.post("/api/query", response_model=QueryResponse)
def query(req: QueryRequest):
    if not _pipeline:
        raise HTTPException(503, "Pipeline not initialised. Add GRs first via /api/ingest.")

    filters = {}
    if req.department:
        filters["department"] = req.department
    if req.year:
        filters["year"] = req.year

    try:
        response = _pipeline.answer(req.question, filters or None)
        # Attach lineage chain if we have records
        if _lineage and response.citations:
            gr_ids = list({c.gr_id for c in response.citations})
            chain_nodes = []
            for gid in gr_ids:
                chain = _lineage.get_chain(gid)
                for node_id in chain:
                    nd = _lineage.G.nodes.get(node_id, {})
                    out_edges_raw = list(_lineage.G.out_edges(node_id, data=True))
                    edges_out = [
                        LineageEdge(**e["edge_data"])
                        for _, _, e in out_edges_raw
                        if "edge_data" in e
                    ]
                    chain_nodes.append(LineageNode(
                        gr_id=node_id,
                        gr_number=nd.get("gr_number", node_id),
                        date=nd.get("issue_date"),
                        status=_lineage.get_clause_status(node_id),
                        edges_out=edges_out,
                    ))
            response.lineage_chain = chain_nodes
        return response
    except Exception as e:
        logger.exception(f"Query failed: {e}")
        raise HTTPException(500, f"Query processing error: {str(e)}")


@app.get("/api/gr/{gr_id}")
def get_gr(gr_id: str):
    for r in _records:
        if r.gr_id == gr_id:
            return r.model_dump(exclude={"raw_text", "pages"})
    raise HTTPException(404, f"GR {gr_id!r} not found.")


@app.get("/api/lineage/{gr_id}")
def get_lineage(gr_id: str):
    if not _lineage:
        raise HTTPException(503, "Lineage graph not initialised.")
    if gr_id not in _lineage.G:
        raise HTTPException(404, f"GR {gr_id!r} not in lineage graph.")

    chain = _lineage.get_chain(gr_id)
    latest = _lineage.get_latest_version(gr_id)
    nodes = []
    for nid in chain:
        nd = _lineage.G.nodes[nid]
        edges_out = [
            d["edge_data"]
            for _, _, d in _lineage.G.out_edges(nid, data=True)
            if "edge_data" in d
        ]
        nodes.append({
            "gr_id":     nid,
            "gr_number": nd.get("gr_number", nid),
            "date":      nd.get("issue_date"),
            "status":    _lineage.get_clause_status(nid).value,
            "edges_out": edges_out,
        })
    return {"chain": nodes, "latest_version": latest}


@app.get("/api/pdf/{gr_id}")
def get_pdf(gr_id: str, page: int = Query(1, ge=1)):
    for r in _records:
        if r.gr_id == gr_id:
            pdf_path = r.file_path
            if not Path(pdf_path).exists():
                raise HTTPException(404, f"PDF file not found: {pdf_path}")
            return FileResponse(
                pdf_path,
                media_type="application/pdf",
                filename=f"{gr_id}.pdf",
                headers={"X-Page-Hint": str(page)},
            )
    raise HTTPException(404, f"GR {gr_id!r} not found.")


@app.post("/api/ingest")
def trigger_ingest(req: IngestRequest, background_tasks: BackgroundTasks):
    pdf_dir = req.pdf_dir or GR_PDF_DIR

    def _run():
        global _records, _index, _pipeline, _lineage
        logger.info(f"Background ingestion from {pdf_dir}")
        new_records = ingest_directory(pdf_dir, PROCESSED_DIR)
        _records = _load_records()
        _lineage = LineageGraph()
        _lineage.build(_records)
        apply_lineage_to_records(_records, _lineage)
        _lineage.save(LINEAGE_GRAPH)
        _index = GRIndex(persist_dir=CHROMA_DIR)
        _index.build(_records)
        _pipeline = RAGPipeline(_index, _records, lineage_graph=_lineage)
        logger.success(f"Re-indexed {len(_records)} records.")

    background_tasks.add_task(_run)
    return {"status": "ingestion started", "pdf_dir": pdf_dir}


@app.get("/api/chunks/{gr_id}")
def get_chunks(gr_id: str, page: int = Query(None)):
    for r in _records:
        if r.gr_id == gr_id:
            chunks = r.chunks
            if page:
                chunks = [c for c in chunks if page in c.pages]
            return [c.model_dump() for c in chunks]
    raise HTTPException(404, f"GR {gr_id!r} not found.")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.api.main:app", host="0.0.0.0", port=8000, reload=True)

