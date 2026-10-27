import json
import time
from dataclasses import dataclass, field
from pathlib import Path

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
            return LineageService(corpus, cache=cache), "real"
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
    built_at: float = 0.0
    build_ms: int = 0
    _extra: dict = field(default_factory=dict)

    @classmethod
    def create(cls, settings: Settings, *, persist_vectors: bool = True) -> "AppState":
        st = cls(settings=settings)
        st.db = Database(settings.db_path)
        st.vectors = VectorStore(settings.vector_dir if persist_vectors else None, settings.embed_model)
        st.rebuild()
        return st

    def rebuild(self) -> None:
        t0 = time.perf_counter()
        self.corpus = Corpus.load(self.settings.corpus_dir)
        self.lineage, self.lineage_kind = _make_lineage(self.corpus, self.settings, self.db)
        added, removed = self.db.overrides()
        self.lineage.apply_overrides(added, removed)
        self.db.save_edges(self.lineage.edges())
        self.vectors.index_corpus(self.corpus)
        self.build_ms = int((time.perf_counter() - t0) * 1000)
        self.built_at = time.time()

    def reapply_overrides(self) -> None:
        added, removed = self.db.overrides()
        self.lineage.apply_overrides(added, removed)
