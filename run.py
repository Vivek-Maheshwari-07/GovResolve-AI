"""
GovResolve-AI: one-command launcher.   python run.py   (or double-click start.bat)

- Uses the bundled collection: corpus folder (data/corpus_v2), search index (data/index/chroma),
  and official PDF library (final_dataset). Questions are answered by the hybrid RAG pipeline (GOV_ENGINE=squad2).
- Builds the web UI (frontend/dist) the first time if Node.js is installed.
- Serves everything on http://127.0.0.1:8000 (this machine only). Use --host 0.0.0.0 to share on a network.
"""
import argparse
import os
import shutil
import subprocess
import sys
import threading
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
os.chdir(ROOT)                                   # so ".env" at the repo root is found


def _use_project_venv() -> None:
    """Re-run under the project's .venv when started with another Python, so the installed dependencies are found."""
    venv_py = ROOT / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    if venv_py.is_file() and Path(sys.prefix).resolve() != (ROOT / ".venv").resolve():
        sys.exit(subprocess.call([str(venv_py), str(Path(__file__).resolve()), *sys.argv[1:]]))


if __name__ == "__main__":
    _use_project_venv()
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "backend"))


def find_corpus() -> Path | None:
    for c in (os.environ.get("GOV_CORPUS_DIR"), ROOT / "data" / "processed", ROOT / "data" / "corpus_v2"):
        if c and Path(c).is_dir() and any(Path(c).glob("*.json")):
            return Path(c)
    return None


def build_ui() -> None:
    dist = ROOT / "frontend" / "dist" / "index.html"
    if dist.exists():
        return
    npm = shutil.which("npm")
    if not npm:
        print("  [!] Web UI is not built and Node.js was not found. The API still runs at /docs. Install Node 18+ and run:  cd frontend && npm ci && npm run build")
        return
    print("  Building the web UI (first run only) ...")
    ui = ROOT / "frontend"
    try:
        if not (ui / "node_modules").is_dir():
            subprocess.run([npm, "ci", "--no-audit", "--no-fund"], cwd=ui, check=True)
        subprocess.run([npm, "run", "build"], cwd=ui, check=True)
    except subprocess.CalledProcessError:
        print("  [!] UI build failed; the API still runs at /docs.")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--no-browser", action="store_true")
    args = ap.parse_args()

    corpus = find_corpus()
    index = Path(os.environ.get("GOV_SQUAD2_INDEX_DIR", ROOT / "data" / "index" / "chroma"))
    if corpus and index.is_dir():
        os.environ.setdefault("GOV_CORPUS_DIR", str(corpus))
        os.environ.setdefault("GOV_ENGINE", "squad2")
        mode = f"real collection ({corpus}), answers by the RAG pipeline"
    else:
        mode = "DEMO fixtures only (synthetic documents, search without a language model)"
        if not corpus:
            print("  [!] No corpus found. Set GOV_CORPUS_DIR or see backend/README.md to build it.")
        elif not index.is_dir():
            print(f"  [!] No search index at {index}. Build it: cd backend && python -m scripts.build_squad2_index --corpus {corpus} --index ../data/index/chroma")
    # Source PDFs: final_dataset, data/grs, data/pdfs are searched recursively by file name
    extra = [p for p in (ROOT / "final_dataset", ROOT / "data" / "grs", ROOT / "data" / "pdfs") if p.is_dir()]
    if extra:
        os.environ["GOV_PDF_EXTRA_DIRS"] = os.pathsep.join([os.environ.get("GOV_PDF_EXTRA_DIRS", ""), *map(str, extra)]).strip(os.pathsep)
    build_ui()
    url = f"http://{'localhost' if args.host in ('127.0.0.1', '0.0.0.0') else args.host}:{args.port}"
    print(f"""
==============================================================
  🏛️  GovResolve-AI — Executive Command Center (PS000230)
  Mode:       {mode}
  Web UI:     {url}
  API Docs:   {url}/docs
  Collection: 366 Indexed GRs | 515 Official PDFs | Hybrid BM25+Dense
==============================================================
""")
    if os.environ.get("GOV_ENGINE") == "squad2" and not shutil.which("ollama") and os.environ.get("LLM_PROVIDER", "ollama").lower() in ("ollama", "local"):
        print("  [!] 'ollama' not found on PATH: without a model, answers are one quoted passage with a warning.\n")
    if not args.no_browser:
        threading.Timer(3.0, lambda: webbrowser.open(url)).start()
    import uvicorn
    uvicorn.run("app.main:app", host=args.host, port=args.port, app_dir=str(ROOT / "backend"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
