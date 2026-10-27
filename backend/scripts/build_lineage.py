"""Run the lineage engine over the whole corpus and dump every edge to a CSV for hand-checking.

Usage (from backend/):  python -m scripts.build_lineage [--corpus DIR] [--out edges.csv] [--save-db]
"""
import argparse
import csv
import sys
from collections import Counter
from pathlib import Path

from app.config import ROOT, settings
from app.lineage import LineageService
from app.store.corpus import Corpus
from app.store.db import Database

COLUMNS = ["edge_id", "source_gr", "rel_type", "target_gr", "confidence", "method", "scope", "target_clauses",
           "target_ref_text", "evidence_chunk_id", "evidence_text"]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus", type=Path, default=settings.corpus_dir)
    ap.add_argument("--out", type=Path, default=ROOT / "data" / "edges_detected.csv")
    ap.add_argument("--save-db", action="store_true", help="also store the edges in the SQLite database")
    args = ap.parse_args()

    corpus = Corpus.load(args.corpus)
    for bad in corpus.errors:
        print("BAD FILE:", bad["file"], "-", bad["error"][:120])
    db = Database(settings.db_path)
    svc = LineageService(corpus, cache=db)
    edges = svc.edges()

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with open(args.out, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(COLUMNS)
        for e in sorted(edges, key=lambda e: (e.source_gr, e.rel_type.value, e.target_gr or "")):
            d = e.model_dump(mode="json")
            d["target_clauses"] = ";".join(e.target_clauses)
            w.writerow([d[c] for c in COLUMNS])
    if args.save_db:
        db.save_edges(edges)

    print(f"{len(corpus.grs)} GRs, {len(edges)} edges -> {args.out}")
    print("by type:      ", dict(Counter(e.rel_type.value for e in edges)))
    print("by confidence:", dict(Counter(e.confidence.value for e in edges)))
    print("broken links: ", len(svc.broken_links()), "  cycles:", len(svc.cycles()))
    print("status:       ", dict(Counter(svc.gr_status(g).value for g in corpus.grs)))
    if svc.review_items:
        print(f"\n{len(svc.review_items)} sentences need manual review:")
        for r in svc.review_items:
            print(f"  [{r['kind']}] {r['gr_id']}: {r['sentence'][:140]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
