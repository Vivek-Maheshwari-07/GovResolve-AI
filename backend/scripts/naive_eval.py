"""Score the app on everyday-wording questions (data/eval/naive_questions.json) against a running server.

    python -m backend.scripts.naive_eval --base http://127.0.0.1:8000 --label rewrite_on [--out data/eval]

Start the server with ANSWER_CACHE= (empty) so earlier answers are not replayed, and with QUERY_REWRITE=on or off to compare.
Reports, by kind: in_corpus answered from the expected document / answered from another document / refused; not_in_corpus refused
(a false answer is the thing to avoid); unknown: outcome only; vague: TOO_VAGUE with questions to click. Also how many refusals
carried pointers to documents or questions to click. Expected documents come from gold_questions.json (`gold_from`).
The questions are drafted, not officer-validated; read the `unknown` answers by hand.
"""
from __future__ import annotations

import argparse
import json
import time
import urllib.request
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def ask(base: str, question: str, timeout: int = 180) -> tuple[dict, float]:
    req = urllib.request.Request(f"{base}/query", json.dumps({"question": question}).encode(), {"Content-Type": "application/json"})
    t0 = time.perf_counter()
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r), time.perf_counter() - t0


def score(base: str, label: str, out_dir: Path) -> dict:
    qs = json.loads((ROOT / "data/eval/naive_questions.json").read_text(encoding="utf-8"))["questions"]
    gold_all = json.loads((ROOT / "data/eval/gold_questions.json").read_text(encoding="utf-8"))
    gold = {q["question_id"]: {d["doc_id"] for d in q["gold_docs"]} for q in gold_all}
    rows = []
    for q in qs:
        try:
            r, sec = ask(base, q["question"])
        except Exception as e:  # keep going: one failure must not hide the rest
            rows.append({"id": q["id"], "kind": q["kind"], "question": q["question"], "outcome": "error", "error": f"{type(e).__name__}: {e}"})
            continue
        answered = r.get("verdict") == "answered"
        cited = {c["doc_id"] for c in r.get("citations", [])}
        want = gold.get(q.get("gold_from", ""), set())
        if answered:
            outcome = "answered_expected_doc" if want and cited & want else "answered_other_doc"
        else:
            outcome = "refused_with_pointers" if (r.get("suggestions") or r.get("follow_up_options")) else "refused_bare"
        rows.append({"id": q["id"], "kind": q["kind"], "question": q["question"], "outcome": outcome, "code": r.get("reason_code"),
                     "seconds": round(sec, 1), "cited": sorted(cited), "answer": (r.get("answer") or "")[:240],
                     "suggestions": [s.get("gr_number") or s["doc_id"] for s in r.get("suggestions", [])],
                     "options": len(r.get("follow_up_options", []))})
    by = {k: Counter(r["outcome"] for r in rows if r["kind"] == k) for k in ("in_corpus", "not_in_corpus", "unknown", "vague")}
    vague_ok = sum(1 for r in rows if r["kind"] == "vague" and r.get("code") == "TOO_VAGUE" and r.get("options", 0) > 0)
    secs = sorted(r["seconds"] for r in rows if "seconds" in r)
    summary = {"label": label, "n": len(rows), "by_kind": {k: dict(v) for k, v in by.items()}, "vague_too_vague_with_options": vague_ok,
               "refusals_with_pointers": sum(1 for r in rows if r["outcome"] == "refused_with_pointers"),
               "refusals_bare": sum(1 for r in rows if r["outcome"] == "refused_bare"),
               "median_seconds": secs[len(secs) // 2] if secs else None}
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / f"naive_scorecard_{label}.json").write_text(json.dumps({"summary": summary, "rows": rows}, ensure_ascii=False, indent=1), encoding="utf-8")
    return summary


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:8000")
    ap.add_argument("--label", default="run")
    ap.add_argument("--out", default=str(ROOT / "data/eval"))
    a = ap.parse_args()
    print(json.dumps(score(a.base, a.label, Path(a.out)), indent=1))
