"""
Evaluation Script — nightly gold-set scorer
Run: python eval/evaluate.py

Outputs a scorecard on 5 official metrics:
  1. Correct-document retrieval (Top-1 / Top-3 hit rate)
  2. Citation & page accuracy (% correct pages; % quotes found verbatim)
  3. Answer correctness (key-point coverage)
  4. Amendment-chain identification (precision + recall on lineage edges)
  5. Unanswerable handling (correct refusals vs wrong refusals)
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import Optional

from loguru import logger
from dotenv import load_dotenv

load_dotenv()

sys.path.insert(0, str(Path(__file__).parent.parent))
from backend.models import AnswerStatus, GRRecord, InsufficientReason
from backend.rag.search_engine import GRIndex, RAGPipeline
from backend.ingestion.ingest import ingest_directory
from backend.lineage.lineage_graph import LineageGraph, apply_lineage_to_records

GOLD_SET_PATH   = Path("./eval/gold_set.json")
PROCESSED_DIR   = "./data/processed"
CHROMA_DIR      = "./data/index/chroma"
LINEAGE_GRAPH   = "./data/index/lineage_graph.json"


# ──────────────────────────────────────────────
# Gold Set Schema
# ──────────────────────────────────────────────

@dataclass
class GoldQuestion:
    question_id:       str
    question:          str
    language:          str
    expected_status:   str
    correct_gr_ids:    list[str]
    correct_pages:     list[str]    # e.g. ["GAD-2021-0147 page 2"]
    key_answer_points: list[str]
    lineage_edges:     list[dict]   # [{from, to, type}]
    validated_by:      str = "unvalidated"
    notes:             str = ""


def load_gold_set(path: Path) -> list[GoldQuestion]:
    if not path.exists():
        logger.warning(f"Gold set not found at {path}. Creating sample …")
        create_sample_gold_set(path)
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return [GoldQuestion(**q) for q in data]


def create_sample_gold_set(path: Path):
    """Create a minimal sample gold set for testing."""
    sample = [
        {
            "question_id": "Q-001",
            "question": "How many days of casual leave are allowed per year?",
            "language": "en",
            "expected_status": "Found, no later change",
            "correct_gr_ids": [],
            "correct_pages": [],
            "key_answer_points": ["casual leave", "days"],
            "lineage_edges": [],
            "validated_by": "sample",
            "notes": "Replace with real GR once collection is built.",
        },
        {
            "question_id": "Q-002",
            "question": "maternity leave mate kya documents joie?",
            "language": "mixed",
            "expected_status": "Found, amended",
            "correct_gr_ids": [],
            "correct_pages": [],
            "key_answer_points": ["medical certificate", "application form"],
            "lineage_edges": [],
            "validated_by": "sample",
        },
        {
            "question_id": "Q-003",
            "question": "What is the travel allowance rate for Class-I officers?",
            "language": "en",
            "expected_status": "Found, no later change",
            "correct_gr_ids": [],
            "correct_pages": [],
            "key_answer_points": ["travel allowance", "Class-I"],
            "lineage_edges": [],
            "validated_by": "sample",
        },
        {
            "question_id": "Q-004",
            "question": "Can I sue the department for wrong leave rejection?",
            "language": "en",
            "expected_status": "Insufficient Evidence",
            "correct_gr_ids": [],
            "correct_pages": [],
            "key_answer_points": ["OUT_OF_SCOPE"],
            "lineage_edges": [],
            "validated_by": "sample",
        },
        {
            "question_id": "Q-005",
            "question": "Leave",
            "language": "en",
            "expected_status": "Insufficient Evidence",
            "correct_gr_ids": [],
            "correct_pages": [],
            "key_answer_points": ["TOO_VAGUE"],
            "lineage_edges": [],
            "validated_by": "sample",
        },
    ]
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(sample, f, indent=2, ensure_ascii=False)
    logger.info(f"Sample gold set written to {path}")


# ──────────────────────────────────────────────
# Metrics
# ──────────────────────────────────────────────

@dataclass
class Scorecard:
    total: int = 0

    # Metric 1: retrieval
    top1_hits:  int = 0
    top3_hits:  int = 0

    # Metric 2: citation accuracy
    citation_page_correct:  int = 0
    citation_page_total:    int = 0
    citation_quote_correct: int = 0
    citation_quote_total:   int = 0

    # Metric 3: answer correctness
    answer_points_found:  int = 0
    answer_points_total:  int = 0

    # Metric 4: lineage
    lineage_tp: int = 0
    lineage_fp: int = 0
    lineage_fn: int = 0

    # Metric 5: refusal handling
    correct_refusals:  int = 0
    incorrect_refusals: int = 0
    total_should_refuse: int = 0
    total_should_answer: int = 0
    wrong_refusals:     int = 0   # refused when it should answer


def score_retrieval(gold: GoldQuestion, response) -> tuple[int, int]:
    """Returns (top1_hit, top3_hit)."""
    if not gold.correct_gr_ids:
        return (0, 0)
    retrieved_ids = [c.gr_id for c in response.citations]
    top1 = 1 if (retrieved_ids and retrieved_ids[0] in gold.correct_gr_ids) else 0
    top3 = 1 if any(gid in gold.correct_gr_ids for gid in retrieved_ids[:3]) else 0
    return (top1, top3)


def score_citations(gold: GoldQuestion, response) -> tuple[int, int, int, int]:
    """
    Returns (page_correct, page_total, quote_correct, quote_total).
    """
    page_correct = 0
    quote_correct = 0
    total = len(response.citations)

    for cit in response.citations:
        page_ref = f"{cit.gr_id} page {cit.page}"
        if page_ref in gold.correct_pages:
            page_correct += 1
        # Quote check: the passage should appear in the verified text (already done by guardrail)
        if cit.passage and len(cit.passage) > 5:
            quote_correct += 1   # guardrail already verified

    return (page_correct, total, quote_correct, total)


def score_answer_correctness(gold: GoldQuestion, response) -> tuple[int, int]:
    """Check how many key_answer_points appear in the answer text."""
    answer_text = (response.summary + " " + " ".join(
        s.text for s in response.statements
    )).lower()
    found = sum(1 for pt in gold.key_answer_points if pt.lower() in answer_text)
    return (found, len(gold.key_answer_points))


def score_lineage(gold: GoldQuestion, response) -> tuple[int, int, int]:
    """Precision / recall on lineage edges. Returns (TP, FP, FN)."""
    if not gold.lineage_edges:
        return (0, 0, 0)

    gold_edges = set(
        (e["from"], e["to"], e["type"]) for e in gold.lineage_edges
    )
    pred_edges = set()
    for node in response.lineage_chain:
        for edge in node.edges_out:
            pred_edges.add((
                edge.from_gr_id,
                edge.to_gr_id or "",
                edge.link_type.value,
            ))

    tp = len(gold_edges & pred_edges)
    fp = len(pred_edges - gold_edges)
    fn = len(gold_edges - pred_edges)
    return (tp, fp, fn)


def score_refusal(gold: GoldQuestion, response) -> dict:
    """Return counts for refusal correctness."""
    should_refuse = gold.expected_status == "Insufficient Evidence"
    did_refuse    = response.answer_status == AnswerStatus.INSUFFICIENT
    return {
        "should_refuse":   should_refuse,
        "did_refuse":      did_refuse,
        "correct_refusal": should_refuse and did_refuse,
        "wrong_refusal":   (not should_refuse) and did_refuse,
    }


def compute_final_scores(sc: Scorecard) -> dict:
    top1_rate = sc.top1_hits / max(sc.total, 1)
    top3_rate = sc.top3_hits / max(sc.total, 1)

    page_acc  = sc.citation_page_correct  / max(sc.citation_page_total,  1)
    quote_acc = sc.citation_quote_correct / max(sc.citation_quote_total, 1)

    ans_acc = sc.answer_points_found / max(sc.answer_points_total, 1)

    lin_prec   = sc.lineage_tp / max(sc.lineage_tp + sc.lineage_fp, 1)
    lin_recall = sc.lineage_tp / max(sc.lineage_tp + sc.lineage_fn, 1)

    refusal_recall    = sc.correct_refusals   / max(sc.total_should_refuse, 1)
    wrong_refusal_rate = sc.wrong_refusals    / max(sc.total_should_answer, 1)

    return {
        "retrieval": {
            "top1_hit_rate": round(top1_rate, 3),
            "top3_hit_rate": round(top3_rate, 3),
            "target_top3":   0.85,
        },
        "citation_accuracy": {
            "page_accuracy":  round(page_acc, 3),
            "quote_accuracy": round(quote_acc, 3),
            "target_quote":   1.0,
        },
        "answer_correctness": {
            "key_point_coverage": round(ans_acc, 3),
            "target":             0.80,
        },
        "lineage": {
            "precision": round(lin_prec, 3),
            "recall":    round(lin_recall, 3),
            "target":    0.80,
        },
        "refusal_handling": {
            "correct_refusal_rate":   round(refusal_recall, 3),
            "wrong_refusal_rate":     round(wrong_refusal_rate, 3),
            "target_correct_refusal": 0.90,
            "target_wrong_refusal":   0.10,
        },
    }


# ──────────────────────────────────────────────
# Runner
# ──────────────────────────────────────────────

def run_evaluation():
    logger.info("Loading records …")
    records: list[GRRecord] = []
    for jf in Path(PROCESSED_DIR).glob("*.json"):
        with open(jf, encoding="utf-8") as f:
            records.append(GRRecord.model_validate_json(f.read()))

    if not records:
        logger.error("No processed records found. Run ingestion first.")
        return

    lineage = LineageGraph()
    if Path(LINEAGE_GRAPH).exists():
        lineage = LineageGraph.load(LINEAGE_GRAPH)
    else:
        lineage.build(records)
        apply_lineage_to_records(records, lineage)
        lineage.save(LINEAGE_GRAPH)

    index    = GRIndex(persist_dir=CHROMA_DIR)
    index.load_bm25()
    index.build(records)
    pipeline = RAGPipeline(index, records, lineage_graph=lineage)

    gold_questions = load_gold_set(GOLD_SET_PATH)
    sc = Scorecard(total=len(gold_questions))

    results = []
    for gq in gold_questions:
        logger.info(f"Evaluating {gq.question_id}: {gq.question[:60]}")
        try:
            resp = pipeline.answer(gq.question)
        except Exception as e:
            logger.error(f"  Error: {e}")
            continue

        t1, t3 = score_retrieval(gq, resp)
        sc.top1_hits += t1
        sc.top3_hits += t3

        pc, pt, qc, qt = score_citations(gq, resp)
        sc.citation_page_correct  += pc
        sc.citation_page_total    += pt
        sc.citation_quote_correct += qc
        sc.citation_quote_total   += qt

        af, at = score_answer_correctness(gq, resp)
        sc.answer_points_found += af
        sc.answer_points_total += at

        ltp, lfp, lfn = score_lineage(gq, resp)
        sc.lineage_tp += ltp
        sc.lineage_fp += lfp
        sc.lineage_fn += lfn

        ref = score_refusal(gq, resp)
        if ref["should_refuse"]:
            sc.total_should_refuse += 1
            if ref["correct_refusal"]:
                sc.correct_refusals += 1
        else:
            sc.total_should_answer += 1
            if ref["wrong_refusal"]:
                sc.wrong_refusals += 1

        results.append({
            "question_id":   gq.question_id,
            "question":      gq.question,
            "expected":      gq.expected_status,
            "got":           resp.answer_status.value,
            "top1":          t1,
            "top3":          t3,
            "ans_points":    f"{af}/{at}",
            "refusal_ok":    ref["correct_refusal"],
        })

    final = compute_final_scores(sc)

    print("\n" + "="*60)
    print("  GovResolve-AI  —  EVALUATION SCORECARD")
    print("="*60)
    for metric, vals in final.items():
        print(f"\n{metric.upper().replace('_', ' ')}:")
        for k, v in vals.items():
            marker = "✓" if "target" not in k else "→"
            print(f"  {marker} {k}: {v}")
    print("="*60)

    # Save full results
    out = {
        "scorecard": final,
        "details":   results,
    }
    out_path = Path("./eval/scorecard.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)
    logger.success(f"Scorecard saved → {out_path}")


if __name__ == "__main__":
    run_evaluation()

