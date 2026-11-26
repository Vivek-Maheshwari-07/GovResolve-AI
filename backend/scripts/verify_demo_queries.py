"""Run the 36 official demo queries against a live server and record what each one really returns.

Usage (server running, e.g. `python run.py`):
    python -m scripts.verify_demo_queries [--base http://127.0.0.1:8000] [--out ../data/eval/demo_verification.json]

The questions, expected documents, pages and key points come from data/eval/gold_questions.json and
data/eval/heldout_questions.json (the same IDs as the Seva First official test query suite).

Grading, per query:
  answerable   PASS     answered, an expected document cited on its expected page, every key point in the answer
               PARTIAL  answered and an expected document cited, but a page or key point is missing
               FAIL     refused, an error, or none of the expected documents cited
  unanswerable PASS     refused with the expected reason code
               PARTIAL  refused with a different reason code
               FAIL     answered
  amended      a PASS needs the amended / superseded status and real lineage edges; otherwise it becomes PARTIAL
"""
import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EVAL = ROOT / "data" / "eval"

SUITE = {
    "en": "Q-001 Q-003 Q-005 Q-007 Q-009 Q-011 Q-013 Q-015 Q-017 Q-019 Q-026 Q-029",
    "gu": "Q-002 Q-008 Q-012 Q-016 Q-028 Q-044 Q-046 Q-048 Q-050 H-001 H-002 H-011",
    "mixed": "Q-004 Q-006 Q-010 Q-014 Q-018 Q-024 Q-027 Q-047 Q-049 H-004 H-007 Q-031",
}
SUITE_IDS = [q for group in SUITE.values() for q in group.split()]


def load_questions() -> dict:
    rows = {}
    for name in ("gold_questions.json", "heldout_questions.json"):
        for r in json.loads((EVAL / name).read_text(encoding="utf-8")):
            rows[r["question_id"]] = r
    missing = [q for q in SUITE_IDS if q not in rows]
    if missing:
        raise SystemExit(f"questions not found in the eval sets: {missing}")
    return rows


def http_json(url: str, body: dict | None = None, timeout: float = 240):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"} if data else {})
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return json.loads(res.read().decode("utf-8"))


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").lower()).strip()


def overall_status(resp: dict) -> str:
    """The status the UI shows: the worst lineage status among the citations, or insufficient."""
    if resp.get("verdict") != "answered":
        return "insufficient"
    seen = [((c.get("lineage") or {}).get("status")) for c in resp.get("citations") or []]
    if "superseded" in seen:
        return "superseded"
    if "amended" in seen:
        return "amended"
    return "no_change"


def grade(q: dict, resp: dict | None, lineage_edges: int, error: str | None) -> tuple[str, list[str]]:
    notes = []
    if error:
        return "FAIL", [error]
    answered = resp.get("verdict") == "answered"
    if q["expected_verdict"] == "insufficient_evidence":
        if answered:
            return "FAIL", ["answered a question the collection cannot answer"]
        if q.get("expected_reason_code") and resp.get("reason_code") != q["expected_reason_code"]:
            return "PARTIAL", [f"refused with {resp.get('reason_code')}, expected {q['expected_reason_code']}"]
        return "PASS", [f"refused with {resp.get('reason_code')}"]

    if not answered:
        return "FAIL", [f"refused ({resp.get('reason_code')}): {(resp.get('reason') or '')[:120]}"]
    cits = resp.get("citations") or []
    gold = {(g["doc_id"], g.get("page")) for g in q.get("gold_docs") or []}
    gold_docs = {d for d, _ in gold}
    doc_hit = any(c.get("doc_id") in gold_docs for c in cits)
    page_hit = any((c.get("doc_id"), c.get("page")) in gold for c in cits)
    text = norm(resp.get("answer") or "") + " " + " ".join(norm(s.get("text", "")) for s in resp.get("statements") or [])
    missing = [group[0] for group in q.get("key_points") or [] if not any(norm(v) in text for v in group)]
    if not doc_hit:
        return "FAIL", ["expected document not cited"]
    status = "PASS"
    if not page_hit:
        status = "PARTIAL"
        notes.append("expected document cited on a different page")
    if missing:
        status = "PARTIAL"
        notes.append("key point missing from the answer: " + ", ".join(missing))
    if q.get("category") == "amended":
        st = overall_status(resp)
        if st not in ("amended", "superseded") or lineage_edges == 0:
            if status == "PASS":
                status = "PARTIAL"
            notes.append(f"amended case shows status {st} with {lineage_edges} lineage edges")
    if (resp.get("answer") or "").lower().startswith("retrieval-only answer"):
        status = "FAIL" if status == "FAIL" else "PARTIAL"
        notes.append("retrieval-only fallback, no answer engine")
    return status, notes


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:8000")
    ap.add_argument("--out", type=Path, default=EVAL / "demo_verification.json")
    ap.add_argument("--only", nargs="*", help="run only these IDs")
    args = ap.parse_args()

    questions = load_questions()
    health = http_json(f"{args.base}/health", timeout=30)
    ids = args.only or SUITE_IDS
    results = []
    for qid in ids:
        q = questions[qid]
        lang = next(k for k, v in SUITE.items() if qid in v.split())
        t = time.time()
        resp, error = None, None
        try:
            resp = http_json(f"{args.base}/query", {"question": q["question"]})
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            error = f"request failed: {e}"
        latency = round(time.time() - t, 1)
        cits = (resp or {}).get("citations") or []
        first = cits[0] if cits else None
        edges = 0
        if first:
            try:
                g = http_json(f"{args.base}/lineage/{urllib.request.quote(first['doc_id'], safe='')}", timeout=60)
                edges = len(g.get("edges") or [])
            except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
                edges = 0
        verdict, notes = grade(q, resp, edges, error)
        bbox_ok = bool(first and isinstance(first.get("bbox"), list) and len(first["bbox"]) == 4)
        gold = {(g["doc_id"], g.get("page")) for g in q.get("gold_docs") or []}
        row = {
            "id": qid,
            "language": lang,
            "category": q.get("category"),
            "question": q["question"],
            "result": verdict,
            "status": overall_status(resp) if resp else "error",
            "reason_code": (resp or {}).get("reason_code"),
            "expected_verdict": q["expected_verdict"],
            "cited": [f"{c.get('doc_id')} p.{c.get('page')}" for c in cits],
            "expected": [f"{d} p.{p}" for d, p in sorted(gold)],
            "expected_page_cited": any((c.get("doc_id"), c.get("page")) in gold for c in cits),
            "verbatim_quote": bool(first and (first.get("quote") or "").strip()),
            "bbox": bbox_ok,
            "lineage_edges": edges,
            "latency_s": latency,
            "answer": ((resp or {}).get("answer") or (resp or {}).get("reason") or error or "")[:400],
            "warnings": (resp or {}).get("warnings") or [],
            "notes": notes,
        }
        results.append(row)
        print(f"{qid:6} {lang:5} {verdict:7} {row['status']:12} {latency:6.1f}s  {'; '.join(notes)[:100]}", flush=True)

    out = {"health": {k: health.get(k) for k in ("gr_count", "chunk_count", "edge_count", "lineage_engine", "vector_count")},
           "ran_at": time.strftime("%Y-%m-%d %H:%M"), "results": results}
    args.out.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    n = len(results)
    counts = {k: sum(r["result"] == k for r in results) for k in ("PASS", "PARTIAL", "FAIL")}
    print(f"\n{counts} of {n} -> {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
