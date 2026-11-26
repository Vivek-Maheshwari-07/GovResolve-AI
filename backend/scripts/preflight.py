"""Demo pre-flight: is this machine ready for the live demo? Then ask the demo questions once, so they are answered at once on stage.

    python -m backend.scripts.preflight            # checks + pre-warm (needs the app running: python run.py)
    python -m backend.scripts.preflight --no-warm  # checks only

Prints one line per check (OK / FAIL / WARN) and what to do about a failure. Never prints a key.
"""
from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

# The questions of docs/DEMO.md, in stage order (keep the two in sync).
DEMO_QUESTIONS = [
    "What is the upper age limit for direct selection of a Multi Purpose Health Worker (Male), and was it changed by any amendment?",
    "મલ્ટી પર્પઝ હેલ્થ વર્કર (પુરુષ)ની સીધી ભરતી માટે ઉપલી વય મર્યાદા કેટલી છે અને તેમાં કોઈ સુધારો થયો છે?",
    "Which documents or applications are required for leave and LTC, and where must they be submitted?",
    "Leave ane LTC ni arji kaya application ma karvani farjiyat che?",
    "ગુજરાત પંચાયત સેવા (વર્ગ-૩) ભરતી (પરીક્ષા) નિયમો, ૨૦૨૧માં કયા સુધારા કરવામાં આવ્યા?",
    "What did the 2001 resolution decide about Home Town LTC and All India LTC under the Central Civil Services (LTC) Rules?",
    "How many days of maternity leave are allowed to women government employees?",
    "Can I sue the department for wrongly denying my promotion and will I win?",
]
HOSTED_BUDGET = {"TOP_K_RERANK": 5, "EVIDENCE_CHARS_PER_CHUNK": 1200, "EVIDENCE_MAX_CHARS": 4500}

results: list[bool] = []


def report(ok: bool | None, what: str, fix: str = "") -> None:
    tag = "OK  " if ok else ("WARN" if ok is None else "FAIL")
    print(f"  [{tag}] {what}" + (f"\n         -> {fix}" if fix and not ok else ""))
    if ok is False:
        results.append(False)


def check_env() -> None:
    from dotenv import dotenv_values
    env = dotenv_values(ROOT / ".env") if (ROOT / ".env").is_file() else {}
    report(bool(env), ".env exists", "Copy .env.example to .env and fill it in (it is not in git).")
    provider = (env.get("LLM_PROVIDER") or "").split("#")[0].strip()
    report(provider == "groq", f"LLM_PROVIDER={provider or '(unset)'}", "Set LLM_PROVIDER=groq for ~2 s answers.")
    for k, want in HOSTED_BUDGET.items():
        raw = (env.get(k) or "").split("#")[0].strip()
        report(raw.isdigit() and int(raw) >= want, f"{k}={raw or '(unset)'}", f"Set {k}={want} (the CPU budget refuses answerable questions).")


def check_groq() -> None:
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env", override=True)
    from backend.rag.providers import GroqProvider
    p = GroqProvider()
    if not p.is_configured():
        report(False, "GROQ_API_KEY is set", "Put a key from https://console.groq.com/keys in .env (never in chat or git).")
        return
    t = time.time()
    out = p.generate("Reply with OK.", "ping", max_tokens=8, json_mode=False)
    report(bool(out), f"Groq answers ({time.time() - t:.1f}s, model {p.model})", "Check the key, the internet connection and GROQ_MODEL.")


def check_data() -> None:
    corpus = ROOT / "data" / "processed"
    n = len(list(corpus.glob("*.json")))
    report(n >= 156, f"{n} GR records in data/processed", "Copy data/processed from the main laptop (156 records).")
    db = ROOT / "data" / "index" / "chroma" / "chroma.sqlite3"
    try:
        vec = sqlite3.connect(str(db)).execute("select count(*) from embeddings").fetchone()[0]
    except Exception:
        vec = 0
    report(vec >= 1265, f"{vec} passages in the vector index", "Copy data/index/chroma, or run: cd backend && python -m scripts.build_squad2_index "
           "--corpus ../data/processed --index ../data/index/chroma (resumes; ~6 min for all).")
    pdfs = list((ROOT / "final_dataset").rglob("*.pdf")) if (ROOT / "final_dataset").is_dir() else []
    report(len(pdfs) >= 400, f"{len(pdfs)} source PDFs in final_dataset/", "Unzip data/final_dataset.zip into the repo root (PDF view needs it).")
    built = (ROOT / "frontend" / "dist" / "index.html").is_file()
    report(built, "web UI is built", "cd frontend && npm ci && npm run build")


def ask(question: str) -> tuple[float, dict]:
    req = urllib.request.Request("http://127.0.0.1:8000/query", data=json.dumps({"question": question}).encode(),
                                 headers={"Content-Type": "application/json"})
    t = time.time()
    with urllib.request.urlopen(req, timeout=240) as r:
        return time.time() - t, json.loads(r.read())


def warm() -> None:
    try:
        with urllib.request.urlopen("http://127.0.0.1:8000/health", timeout=5) as r:
            health = json.loads(r.read())
    except Exception:
        report(False, "app is running on http://127.0.0.1:8000", "Start it first: python run.py (or start.bat), then run this again.")
        return
    report(health.get("gr_count", 0) >= 156, f"app serves {health.get('gr_count')} GRs, {health.get('edge_count')} links")
    for i, q in enumerate(DEMO_QUESTIONS, 1):
        try:
            secs, r = ask(q)
        except Exception as e:
            report(False, f"Q{i} {q[:60]}", f"{type(e).__name__}: {e}")
            continue
        expect_refusal = i >= 7
        ok = (r["verdict"] != "answered") if expect_refusal else (r["verdict"] == "answered")
        text = (r.get("answer") or r.get("reason") or "")[:90]
        report(ok, f"Q{i} {secs:4.1f}s {r['verdict']}: {text}", "Unexpected verdict: see docs/DEMO.md, or ask it again in the UI.")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--no-warm", action="store_true", help="only check the setup, do not ask the demo questions")
    args = ap.parse_args()
    os.chdir(ROOT)
    print("Setup");  check_env()        # noqa: E702
    print("Model");  check_groq()       # noqa: E702
    print("Data");   check_data()       # noqa: E702
    if not args.no_warm:
        print("Demo questions (first answer of each is saved, later ones are instant)")
        warm()
    print("\nREADY FOR THE DEMO" if not results else f"\n{len(results)} problem(s) to fix first (see -> lines above)")
    return 0 if not results else 1


if __name__ == "__main__":
    raise SystemExit(main())
