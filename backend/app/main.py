"""FastAPI entry point: ``uvicorn app.main:app --reload``.

Environment:
  SFIC_GRAPH_PATH  JSON file to load the graph from and save it to after ingest.
  SFIC_SEED=1      load the synthetic DEMO documents when the graph is empty.
"""
from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .engine import AnswerEngine, NullEngine
from .graph import LineageGraph
from .normalize import detect_language
from .schemas import (
    Citation,
    DocumentDetail,
    DocumentIn,
    DocumentMeta,
    Edge,
    IngestResult,
    LineageGraphResponse,
    LineageInfo,
    LineageStatus,
    QueryRequest,
    QueryResponse,
    Verdict,
)
from .seed import load_demo


def create_app(
    graph: LineageGraph | None = None,
    engine: AnswerEngine | None = None,
    store_path: str | Path | None = None,
) -> FastAPI:
    if graph is None:
        graph = (
            LineageGraph.load(store_path)
            if store_path and Path(store_path).exists()
            else LineageGraph()
        )
    engine = engine or NullEngine()

    app = FastAPI(title="SFIC GR Lineage API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
    )

    def persist() -> None:
        if store_path:
            graph.save(store_path)

    @app.get("/health")
    def health() -> dict:
        return {"status": "ok", "documents": len(graph.list_documents())}

    @app.post("/documents", response_model=IngestResult)
    def ingest(doc: DocumentIn) -> IngestResult:
        result = graph.add_document(doc)
        persist()
        return result

    @app.get("/documents", response_model=list[DocumentMeta])
    def list_documents() -> list[DocumentMeta]:
        return graph.list_documents()

    @app.get("/documents/{doc_id}", response_model=DocumentDetail)
    def get_document(doc_id: str) -> DocumentDetail:
        meta = graph.get_meta(doc_id)
        if meta is None:
            raise HTTPException(404, f"Unknown document {doc_id!r}")
        return DocumentDetail(meta=meta, lineage=graph.status_of(doc_id))

    @app.get("/lineage/{doc_id}", response_model=LineageGraphResponse)
    def get_lineage(doc_id: str) -> LineageGraphResponse:
        result = graph.lineage(doc_id)
        if result is None:
            raise HTTPException(404, f"Unknown document {doc_id!r}")
        return result

    @app.get("/lineage/{doc_id}/status", response_model=LineageInfo)
    def get_status(doc_id: str) -> LineageInfo:
        if doc_id not in graph:
            raise HTTPException(404, f"Unknown document {doc_id!r}")
        return graph.status_of(doc_id)

    @app.get("/edges", response_model=list[Edge])
    def list_edges() -> list[Edge]:
        return graph.edges()

    @app.post("/query", response_model=QueryResponse)
    def query(req: QueryRequest) -> QueryResponse:
        language = req.language or detect_language(req.question)
        result = engine.answer(req.question, language)

        citations: list[Citation] = []
        warnings: list[str] = []
        for raw in result.citations:
            meta = graph.get_meta(raw.doc_id)
            if meta is None:
                warnings.append(f"Dropped citation to unknown document {raw.doc_id!r}.")
                continue
            lineage = graph.status_of(raw.doc_id)
            citations.append(
                Citation(
                    doc_id=raw.doc_id,
                    page=raw.page,
                    quote=raw.quote,
                    issue_date=meta.issue_date,
                    bbox=raw.bbox,
                    lineage=lineage,
                )
            )
            if lineage.status is LineageStatus.SUPERSEDED:
                warnings.append(
                    f"{raw.doc_id} is superseded ({lineage.summary}); this passage may no longer apply."
                )
            elif lineage.status is LineageStatus.AMENDED:
                warnings.append(
                    f"{raw.doc_id} has been amended ({lineage.summary}); read the passage together with the amendment."
                )
            elif lineage.status is LineageStatus.UNKNOWN:
                warnings.append(f"Current applicability of {raw.doc_id} cannot be established.")

        if not result.answer or not citations:
            return QueryResponse(
                verdict=Verdict.INSUFFICIENT_EVIDENCE,
                reason=result.insufficient_reason
                or "The available documents do not support an answer.",
                warnings=warnings,
                language=language,
            )
        return QueryResponse(
            verdict=Verdict.ANSWERED,
            answer=result.answer,
            citations=citations,
            warnings=warnings,
            language=language,
        )

    if os.environ.get("SFIC_SEED") == "1" and not graph.list_documents():
        load_demo(graph)
        persist()

    return app


app = create_app(store_path=os.environ.get("SFIC_GRAPH_PATH"))
