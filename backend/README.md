# GovResolve-AI backend

A FastAPI service that serves Government Resolution (GR) records, an amendment and supersession lineage graph, and grounded answers with verbatim citations.

## Structure

| Path | Role |
|---|---|
| `app/main.py` | Application factory, `/query`, `/documents`, `/lineage`, static UI |
| `app/routers/api.py` | Library, clause status, `/ask`, feedback, logs and admin routes |
| `app/lineage/` | Reference extraction, graph, scope and status engine |
| `app/graph.py`, `app/detector.py` | Document-level contract graph and reference detector |
| `app/store/` | Corpus loader and SQLite store (edges, query log, overrides, cache) |
| `app/security.py` | Response headers, optional admin token, per-client rate limit |
| `rag/` | Hybrid search index, question normalizer, answer pipeline, model gateway and providers |
| `ingestion/` | PDF to GR record conversion (text layer and OCR) |
| `scripts/` | Corpus, index, lineage evaluation, scorecard and smoke-test tools |
| `tests/` | pytest suite (no model needed) |

## Run

From the repository root, `python run.py` starts everything. To run only the backend:

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload     # http://localhost:8000/docs
python -m pytest -q                         # run the tests
```

With no settings, the app uses the synthetic documents in `data/fixtures` and returns matching passages without a language model.
Set `SFIC_SEED=1` to load extra demo documents.

## Settings

Settings come from environment variables or `.env` (see the repository `.env.example`).

| Variable | Default | Meaning |
|---|---|---|
| `GOV_ENGINE` | `retrieval` | `squad2` answers through the RAG pipeline (needs a corpus, an index and a model) |
| `GOV_CORPUS_DIR` | `data/fixtures` | Folder of GR JSON records |
| `GOV_PDF_DIR` | `data/raw` | Where source PDFs are looked up |
| `GOV_EMBED_MODEL` | `hash` | Offline test embedder; use a multilingual model for real retrieval |
| `GOV_DB_PATH`, `GOV_VECTOR_DIR` | under `data/` | SQLite and vector store locations |
| `GOV_ADMIN_TOKEN` | empty | When set, `/admin/*` and writes to `/documents`, `/logs` and `/api/upload` need the header `X-Admin-Token`; with no token they work from this machine only |
| `GOV_QUERY_RATE_PER_MIN` | `120` | Questions per client per minute (`0` turns it off) |
| `GOV_CORS_ORIGINS` | localhost only | Allowed origins, as a JSON list; add your host for a shared deployment |
| `GOV_TRUST_PROXY` | `0` | `1` reads the client address from `X-Forwarded-For` (only behind your own proxy) |
| `GOV_MAX_UPLOAD_MB` | `50` | Size limit for `POST /api/upload` |

Language-model settings (`LLM_PROVIDER`, `OLLAMA_*`, `GROQ_*`) are documented in [../docs/LLM_PROVIDERS.md](../docs/LLM_PROVIDERS.md).

## Endpoints

The contract endpoints are specified in [API_CONTRACT.md](API_CONTRACT.md) and must not change incompatibly.

- **Contract:** `POST /documents`, `GET /documents`, `GET /documents/{id}`, `GET /lineage/{id}`, `GET /lineage/{id}/status`, `GET /edges`, `POST /query`.
- **Extended:** `GET /health`, `GET /grs`, `GET /grs/{id}`, `GET /grs/{id}/pdf`, `GET /grs/{id}/pages/{n}`, `GET /grs/{id}/lineage`, `GET /clauses/{chunk_id}/status`, `POST /lineage/annotate`, `GET /lineage/as-of`, `GET /lineage/broken`, `POST /ask`, `POST /feedback`, `GET /logs`, `POST /admin/rebuild`, `GET|POST /admin/edges/overrides`.

## Using your own collection

The corpus JSON, the search index and a language model are needed for real answers.

1. **Install and configure.**
   ```bash
   cp .env.example .env     # choose LLM_PROVIDER=ollama or groq
   ollama pull qwen3.5:4b && ollama pull bge-m3
   ```
2. **Build the corpus** (one JSON per GR; OCR runs on scanned files and is slow):
   ```bash
   cd backend
   python -m scripts.build_corpus --manifest ../final_dataset/manifest.csv --root ../final_dataset --out ../data/corpus_v2
   ```
3. **Build the search index** (about 1.4 chunks per second with bge-m3 on a CPU; re-runs embed only new or changed chunks):
   ```bash
   python -m scripts.build_squad2_index --corpus ../data/corpus_v2 --index ../data/index/chroma
   ```
4. **Start the app.** Set `GOV_ENGINE=squad2` and `GOV_CORPUS_DIR`, or run `python run.py` from the repository root, which detects both.

The first question builds the pipeline; the app warms the model at startup. Source PDFs are found by file name under `GOV_PDF_DIR`, `final_dataset/` and any folders in `GOV_PDF_EXTRA_DIRS`.

## Evaluation

```bash
python -m pytest -q                                                                      # no model needed
python -m scripts.eval_lineage                                                           # lineage precision and recall against eval/gold_lineage.csv
python -m scripts.scorecard --corpus ../data/corpus_v2 --index ../data/index/chroma --mode retrieval   # about 1 minute, no model
python -m scripts.scorecard --corpus ../data/corpus_v2 --index ../data/index/chroma --mode full --out ../eval/NEW.json
```

Results and notes: [../eval/SCORECARD_SUMMARY.md](../eval/SCORECARD_SUMMARY.md). Demo script: [DEMO.md](DEMO.md). Design history: [notes/part2_answers.md](notes/part2_answers.md).

## Known limits

- Gujarati lineage detection is weak.
- The gold questions have not been validated by officers.
- Local CPU answers take 40 to 70 seconds.
