"""Context vector database: ChromaDB over GR chunks, with lineage-friendly metadata.

Embedder is pluggable: "hash" is a deterministic offline embedder (demo/tests, lexical only);
any other value is loaded as a sentence-transformers model (e.g. a multilingual E5 for Gujarati).
"""
import hashlib
import re
from pathlib import Path

import chromadb
import numpy as np

from ..store.corpus import Corpus

DIM = 384
UPSERT_BATCH = 2000
_TOKEN = re.compile(r"\w+", re.UNICODE)


class HashEmbedder:
    """Hashed bag of words + character trigrams, L2-normalised. Works for Gujarati and English."""

    def __call__(self, texts: list[str]) -> list[list[float]]:
        out = []
        for t in texts:
            v = np.zeros(DIM, dtype=np.float32)
            t = t.lower()
            for w in _TOKEN.findall(t):
                v[self._h(w)] += 1.0
                for i in range(len(w) - 2):
                    v[self._h("#" + w[i:i + 3])] += 0.3
            n = np.linalg.norm(v)
            out.append((v / n if n else v).tolist())
        return out

    @staticmethod
    def _h(s: str) -> int:
        return int.from_bytes(hashlib.md5(s.encode()).digest()[:4], "little") % DIM


class SentenceEmbedder:
    def __init__(self, name: str):
        from sentence_transformers import SentenceTransformer

        self.model = SentenceTransformer(name)

    def __call__(self, texts: list[str]) -> list[list[float]]:
        return self.model.encode(texts, normalize_embeddings=True).tolist()


def make_embedder(name: str):
    return HashEmbedder() if name == "hash" else SentenceEmbedder(name)


class VectorStore:
    def __init__(self, persist_dir: Path | None, embed_model: str = "hash", name: str = "gr_chunks"):
        self.embed = make_embedder(embed_model)
        self.client = chromadb.PersistentClient(path=str(persist_dir)) if persist_dir else chromadb.EphemeralClient()
        self.name = f"{name}_{re.sub(r'[^a-zA-Z0-9]', '_', embed_model)[:40]}"
        self.col = self.client.get_or_create_collection(self.name, metadata={"hnsw:space": "cosine"})

    def reset(self) -> None:
        self.client.delete_collection(self.name)
        self.col = self.client.get_or_create_collection(self.name, metadata={"hnsw:space": "cosine"})

    def index_corpus(self, corpus: Corpus) -> int:
        ids, docs, metas = [], [], []
        for gr in corpus.grs.values():
            for c in gr.chunks:
                ids.append(c.chunk_id)
                docs.append(c.text)
                metas.append({
                    "gr_id": gr.gr_id, "page": c.page, "clause_label": c.clause_label or "",
                    "department": gr.department or "", "language": gr.language,
                    "year": gr.issue_date.year if gr.issue_date else 0,
                })
        step = UPSERT_BATCH  # Chroma rejects batches above its max (5461 here); real corpora exceed it
        for i in range(0, len(ids), step):
            part = docs[i:i + step]
            self.col.upsert(ids=ids[i:i + step], documents=part, metadatas=metas[i:i + step], embeddings=self.embed(part))
        return len(ids)

    def count(self) -> int:
        return self.col.count()

    def search(self, query: str, k: int = 5, filters: dict | None = None) -> list[dict]:
        if self.col.count() == 0:
            return []
        where = None
        if filters:
            clauses = [{key: val} for key, val in filters.items() if key in ("department", "language", "year", "gr_id")]
            where = clauses[0] if len(clauses) == 1 else {"$and": clauses} if clauses else None
        res = self.col.query(query_embeddings=self.embed([query]), n_results=min(k, self.col.count()), where=where)
        return [
            {"chunk_id": i, "text": d, "score": round(1 - dist, 4), **m}
            for i, d, m, dist in zip(res["ids"][0], res["documents"][0], res["metadatas"][0], res["distances"][0])
        ]
