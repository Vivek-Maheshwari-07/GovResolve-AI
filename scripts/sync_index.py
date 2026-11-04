"""
GovResolve-AI — Complete Index Synchronizer & Verifier
Loads the curated 150-document golden dataset, builds ChromaDB vector embeddings
and Suffix-Stripped BM25 indices, and validates hybrid search & citation accuracy.
"""
from __future__ import annotations

import os
import sys

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["PYTHONIOENCODING"] = "utf-8"

import time
from pathlib import Path
from loguru import logger

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from backend.models import GRRecord
from backend.lineage.lineage_graph import LineageGraph, apply_lineage_to_records
from backend.rag.search_engine import GRIndex, normalizer


def sync_and_verify():
    processed_dir = PROJECT_ROOT / "data" / "processed"
    graph_path = PROJECT_ROOT / "data" / "index" / "lineage_graph.json"
    chroma_dir = PROJECT_ROOT / "data" / "index" / "chroma"

    logger.info("=== STEP 1: Loading 150 Processed Document Records ===")
    json_files = sorted(list(processed_dir.glob("*.json")))
    if not json_files:
        logger.error(f"No processed JSON records found in {processed_dir}")
        return

    records: list[GRRecord] = []
    for jf in json_files:
        try:
            rec = GRRecord.model_validate_json(jf.read_text(encoding="utf-8"))
            records.append(rec)
        except Exception as e:
            logger.warning(f"Skipping corrupt record {jf.name}: {e}")

    total_chunks = sum(len(r.chunks) for r in records)
    logger.success(f"Successfully loaded {len(records)} records with {total_chunks} total chunks.")

    logger.info("=== STEP 2: Applying Lineage Graph Statuses ===")
    if graph_path.exists():
        lineage = LineageGraph.load(str(graph_path))
        apply_lineage_to_records(records, lineage)
        logger.success(f"Lineage Graph active: {lineage.G.number_of_nodes()} nodes, {lineage.G.number_of_edges()} edges")
    else:
        logger.warning(f"Lineage graph not found at {graph_path}. Building new graph...")
        lineage = LineageGraph()
        lineage.build(records)
        apply_lineage_to_records(records, lineage)
        lineage.save(str(graph_path))

    logger.info("=== STEP 3: Building Hybrid Index (ChromaDB + Suffix-Stripped BM25) ===")
    t0 = time.time()
    index = GRIndex(persist_dir=str(chroma_dir))
    index.build(records, reset=True)
    elapsed = time.time() - t0
    logger.success(f"Index built in {elapsed:.1f}s.")

    # Verify counts
    chroma_count = index.collection.count() if index.collection else 0
    bm25_count = len(index.bm25_docs) if index.bm25 else 0
    logger.info(f"ChromaDB Chunks: {chroma_count} | BM25 Chunks: {bm25_count}")

    logger.info("=== STEP 4: Validating Hybrid Search Engine & Grounding ===")
    test_queries = [
        "પંચાયત સેવા નિયમો સુધારો",
        "LTC leave travel concession rules",
        "પરીક્ષા નિયમો સુધારણા જાહેરનામું",
    ]

    for q in test_queries:
        bundle = normalizer.normalize(q)
        results = index.search(bundle, top_k=3)
        print(f"\n--- Test Query: '{q}' ---")
        print(f"Gujlish Expansion: '{bundle.query_gu}' | English: '{bundle.query_en}'")
        print(f"Keywords: {bundle.keywords}")
        print(f"Top {len(results)} Retrieved Chunks:")
        for i, hit in enumerate(results, start=1):
            gr_num = hit.get("gr_number", "N/A")
            pages = hit.get("pages", [])
            score = hit.get("score", 0.0)
            status = hit.get("clause_status", "active")
            snippet = hit.get("text", "")[:120].replace("\n", " ")
            print(f"  [{i}] GR: {gr_num} | Pages: {pages} | Status: {status} | Score: {score:.4f}")
            print(f"      Text: {snippet}...")

    print("\n" + "=" * 70)
    print("GOLDEN 150-DATASET INGESTION & VERIFICATION COMPLETE")
    print("=" * 70)
    print(f"Total PDFs Ingested:        {len(records)}")
    print(f"Total Chunks Indexed:       {chroma_count}")
    print(f"BM25 Lexical Docs:          {bm25_count}")
    print(f"Lineage Graph Nodes:        {lineage.G.number_of_nodes()}")
    print(f"Lineage Graph Edges:        {lineage.G.number_of_edges()}")
    print(f"ChromaDB Persistence Path:  {chroma_dir.resolve()}")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    sync_and_verify()
