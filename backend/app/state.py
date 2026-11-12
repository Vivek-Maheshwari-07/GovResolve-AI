import json
import time
from dataclasses import dataclass, field

from .config import Settings
from .schemas import LineageEdge
from .services.lineage_stub import StubLineageService
from .services.vector_store import VectorStore
from .store.corpus import Corpus
from .store.db import Database


def _make_lineage(corpus: Corpus, settings: Settings, cache=None):
    """Member A's real engine unless told otherwise; the stub is seeded from `settings.stub_edges`."""
    if settings.lineage_engine != "stub":
        try:
            from .lineage import LineageService
            from .lineage.llm_fallback import LLMFallback

            llm_down = False   # once no model answers, skip it for the rest of the build instead of waiting on every sentence

            def _llm_call(prompt: str) -> str:
                nonlocal llm_down
                if llm_down:
                    return ""
                try:
                    from backend.rag.llm_gateway import execute_llm_generation
                    reply, provider = execute_llm_generation("Reply with valid JSON only.", prompt, max_tokens=250, json_mode=True)
                    if provider == "fallback":
                        llm_down = True
                        return ""
                    return reply
                except Exception:
                    llm_down = True
                    return ""

            llm = LLMFallback(_llm_call, cache=cache) if settings.lineage_llm else None
            return LineageService(corpus, llm=llm, cache=cache), "real"
        except ImportError:
            if settings.lineage_engine == "real":
                raise
    seed = settings.stub_edges
    edges = [LineageEdge.model_validate(e) for e in json.loads(seed.read_text("utf-8"))] if seed and seed.exists() else []
    return StubLineageService(corpus, edges), "stub"


@dataclass
class AppState:
    settings: Settings
    corpus: Corpus = None
    db: Database = None
    lineage: object = None
    lineage_kind: str = "stub"
    vectors: VectorStore = None
    build_ms: int = 0
    _extra: dict = field(default_factory=dict)

    @classmethod
    def create(cls, settings: Settings, *, persist_vectors: bool = True) -> "AppState":
        st = cls(settings=settings)
        st.db = Database(settings.db_path)
        # When GOV_ENGINE=squad2, search is handled by GRIndex (data/index/chroma).
        # Keep vectors ephemeral in memory rather than writing duplicate data to data/vector.
        persist = persist_vectors and (settings.engine != "squad2")
        st.vectors = VectorStore(settings.vector_dir if persist else None, settings.embed_model)
        st.rebuild()
        return st

    def rebuild(self) -> None:
        t0 = time.perf_counter()
        self.corpus = Corpus.load(self.settings.corpus_dir)
        self.lineage, self.lineage_kind = _make_lineage(self.corpus, self.settings, self.db)
        added, removed = self.db.overrides()
        self.lineage.apply_overrides(added, removed)
        self.db.save_edges(self.lineage.edges())
        if self.settings.engine != "squad2":
            self.vectors.index_corpus(self.corpus)
        self.build_ms = int((time.perf_counter() - t0) * 1000)

    def reapply_overrides(self) -> None:
        added, removed = self.db.overrides()
        self.lineage.apply_overrides(added, removed)
