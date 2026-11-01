"""Run Squad 2's RAG pipeline inside this app, on our corpus, with our lineage.

Set `GOV_ENGINE=squad2` (default is `retrieval`) and `/query` answers through `backend.rag.search_engine.RAGPipeline`.
The pipeline is built on the first question, not at startup, so the API comes up fast and Squad 2's heavy imports
(chromadb, loguru, the embedder) are only paid for when used.

Their own lineage graph is never used: `OurLineageAdapter` answers the two questions the pipeline asks about a GR
(status, latest version) from our contract graph, so statuses follow the hard rules (explicit references only, never "active").
"""
from __future__ import annotations

import sys
import threading
from datetime import date
from pathlib import Path
from typing import Any, Callable

from .engine import EngineResult
from .graph import LineageGraph
from .schemas import LineageStatus
from .squad2_bridge import Squad2Engine, to_squad2_records

ROOT = Path(__file__).resolve().parents[2]


class OurLineageAdapter:
    """The slice of Squad 2's `LineageGraph` the pipeline uses, backed by our contract graph and lineage edges."""

    def __init__(self, graph: LineageGraph, edges: Callable[[], list]):
        self._graph = graph
        self._edges = edges

    def get_clause_status(self, gr_id: str) -> Any:
        from backend.models import ClauseStatus  # Squad 2's enum; resolved once the repo root is on sys.path

        if gr_id not in self._graph:
            return ClauseStatus.UNKNOWN
        status = self._graph.status_of(gr_id).status
        # ACTIVE is only the pipeline's internal "no later change found"; it is shown to the model as such and never returned.
        return {LineageStatus.AMENDED: ClauseStatus.AMENDED, LineageStatus.SUPERSEDED: ClauseStatus.SUPERSEDED,
                LineageStatus.NO_LATER_AMENDMENT_FOUND: ClauseStatus.ACTIVE}.get(status, ClauseStatus.UNKNOWN)

    def get_latest_version(self, gr_id: str) -> str:
        """The newest document (by issue date) among those that amend or supersede `gr_id`; `gr_id` if none."""
        if gr_id not in self._graph:
            return gr_id
        latest = self._graph.status_of(gr_id).latest_doc_ids

        def issued(doc_id: str) -> date:
            meta = self._graph.get_meta(doc_id)
            return meta.issue_date if meta and meta.issue_date else date.min
        return max(latest, key=issued) if latest else gr_id

    def evidence_chunk_ids(self, gr_id: str, latest_id: str) -> list[str]:
        """Chunks of `latest_id` that carry its amendment of `gr_id` (where the engine found the reference)."""
        return [e.evidence_chunk_id for e in self._edges()
                if e.source_gr == latest_id and e.target_gr == gr_id and e.evidence_chunk_id]


def build_pipeline(state: Any, graph: LineageGraph, index_dir: Path) -> Any:
    """`RAGPipeline` over `state.corpus`, using the Chroma + BM25 index saved in `index_dir`."""
    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")  # Squad 2 reads EMBEDDING_MODEL, LLM_* at import time, so load before importing it
    from backend.rag.search_engine import GRIndex, RAGPipeline

    records = to_squad2_records(list(state.corpus.grs.values()), ROOT)
    index = GRIndex(str(index_dir))
    if index.collection is not None and index.collection.count() == 0:
        index.build(records)  # first run without a prebuilt index (slow with a CPU embedder)
    else:
        index.load_bm25()
    return RAGPipeline(index, records, lineage_graph=OurLineageAdapter(graph, state.lineage.edges))


class LazySquad2Engine:
    """Our `AnswerEngine` that builds Squad 2's pipeline on the first question. A failed build is retried next time."""

    def __init__(self, get_state: Callable[[], Any], graph: LineageGraph, index_dir: Path):
        self._get_state, self._graph, self._index_dir = get_state, graph, index_dir
        self._engine: Squad2Engine | None = None
        self._lock = threading.Lock()

    def answer(self, question: str, language: str) -> EngineResult:
        with self._lock:
            if self._engine is None:
                state = self._get_state()
                if state is None:
                    return EngineResult(insufficient_reason="Backend is still starting.")
                try:
                    self._engine = Squad2Engine(build_pipeline(state, self._graph, self._index_dir))
                except Exception as exc:
                    return EngineResult(insufficient_reason=f"Answer engine unavailable: {type(exc).__name__}: {exc}")
            engine = self._engine
        return engine.answer(question, language)
