"""Scorecard on the five official metrics, over the gold questions in eval/gold_questions.json.

Usage (from backend/, with the repo .venv; Ollama running for --mode full):
    python -m scripts.scorecard --corpus D:/test/corpus_v2 --index ../data/index/chroma --mode retrieval
    python -m scripts.scorecard --corpus D:/test/corpus_v2 --index ../data/index/chroma --mode full [--category simple] [--limit 5]

--mode retrieval  metrics 1 and 4 plus the guard-based refusals; no language model, takes about a minute.
--mode full       also asks every question through /query (metrics 2, 3, 5); about 40 s per question on a CPU model.

Metrics
  1. Retrieval: top-1 / top-3 hit rate (is a gold document the first / among the first three documents the search returns).
  2. Citations: share whose (document, page) is a gold page, and share whose quote is verbatim on that page.
  3. Answer correctness: key-point coverage (all points present / average share), numbers compared in ASCII digits.
  4. Amendment chain: precision and recall of the engine's changing edges against eval/gold_lineage_verified.csv.
  5. Refusals: unanswerable and vague questions refused (and with the right reason code); answerable ones refused wrongly.
The gold questions are drafted from the document text and are NOT officer-validated; see each question's `validated_by`.
"""
import argparse
import csv
import json
import re
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
_GU_DIGITS = str.maketrans("૦૧૨૩૪૫૬૭૮૯", "0123456789")
ANSWERABLE = {"simple", "amended", "superseded"}
REFUSED = {"unanswerable", "vague"}


# ── pure helpers (unit-tested) ──────────────────────────────────────────────

def norm(text: str) -> str:
    """Comparable form: Gujarati digits as ASCII, lower case, punctuation and spacing dropped (OCR-tolerant)."""
    return re.sub(r"[^0-9a-z\u0a80-\u0aff]+", "", text.translate(_GU_DIGITS).lower())


_ORDINAL = {"st", "nd", "rd", "th"}


def tokens(text: str) -> list[str]:
    """Words and numbers, Gujarati digits as ASCII, ordinal suffixes dropped: '1st October, 2015' == ['1', 'october', '2015']."""
    found = re.findall(r"[0-9]+|[a-z]+|[઀-૿]+", text.translate(_GU_DIGITS).lower())
    return [t for t in found if t not in _ORDINAL]


def key_point_hits(answer: str, key_points: list) -> list[bool]:
    """One bool per key point; a point is a string or a list of alternatives (any one is enough).
    An alternative matches if it appears as written (ignoring case, spacing, punctuation) or, for two or more words, if all
    its words and numbers appear in the answer in any order, so 'October 1, 2015' satisfies '1st October, 2015'."""
    a, a_tokens = norm(answer), set(tokens(answer))

    def hit(alt: str) -> bool:
        t = tokens(alt)
        return norm(alt) in a or (len(t) >= 2 and set(t) <= a_tokens)

    return [any(hit(alt) for alt in ([kp] if isinstance(kp, str) else kp)) for kp in key_points]


def ranked_docs(chunks: list[dict]) -> list[str]:
    """Document ids in order of first appearance in a ranked chunk list."""
    seen, out = set(), []
    for c in chunks:
        gid = c["metadata"].get("gr_id")
        if gid not in seen:
            seen.add(gid)
            out.append(gid)
    return out


def retrieval_hit(ranked: list[str], gold_docs: set[str], k: int) -> bool:
    return bool(gold_docs & set(ranked[:k]))


def citation_checks(citations: list[dict], gold_pages: set[tuple[str, int]], page_text) -> tuple[int, int, int]:
    """(citations, citations on a gold page, citations whose quote is verbatim on the cited page).
    `page_text(doc_id, page)` returns the text of that page or ''."""
    on_gold = sum((c["doc_id"], c["page"]) in gold_pages for c in citations)
    verbatim = sum(bool(c["quote"]) and norm(c["quote"]) in norm(page_text(c["doc_id"], c["page"])) for c in citations)
    return len(citations), on_gold, verbatim


