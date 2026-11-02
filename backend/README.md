# GovResolve-AI backend (Squad 3)

FastAPI service: GR metadata, amendment/supersession lineage graph, clause status, `/ask`, query log, and context store.

## Architecture

Squad 3 provides:
- **Member A**: Core Lineage Graph, trigger & reference detector, and contract endpoints (`/documents`, `/lineage/{id}`, `/query`). Fully compliant with `backend/API_CONTRACT.md`.
- **Member B**: Lineage Engine (`app/lineage/`), extended router (`/grs`, `/clauses/{chunk_id}/status`, `/lineage/annotate`, etc.), SQLite store, and vector store.

## Run

```bash
cd backend
pip install -r requirements.txt
python -m pytest                              # run all tests
python -m uvicorn app.main:app --reload      # http://localhost:8000/docs
python -m scripts.eval_lineage               # precision / recall vs eval/gold_lineage.csv
```

On startup the contract graph (`/documents`, `/lineage/{id}`, `/edges`, `/query`) is filled from the same corpus using the lineage engine's edges, so both API families always agree. `POST /documents` adds to that graph only; run `POST /admin/rebuild` after changing the corpus folder.

Runs offline: corpus = `data/fixtures/*.json`, SQLite = `data/govresolve.sqlite`, vectors = `data/vector/`.

## Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `GOV_CORPUS_DIR` | `data/fixtures` | Folder of GR JSON records (Squad 1 format, `schemas/gr.py`) |
| `GOV_PDF_DIR` | `data/raw` | Where `/grs/{id}/pdf` looks for `source_pdf` |
| `GOV_EMBED_MODEL` | `hash` | `hash` = offline lexical embedder. For real Gujarati retrieval use multilingual model |
| `GOV_DB_PATH`, `GOV_VECTOR_DIR` | under `data/` | SQLite and Chroma locations |
| `SFIC_GRAPH_PATH` | none | JSON file to persist the graph |
| `SFIC_SEED` | `0` | `1` loads demo documents if graph is empty |

## Endpoints

- **Contract endpoints (Squads 1, 2, 4)**: `POST /documents`, `GET /documents`, `GET /documents/{id}`, `GET /lineage/{id}`, `GET /lineage/{id}/status`, `POST /query`, `GET /edges`.
- **Extended endpoints**: `/health`, `/grs`, `/grs/{id}`, `/grs/{id}/pdf`, `/grs/{id}/pages/{n}`, `/grs/{id}/lineage`, `/clauses/{chunk_id}/status`, `POST /lineage/annotate`, `/lineage/as-of`, `/lineage/broken`, `POST /ask`, `POST /feedback`, `/logs`, `POST /admin/rebuild`, `GET|POST /admin/edges/overrides`.

## Answers over the real corpus (Part 2)

`/query` answers through the RAG pipeline (`rag/`) when `GOV_ENGINE=squad2`. It needs three things that are **not in git**: the corpus JSON, the search index and a model.

### 1. Setup
```bash
python -m venv .venv && .venv\Scripts\python -m pip install -r requirements.txt -r backend/requirements.txt   # the root file is for rag/ (chromadb etc.)
copy .env.example .env        # then edit .env; it is git-ignored, never commit keys
ollama pull qwen3.5:4b && ollama pull bge-m3      # local model + embedder (the offline fallback)
```
`.env`: `LLM_PROVIDER=local` (default, offline). For a hosted model set `LLM_PROVIDER=api` and `LLM_API_URL`, `LLM_API_KEY`, `LLM_API_MODEL`
(examples in `.env.example`); local Ollama stays the fallback. `python -m scripts.llm_smoke` tests each provider with one tiny request and never prints the key.
Questions and GR text are sent to a hosted provider: the GRs are public, but check the challenge rules first.

### 2. Rebuild the data from `final_dataset/`
From `backend/`. Each step writes data, not code; keep the output out of git.
```bash
# a) one JSON per GR (text layer, or OCR with guj+eng when the layer is garbled). Slow: OCR of the scanned and Gujarati files.
python -m scripts.build_corpus --manifest ../final_dataset/manifest.csv --root ../final_dataset \
    --sources ../final_dataset/SOURCES_full_per_file_urls.txt --families-json D:/test/gr_json_families --out D:/test/corpus_v2
# b) the search index (Chroma vectors + BM25); about 1.4 chunks/s for bge-m3 on this CPU
python -m scripts.build_squad2_index --corpus D:/test/corpus_v2 --index ../data/index/chroma
```
`--families-json` holds the already-OCR'd rule-family records and is also outside git. The reference corpus is 366 documents and 7,501 chunks; re-running (b) only embeds new or changed chunks.
The shared `corpus_v2` zip is the quick route when OCR is not needed.

### 3. Run
```bash
set GOV_ENGINE=squad2 && set GOV_CORPUS_DIR=D:/test/corpus_v2
python -m uvicorn app.main:app          # http://localhost:8000/docs
```
The first question builds the pipeline; the app warms the model at startup. Expect 40-70 s per answer with the local model (see `DEMO.md`).
Switches (all in `.env.example`): `ANSWER_CHECK=off|warn|refuse` (second check of the answer, off by default),
`EVIDENCE_MAX_CHARS`, `EVIDENCE_CHARS_PER_CHUNK`, `TOP_K_RERANK` (evidence size), `TRANSLATION_CACHE` (file of English renderings of non-English questions; empty turns it off),
`GOV_BROKEN_CHAIN_REFUSES=1`.

### 4. Evaluate
```bash
python -m pytest -q                                                    # 400 tests, no model needed
python -m scripts.scorecard --corpus D:/test/corpus_v2 --index ../data/index/chroma --mode retrieval            # about 1 min, no model
python -m scripts.scorecard --corpus D:/test/corpus_v2 --index ../data/index/chroma --mode full --out ../eval/NEW.json   # ~40 min local, 50 questions
python -m scripts.scorecard ... --gold ../eval/heldout_questions.json --mode full    # the 16 held-out questions
python -m scripts.make_gold_questions --corpus D:/test/corpus_v2       # rebuild/validate the 50 gold questions against the corpus text
```
Results and honest notes: `../eval/SCORECARD_SUMMARY.md`. What was built and measured, item by item: `notes/part2_answers.md`. Demo script: `DEMO.md`.
Known limits: Gujarati lineage barely works; the corpus has no superseded order; gold questions are not officer-validated.
