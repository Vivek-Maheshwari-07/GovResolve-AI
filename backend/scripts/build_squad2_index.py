"""Build Squad 2's search index (Chroma vectors + BM25) from our GR JSON corpus, then run a few test queries.

Usage (from backend/, with the repo .venv and the embedder configured in ../.env, e.g. EMBEDDING_MODEL=ollama:bge-m3):
    python -m scripts.build_squad2_index --corpus D:/test/corpus_v1 --index ../data/index/chroma [--query "..."]

Re-running adds only chunks not already in Chroma and removes chunks that are no longer in the corpus or whose text changed; BM25 is rebuilt each time. Output is data, keep it out of git.
"""
import argparse
import json
import sys
import time
from pathlib import Path

from app.schemas import GRRecord
from app.squad2_bridge import to_squad2_records
from app.store.corpus import from_legacy

ROOT = Path(__file__).resolve().parents[2]
TEST_QUERIES = [
    "maternity leave rules for government employees",
    "પ્રસૂતિ રજા અંગેના નિયમો",
    "Gujarat Civil Services Discipline and Appeal Rules amendment",
    "ખાતાકીય તપાસ જાહેર સેવા આયોગ પરામર્શ",
    "leave travel concession karmayogi application",
]


def load_records(corpus: Path, root: Path) -> list[object]:
    """Load both Squad 1 (`app.schemas.GRRecord`) and Squad 2 (`backend.models.GRRecord`) JSON corpora.
    Squad 1 files pass through `from_legacy`, so data/processed (ingestion format) and corpus_v2 records both load."""
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))
    from backend import models as m

    squad1: list[GRRecord] = []
    squad2: list[object] = []
    for f in sorted(corpus.glob("*.json")):
        raw = json.loads(f.read_text(encoding="utf-8"))
        chunks = raw.get("chunks") or []
        if "raw_text" in raw or (chunks and "pages" in chunks[0]):
            squad2.append(m.GRRecord.model_validate(raw))
        else:
            squad1.append(GRRecord.model_validate(from_legacy(raw)))
    if squad1:
        squad2.extend(to_squad2_records(squad1, root))
    return squad2


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="backslashreplace")

    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus", type=Path, required=True)
    ap.add_argument("--index", type=Path, default=ROOT / "data" / "index" / "chroma")
    ap.add_argument("--query", action="append", help="test query (repeatable); defaults to a built-in set")
    ap.add_argument("--top-k", type=int, default=3)
    ap.add_argument("--reset", action="store_true", help="rebuild ChromaDB collection from scratch (required when changing embedder)")
    args = ap.parse_args()

    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")
    from backend.rag.search_engine import EMBEDDING_MODEL, GRIndex

    records = load_records(args.corpus, ROOT)
    n_chunks = sum(len(r.chunks) for r in records)
    print(f"{len(records)} records, {n_chunks} chunks, embedder {EMBEDDING_MODEL} -> {args.index}", flush=True)
    t = time.time()
    index = GRIndex(str(args.index))
    reset = bool(args.reset)
    if not reset and index.collection is not None and index.collection.count() > 0:
        col_ef = getattr(index.collection, "_embedding_function", None)
        if col_ef is not None and index._ef is not None and type(col_ef) is not type(index._ef):
            print(f"Embedder changed ({type(col_ef).__name__} -> {type(index._ef).__name__}); resetting collection.", flush=True)
            reset = True
    if not reset and index.collection is not None:  # chunks of documents that were re-read (new OCR) have new ids: drop the old ones first
        current = {c.chunk_id: c.text_clean.strip()[:3000] for r in records for c in r.chunks}
        stored = index.collection.get(include=["documents"])
        # a re-read document keeps its chunk ids but has new text, so compare the text, not just the ids
        # an index built by an older build kept only the first 1,000 characters: a stored prefix of the current text is not stale
        stale = [i for i, doc in zip(stored["ids"], stored["documents"])
                 if current.get(i) != doc and not (doc and len(doc) >= 1000 and (current.get(i) or "").startswith(doc))]
        for k in range(0, len(stale), 2000):
            index.collection.delete(ids=stale[k:k + 2000])
        if stale:
            print(f"removed {len(stale)} stale chunks", flush=True)
    index.build(records, reset=reset)
    print(f"built in {time.time() - t:.0f}s; chroma holds {index.collection.count() if index.collection else 0} chunks")

    subjects = {r.gr_id: r.subject for r in records}
    for q in args.query or TEST_QUERIES:
        t = time.time()
        hits = index.search(q, top_k=args.top_k)
        print(f"\nQ: {q}  ({time.time() - t:.1f}s)")
        for h in hits[:args.top_k]:
            gid = h["metadata"].get("gr_id")
            print(f"  {h['rrf_score']:.4f} {gid} | {(subjects.get(gid) or '')[:70]} | {h['text'][:90]!r}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