def refusal_outcome(q: dict, resp: dict) -> dict:
    """How a response compares with what the question expects."""
    refused = resp["verdict"] == "insufficient_evidence"
    want_refusal = q["expected_verdict"] == "insufficient_evidence"
    return {"refused": refused, "correct": refused == want_refusal,
            "code_ok": (not want_refusal) or (refused and resp.get("reason_code") == q.get("expected_reason_code"))}


def status_ok(q: dict, resp: dict) -> bool | None:
    """If the question expects a lineage status, did at least one citation carry one of them?"""
    want = q.get("expected_status_any")
    if not want:
        return None
    return any(c["lineage"]["status"] in want for c in resp.get("citations", []))


def rate(n: int, d: int):
    return round(n / d, 3) if d else None


def chain_scores(edges: list, gold_rows: list[dict]) -> dict:
    """Pair-level precision/recall of changing edges against the verified gold pairs (the engine edges are all resolved ones)."""
    gold = {(r["source_gr"], r["target_gr"]) for r in gold_rows}
    gold_docs = {d for pair in gold for d in pair}
    got = {(e.source_gr, e.target_gr) for e in edges if e.target_gr and e.rel_type.value != "REFERS"}
    inside = {p for p in got if p[0] in gold_docs or p[1] in gold_docs}   # edges touching a gold document
    tp = len(inside & gold)
    return {"gold_pairs": len(gold), "detected_touching_gold_docs": len(inside), "true_positive": tp,
            "precision": rate(tp, len(inside)), "recall": rate(tp, len(gold)),
            "edges_outside_gold": len(got - inside), "all_changing_edges": len(got)}


# ── runner ──────────────────────────────────────────────────────────────────

