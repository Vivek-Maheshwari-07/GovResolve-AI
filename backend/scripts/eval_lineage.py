"""Precision/recall of detected lineage edges against eval/gold_lineage.csv.

Usage (from backend/):  python -m scripts.eval_lineage [--gold ../eval/gold_lineage.csv]
"""
import argparse
import csv
import sys
from pathlib import Path

import networkx as nx

from app.config import ROOT, settings
from app.state import AppState


def _clauses(s: str | None) -> frozenset[str]:
    return frozenset(x.strip() for x in (s or "").split(";") if x.strip())


def load_gold(path: Path) -> set[tuple]:
    with open(path, newline="", encoding="utf-8") as f:
        return {(r["source_gr"], r["target_gr"], r["rel_type"], _clauses(r.get("target_clauses")))
                for r in csv.DictReader(f)}


def _ratio(n: int, d: int):
    return round(n / d, 3) if d else None


def score(detected: list, gold: set[tuple]) -> dict:
    loose_gold = {g[:3] for g in gold}

    def pr(edges):
        loose = {(e.source_gr, e.target_gr, e.rel_type.value) for e in edges if e.target_gr}
        strict = {(e.source_gr, e.target_gr, e.rel_type.value, frozenset(e.target_clauses))
                  for e in edges if e.target_gr}
        tp, stp = len(loose & loose_gold), len(strict & gold)
        return {"detected": len(loose), "precision": _ratio(tp, len(loose)), "recall": _ratio(tp, len(loose_gold)),
                "strict_precision": _ratio(stp, len(strict)), "strict_recall": _ratio(stp, len(gold))}

    changing = [e for e in detected if e.rel_type.value != "REFERS"]
    g = nx.DiGraph([(e.source_gr, e.target_gr) for e in changing if e.target_gr])
    longest = nx.dag_longest_path_length(g) if g.number_of_edges() and nx.is_directed_acyclic_graph(g) else 0
    return {
        "gold_edges": len(gold),
        "EXPLICIT": pr([e for e in changing if e.confidence.value == "EXPLICIT"]),
        "PROBABLE": pr([e for e in changing if e.confidence.value == "PROBABLE"]),
        "ALL": pr(changing),
        "longest_chain_hops": longest,
        "broken_links": sum(1 for e in detected if e.target_gr is None),
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--gold", type=Path, default=ROOT / "eval" / "gold_lineage.csv")
    args = ap.parse_args()
    st = AppState.create(settings, persist_vectors=False)
    res = score(st.lineage.edges(), load_gold(args.gold))
    print(f"engine: {st.lineage_kind}   gold edges: {res['gold_edges']}")
    for k in ("EXPLICIT", "PROBABLE", "ALL"):
        print(f"{k:9}", res[k])
    print("longest chain (hops):", res["longest_chain_hops"], "  broken links:", res["broken_links"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
