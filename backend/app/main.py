from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, UploadFile, File
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import Settings, settings as default_settings
from .engine import AnswerEngine, NullEngine, RetrievalEngine
from .graph import LineageGraph, load_corpus
from .query_eval import evaluate_query
from .routers.api import router as member_b_router
from .routers.voice import router as voice_router
from .security import HardeningMiddleware
from .schemas import (
    DocumentDetail,
    DocumentIn,
    DocumentMeta,
    Edge,
    IngestResult,
    LineageGraphResponse,
    LineageInfo,
    QueryRequest,
    QueryResponse,
)
from .seed import load_demo
from .squad2_runtime import LazySquad2Engine
from .state import AppState


MAX_UPLOAD_BYTES = int(os.getenv("GOV_MAX_UPLOAD_MB", "50")) * 1_000_000


def jsonable(errors: list[dict]) -> list[dict]:
    return [{"loc": list(e.get("loc", [])), "msg": e.get("msg", ""), "type": e.get("type", "")} for e in errors]


def create_app(
    settings_or_graph: Settings | LineageGraph | None = None,
    engine: AnswerEngine | None = None,
    store_path: str | Path | None = None,
    *,
    persist_vectors: bool = True,
    graph: LineageGraph | None = None,
) -> FastAPI:
    cfg: Settings | None = None
    if isinstance(settings_or_graph, Settings):
        cfg = settings_or_graph
    elif isinstance(settings_or_graph, LineageGraph):
        graph = settings_or_graph
    elif settings_or_graph is None and graph is None and engine is None and store_path is None:
        cfg = default_settings

    if cfg is not None and graph is None:
        graph = LineageGraph()  # document-level contract graph, filled from the corpus on startup
    if graph is None and cfg is None:
        graph = (
            LineageGraph.load(store_path)
            if store_path and Path(store_path).exists()
            else LineageGraph()
        )
    if engine is None and cfg is not None and cfg.engine == "squad2":
        engine = LazySquad2Engine(lambda: getattr(app.state, "gov", None), graph, cfg.squad2_index_dir)
    if engine is None:
        engine = RetrievalEngine(lambda: getattr(app.state, "gov", None)) if cfg is not None else NullEngine()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if cfg is not None:
            app.state.gov = AppState.create(cfg, persist_vectors=persist_vectors)
            app.state.contract_graph = graph
            app.state.engine = engine
            if not graph.list_documents():
                load_corpus(graph, app.state.gov.corpus, app.state.gov.lineage)
            if os.getenv("SFIC_SEED", "0") == "1":
                from .seed import load_demo
                load_demo(graph)
            getattr(engine, "prewarm", lambda: None)()  # build the answer pipeline now, off the request path
        yield

    app = FastAPI(
        title="GovResolve-AI backend",
        version=cfg.version if cfg else "0.1.0",
        lifespan=lifespan,
    )
    app.state.contract_graph = graph
    app.state.engine = engine
    cors_origins = cfg.cors_origins if cfg else ["*"]
    app.add_middleware(CORSMiddleware, allow_origins=cors_origins, allow_methods=["*"], allow_headers=["*"])
    if cfg is not None:
        app.add_middleware(HardeningMiddleware)

    app.include_router(voice_router)
    if cfg is not None:
        app.include_router(member_b_router)

        @app.exception_handler(StarletteHTTPException)
        async def http_error(_: Request, exc: StarletteHTTPException):
            return JSONResponse({"error": exc.detail, "reason": exc.detail}, status_code=exc.status_code)

        @app.exception_handler(RequestValidationError)
        async def validation_error(_: Request, exc: RequestValidationError):
            return JSONResponse({"error": "validation_error", "reason": "Invalid request",
                                 "details": jsonable(exc.errors())}, status_code=422)

    def persist() -> None:
        if store_path and graph:
            graph.save(store_path)

    if cfg is None:
        @app.get("/health")
        def health() -> dict:
            return {"status": "ok", "documents": len(graph.list_documents()) if graph else 0}

    if graph is not None:
        @app.post("/documents", response_model=IngestResult)
        def ingest(doc: DocumentIn) -> IngestResult:
            result = graph.add_document(doc)
            persist()
            return result

        @app.post("/api/upload")
        def upload_pdf(file: UploadFile = File(...)):
            """Add one PDF to the collection (admin call; see security.py). Plain `def`, so OCR runs in a worker thread."""
            import re
            import sys

            root = str(Path(__file__).resolve().parents[2])
            if root not in sys.path:
                sys.path.insert(0, root)
            from backend.ingestion.ingest import ingest_pdf
            from .schemas.gr import GRRecord as SchemaGRRecord

            name = re.sub(r"[^A-Za-z0-9._-]+", "_", Path(file.filename or "").name)
            if not name.lower().endswith(".pdf"):
                raise HTTPException(400, "Only PDF files are supported.")
            head = file.file.read(5)
            if head != b"%PDF-":
                raise HTTPException(400, "The file is not a PDF.")
            pdf_dir = Path(cfg.pdf_dir if cfg else "data/raw")
            pdf_dir.mkdir(parents=True, exist_ok=True)
            dest = pdf_dir / name
            n = 1
            while dest.exists():
                dest = pdf_dir / f"{Path(name).stem}_{n}.pdf"
                n += 1
            size = len(head)
            try:
                with open(dest, "wb") as out:
                    out.write(head)
                    while chunk := file.file.read(1024 * 1024):
                        size += len(chunk)
                        if size > MAX_UPLOAD_BYTES:
                            raise HTTPException(413, f"PDF is larger than {MAX_UPLOAD_BYTES // 1_000_000} MB.")
                        out.write(chunk)
                rec = ingest_pdf(str(dest), processed_dir=str(cfg.corpus_dir if cfg else "data/processed"))
            except Exception:
                dest.unlink(missing_ok=True)
                raise
            st = getattr(app.state, "gov", None)
            if st and st.corpus:
                schema_rec = SchemaGRRecord.model_validate(rec.model_dump(mode="json"))
                st.corpus.grs[schema_rec.gr_id] = schema_rec
                st.corpus._reindex()
                cg = getattr(app.state, "contract_graph", None)
                if cg is not None:
                    load_corpus(cg, st.corpus, st.lineage)
            return {"status": "ok", "gr_id": rec.gr_id, "gr_number": rec.gr_number, "pages": len(rec.pages),
                    "note": "Added to the library; restart the server to make it searchable by the answer engine."}

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
        @app.post("/api/query", response_model=QueryResponse, include_in_schema=False)
        def query(req: QueryRequest) -> QueryResponse:
            return evaluate_query(req.question, req.language, graph, engine)

        if cfg is None and os.environ.get("SFIC_SEED") == "1" and not graph.list_documents():
            load_demo(graph)
            persist()

    if cfg is not None and (cfg.frontend_dir / "index.html").is_file():
        # last, so every API route above wins; `html=True` serves index.html at /
        app.mount("/", StaticFiles(directory=cfg.frontend_dir, html=True), name="ui")

    return app


app = create_app()
