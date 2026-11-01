"""
CLI tool to quickly add GR PDFs and verify the pipeline.

Usage:
  python scripts/add_gr.py path/to/file.pdf           # ingest one PDF
  python scripts/add_gr.py --dir path/to/grs/          # ingest all PDFs in a dir
  python scripts/add_gr.py --query "maternity leave"   # test a query
  python scripts/add_gr.py --eval                      # run evaluation
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.ingestion.ingest import ingest_pdf, ingest_directory
from backend.lineage.lineage_graph import LineageGraph, apply_lineage_to_records
from backend.rag.search_engine import GRIndex, RAGPipeline
from backend.models import GRRecord

import json
from loguru import logger

PROCESSED_DIR = "./data/processed"
CHROMA_DIR    = "./data/index/chroma"
LINEAGE_GRAPH = "./data/index/lineage_graph.json"


def load_all_records():
    records = []
    for jf in Path(PROCESSED_DIR).glob("*.json"):
        with open(jf, encoding="utf-8") as f:
            records.append(GRRecord.model_validate_json(f.read()))
    return records


def rebuild_index(records):
    lineage = LineageGraph()
    lineage.build(records)
    apply_lineage_to_records(records, lineage)
    lineage.save(LINEAGE_GRAPH)

    index = GRIndex(persist_dir=CHROMA_DIR)
    index.build(records)
    return index, lineage


def main():
    parser = argparse.ArgumentParser(description="GovResolve-AI CLI")
    parser.add_argument("file", nargs="?", help="PDF file to ingest")
    parser.add_argument("--dir",   help="Directory of PDFs to ingest")
    parser.add_argument("--query", help="Test a query against the index")
    parser.add_argument("--eval",  action="store_true", help="Run evaluation")
    parser.add_argument("--rebuild", action="store_true", help="Rebuild index only")
    args = parser.parse_args()

    if args.file:
        logger.info(f"Ingesting {args.file} …")
        rec = ingest_pdf(args.file, processed_dir=PROCESSED_DIR)
        logger.success(f"Ingested: {rec.gr_id} | {rec.subject[:60]}")
        records = load_all_records()
        idx, lin = rebuild_index(records)
        logger.success(f"Index rebuilt: {len(records)} GRs")

    elif args.dir:
        logger.info(f"Ingesting directory {args.dir} …")
        ingest_directory(args.dir, PROCESSED_DIR)
        records = load_all_records()
        idx, lin = rebuild_index(records)
        logger.success(f"Index rebuilt: {len(records)} GRs")

    elif args.rebuild:
        records = load_all_records()
        idx, lin = rebuild_index(records)
        logger.success(f"Index rebuilt: {len(records)} GRs")

    elif args.query:
        records = load_all_records()
        if not records:
            logger.error("No records. Ingest GRs first.")
            return
        lineage = LineageGraph()
        if Path(LINEAGE_GRAPH).exists():
            lineage = LineageGraph.load(LINEAGE_GRAPH)
        index = GRIndex(persist_dir=CHROMA_DIR)
        index.load_bm25()
        pipeline = RAGPipeline(index, records, lineage_graph=lineage)
        response = pipeline.answer(args.query)
        print(f"\n{'='*60}")
        print(f"Question: {args.query}")
        print(f"Status:   {response.answer_status.value}")
        if response.insufficient_reason:
            print(f"Reason:   {response.insufficient_reason.value}")
        print(f"\nSummary:\n{response.summary}")
        if response.citations:
            print("\nCitations:")
            for c in response.citations:
                print(f"  • {c.gr_number} | {c.issue_date} | p.{c.page}")
                print(f"    \"{c.passage[:100]}\"")
        if response.follow_up_question:
            print(f"\nFollow-up: {response.follow_up_question}")
        print("="*60)

    elif args.eval:
        from eval.evaluate import run_evaluation
        run_evaluation()

    else:
        parser.print_help()


if __name__ == "__main__":
    main()

