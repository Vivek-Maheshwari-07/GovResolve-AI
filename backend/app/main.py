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
from .normalize import detect_language
from .routers.api import router as member_b_router
from .security import HardeningMiddleware
from .schemas.member_a import Citation
from .schemas import (
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
    ReasonCode,
    Relation,
    Statement,
    StatementLabel,
    Verdict,
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
    cors_origins = cfg.cors_origins if cfg else ["*"]
    app.add_middleware(CORSMiddleware, allow_origins=cors_origins, allow_methods=["*"], allow_headers=["*"])
    if cfg is not None:
        app.add_middleware(HardeningMiddleware)

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
            language = req.language or detect_language(req.question)
            result = engine.answer(req.question, language)

            citations: list[Citation] = []
            warnings: list[str] = list(result.warnings)
            kept: dict[int, int] = {}  # engine citation index -> response citation index
            for i, raw in enumerate(result.citations):
                meta = graph.get_meta(raw.doc_id)
                if meta is None:
                    warnings.append(f"Dropped citation to unknown document {raw.doc_id!r}.")
                    continue
                kept[i] = len(citations)
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

            # A cited GR that changes a GR we do not hold: say so. Refusing when every citation is only an amendment of a
            # missing base is opt-in (GOV_BROKEN_CHAIN_REFUSES=1): the scorecard showed it refuses questions the amendment
            # answers by itself (e.g. "from which date is this amendment in force?"), so by default we answer with the warning.
            fragments: list[str] = []
            for cit in citations:
                broken = graph.broken_links(cit.doc_id)
                for rel, ref in broken:
                    warnings.append(f"BROKEN_CHAIN: {cit.doc_id} {rel.value} {ref}, which is not in the collection; "
                                    "the text it changes cannot be checked.")
                if any(rel is Relation.AMENDS for rel, _ in broken):
                    fragments.append(cit.doc_id)
            if (os.environ.get("GOV_BROKEN_CHAIN_REFUSES") == "1" and result.answer and citations
                    and len(set(fragments)) == len({c.doc_id for c in citations})):
                return QueryResponse(
                    verdict=Verdict.INSUFFICIENT_EVIDENCE,
                    reason="Every document found only amends a GR that is not in the collection, so the full rule "
                           "cannot be established: " + ", ".join(sorted(set(fragments))) + ".",
                    reason_code=ReasonCode.BROKEN_CHAIN,
                    warnings=warnings,
                    language=language,
                )

            if not result.answer or not citations:
                return QueryResponse(
                    verdict=Verdict.INSUFFICIENT_EVIDENCE,
                    reason=result.insufficient_reason
                    or "The available documents do not support an answer.",
                    reason_code=result.reason_code or ReasonCode.NO_DOCUMENT,
                    warnings=warnings,
                    language=language,
                )
            return QueryResponse(
                verdict=Verdict.ANSWERED,
                answer=result.answer,
                citations=citations,
                warnings=warnings,
                language=language,
                statements=[_remap_statement(st, kept) for st in result.statements],
            )

        if cfg is None and os.environ.get("SFIC_SEED") == "1" and not graph.list_documents():
            load_demo(graph)
            persist()

    if cfg is not None and (cfg.frontend_dir / "index.html").is_file():
        # last, so every API route above wins; `html=True` serves index.html at /
        app.mount("/", StaticFiles(directory=cfg.frontend_dir, html=True), name="ui")

    return app


def _remap_statement(st: Statement, kept: dict[int, int]) -> Statement:
    """Point a statement at the citations that survived; an "established" one left with none is only inferred."""
    cites = [kept[i] for i in st.citations if i in kept]
    label = st.label
    if label is StatementLabel.ESTABLISHED and not cites:
        label = StatementLabel.INFERRED
    return Statement(text=st.text, label=label, citations=cites)


app = create_app()
