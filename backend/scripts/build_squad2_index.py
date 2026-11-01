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

ROOT = Path(__file__).resolve().parents[2]
TEST_QUERIES = [
    "maternity leave rules for government employees",
    "પ્રસૂતિ રજા અંગેના નિયમો",
    "Gujarat Civil Services Discipline and Appeal Rules amendment",
    "ખાતાકીય તપાસ જાહેર સેવા આયોગ પરામર્શ",
    "leave travel concession karmayogi application",
]


def load_corpus(corpus: Path) -> list[GRRecord]:
    return [GRRecord.model_validate(json.loads(f.read_text(encoding="utf-8"))) for f in sorted(corpus.glob("*.json"))]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus", type=Path, required=True)
    ap.add_argument("--index", type=Path, default=ROOT / "data" / "index" / "chroma")
    ap.add_argument("--query", action="append", help="test query (repeatable); defaults to a built-in set")
    ap.add_argument("--top-k", type=int, default=3)
    args = ap.parse_args()

    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")
    from backend.rag.search_engine import EMBEDDING_MODEL, GRIndex

    records = to_squad2_records(load_corpus(args.corpus), ROOT)
    n_chunks = sum(len(r.chunks) for r in records)
    print(f"{len(records)} records, {n_chunks} chunks, embedder {EMBEDDING_MODEL} -> {args.index}", flush=True)
    t = time.time()
    index = GRIndex(str(args.index))
    if index.collection is not None:  # chunks of documents that were re-read (new OCR) have new ids: drop the old ones first
        current = {c.chunk_id: c.text_clean.strip() for r in records for c in r.chunks}
        stored = index.collection.get(include=["documents"])
        # a re-read document keeps its chunk ids but has new text, so compare the text, not just the ids
        stale = [i for i, doc in zip(stored["ids"], stored["documents"]) if current.get(i) != doc]
        for k in range(0, len(stale), 2000):
            index.collection.delete(ids=stale[k:k + 2000])
        if stale:
            print(f"removed {len(stale)} stale chunks", flush=True)
    index.build(records)
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