def load_gold(path: Path, category: str | None, limit: int | None, ids: str | None = None) -> list[dict]:
    qs = json.loads(path.read_text(encoding="utf-8"))
    if category:
        qs = [q for q in qs if q["category"] == category]
    if ids:
        qs = [q for q in qs if q["question_id"] in ids.split(",")]
    return qs[:limit] if limit else qs


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus", type=Path)
    ap.add_argument("--index", type=Path, default=ROOT / "data" / "index" / "chroma")
    ap.add_argument("--gold", type=Path, default=ROOT / "eval" / "gold_questions.json")
    ap.add_argument("--gold-lineage", type=Path, default=ROOT / "eval" / "gold_lineage_verified.csv")
    ap.add_argument("--mode", choices=["retrieval", "full"], default="retrieval")
    ap.add_argument("--category")
    ap.add_argument("--ids", help="comma-separated question ids, e.g. Q-001,Q-013")
    ap.add_argument("--rescore", type=Path, help="recompute the answer metrics of a saved full run with the current matcher (no model, no app)")
    ap.add_argument("--limit", type=int)
    ap.add_argument("--out", type=Path, default=ROOT / "eval" / "scorecard_latest.json")
    args = ap.parse_args()
    if args.rescore:
        return rescore(args.rescore, args.gold, args.out)
    if not args.corpus:
        ap.error("--corpus is required unless --rescore is given")

    import tempfile

    from fastapi.testclient import TestClient

    from app.config import Settings
    from app.graph import LineageGraph
    from app.main import create_app
    from app.squad2_runtime import LazySquad2Engine

    sys.path.insert(0, str(ROOT))
    questions = load_gold(args.gold, args.category, args.limit, args.ids)
    tmp = Path(tempfile.mkdtemp(prefix="scorecard_"))
    cfg = Settings(corpus_dir=args.corpus, db_path=tmp / "db.sqlite", vector_dir=tmp / "vec", embed_model="hash",
                   engine="squad2", squad2_index_dir=args.index)
    graph = LineageGraph()
    holder: dict = {}
    engine = LazySquad2Engine(lambda: getattr(holder["app"].state, "gov", None), graph, args.index)
    holder["app"] = app = create_app(cfg, engine=engine, graph=graph)
    results, t0 = [], time.time()
    with TestClient(app) as client:
        print(f"app up in {time.time() - t0:.0f}s; building the answer pipeline ...", flush=True)
        err = engine._ensure()
        if err:
            print("cannot build the pipeline:", err)
            return 1
        pipeline = engine._engine.pipeline
        state = app.state.gov
        from backend.rag.gujlish_normalizer import GujlishNormalizer
        normalizer = GujlishNormalizer()

        def page_text(doc_id: str, page: int) -> str:
            gr = state.corpus.grs.get(doc_id)
            return " ".join(c.text for c in gr.chunks if c.page == page) if gr else ""

        for n, q in enumerate(questions, 1):
            row = {"id": q["question_id"], "category": q["category"], "language": q["language"]}
            gold_docs = {d["doc_id"] for d in q.get("gold_docs", [])}
            gold_pages = {(d["doc_id"], d["page"]) for d in q.get("gold_docs", [])}
            if gold_docs:
                found = pipeline.index.search(normalizer.normalize(q["question"]), top_k=20)
                ranked = ranked_docs(found)
                row.update(top1=retrieval_hit(ranked, gold_docs, 1), top3=retrieval_hit(ranked, gold_docs, 3), ranked=ranked[:3])
                if q.get("key_points"):  # is the answer in the text the model would be given? (no model call)
                    evidence, _, _ = pipeline.build_evidence(q["question"], found)   # the pipeline passes every retrieved passage
                    row["answer_in_evidence"] = all(key_point_hits(evidence, q["key_points"]))
            if args.mode == "full":
                t = time.time()
                resp = client.post("/query", json={"question": q["question"]}).json()
                row["seconds"] = round(time.time() - t, 1)
                row["verdict"], row["reason_code"] = resp["verdict"], resp.get("reason_code")
                row["answer"] = (resp.get("answer") or resp.get("reason") or "")[:300]
                row.update({f"refusal_{k}": v for k, v in refusal_outcome(q, resp).items()})
                row["status_ok"] = status_ok(q, resp)
                if resp["verdict"] == "answered" and gold_docs:
                    c, g, v = citation_checks(resp["citations"], gold_pages, page_text)
                    row.update(citations=c, citations_on_gold_page=g, citations_verbatim=v)
                if resp["verdict"] == "answered" and q.get("key_points"):
                    hits = key_point_hits(resp["answer"], q["key_points"])
                    row.update(points=len(hits), points_hit=sum(hits), all_points=all(hits))
            results.append(row)
            print(f"[{n}/{len(questions)}] {q['question_id']} {q['category']:12} "
                  + " ".join(f"{k}={row[k]}" for k in ("top1", "top3", "answer_in_evidence", "verdict", "all_points", "seconds") if k in row), flush=True)
        chain = None
        if args.gold_lineage.exists():
            chain = chain_scores(state.lineage.edges(), list(csv.DictReader(open(args.gold_lineage, encoding="utf-8"))))

    summary = summarise(results, chain, args.mode)
    args.out.write_text(json.dumps({"summary": summary, "questions": results}, ensure_ascii=False, indent=1), encoding="utf-8")
    print_summary(summary)
    print(f"\nwritten to {args.out}")
    return 0


def rescore(saved: Path, gold_path: Path, out: Path) -> int:
    """Re-run only the key-point matching over the answers stored in a full run (answers are kept to 300 characters)."""
    data = json.loads(saved.read_text(encoding="utf-8"))
    gold = {q["question_id"]: q for q in json.loads(gold_path.read_text(encoding="utf-8"))}
    before = data["summary"].get("3_answers")
    for r in data["questions"]:
        kps = gold[r["id"]].get("key_points")
        if r.get("verdict") == "answered" and kps:
            hits = key_point_hits(r["answer"], kps)
            r.update(points=len(hits), points_hit=sum(hits), all_points=all(hits))
    chain = data["summary"].get("4_chain")
    data["summary"] = summarise(data["questions"], chain, data["summary"]["mode"])
    out.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print("3_answers before:", before)
    print("3_answers after: ", data["summary"]["3_answers"])
    return 0


def summarise(results: list[dict], chain: dict | None, mode: str) -> dict:
    gold = [r for r in results if "top1" in r]
    s: dict = {"mode": mode, "questions": len(results), "by_category": dict(Counter(r["category"] for r in results)),
               "by_language": dict(Counter(r["language"] for r in results)),
               "1_retrieval": {"questions": len(gold), "top1": rate(sum(r["top1"] for r in gold), len(gold)),
                               "top3": rate(sum(r["top3"] for r in gold), len(gold))}}
    ev = [r for r in results if "answer_in_evidence" in r]
    if ev:
        s["1_evidence"] = {"questions": len(ev), "answer_in_evidence": rate(sum(r["answer_in_evidence"] for r in ev), len(ev)),
                           "by_language": {lang: rate(sum(r["answer_in_evidence"] for r in ev if r["language"] == lang),
                                                      sum(1 for r in ev if r["language"] == lang)) for lang in ("en", "gu", "mixed")}}
    if mode == "full":
        cit = [r for r in results if "citations" in r]
        pts = [r for r in results if "points" in r]
        ans = [r for r in results if r["category"] in ANSWERABLE]
        ref = [r for r in results if r["category"] in REFUSED]
        s["2_citations"] = {"answers_with_citations": len(cit), "citations": sum(r["citations"] for r in cit),
                            "on_gold_page": rate(sum(r["citations_on_gold_page"] for r in cit), sum(r["citations"] for r in cit)),
                            "quote_verbatim": rate(sum(r["citations_verbatim"] for r in cit), sum(r["citations"] for r in cit))}
        s["3_answers"] = {"answered_with_key_points": len(pts), "all_points_rate": rate(sum(r["all_points"] for r in pts), len(pts)),
                          "mean_point_coverage": rate(sum(r["points_hit"] for r in pts), sum(r["points"] for r in pts))}
        s["5_refusals"] = {"should_refuse": len(ref), "correctly_refused": rate(sum(r["refusal_correct"] for r in ref), len(ref)),
                           "right_reason_code": rate(sum(r["refusal_code_ok"] for r in ref), len(ref)),
                           "should_answer": len(ans), "wrongly_refused": rate(sum(r["refusal_refused"] for r in ans), len(ans))}
        st = [r["status_ok"] for r in results if r.get("status_ok") is not None]
        s["lineage_status_shown"] = {"questions": len(st), "right_status_cited": rate(sum(st), len(st))}
        secs = sorted(r["seconds"] for r in results if "seconds" in r)
        if secs:
            s["seconds"] = {"p50": secs[len(secs) // 2], "p95": secs[min(len(secs) - 1, int(len(secs) * 0.95))], "max": secs[-1]}
    s["4_chain"] = chain
    by_cat = defaultdict(list)
    for r in gold:
        by_cat[r["category"]].append(r["top1"])
    s["1_retrieval"]["top1_by_category"] = {c: rate(sum(v), len(v)) for c, v in by_cat.items()}
    return s


def print_summary(s: dict) -> None:
    print("\n" + "=" * 64 + f"\nSCORECARD ({s['mode']}) over {s['questions']} questions {s['by_category']}\n" + "=" * 64)
    for k in sorted(k for k in s if k[0].isdigit() or k in ("lineage_status_shown", "seconds")):
        print(f"{k}: {json.dumps(s[k], ensure_ascii=False)}")


if __name__ == "__main__":
    sys.exit(main())
