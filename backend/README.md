# GovResolve-AI backend (Squad 3, Member B)

FastAPI service: GR metadata, lineage, clause status, `/ask`, query log, and a ChromaDB context store.

## Run

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload      # http://localhost:8000/docs
python -m pytest -q                          # 21 tests
python -m scripts.eval_lineage               # precision / recall vs eval/gold_lineage.csv
```

Runs fully offline: corpus = `data/fixtures/*.json`, SQLite = `data/govresolve.sqlite`, vectors = `data/vector/`.

## Environment variables (prefix `GOV_`)

| Variable | Default | Meaning |
|---|---|---|
| `GOV_CORPUS_DIR` | `data/fixtures` | Folder of GR JSON records (Squad 1 format, `schemas/gr.py`) |
| `GOV_PDF_DIR` | `data/raw` | Where `/grs/{id}/pdf` looks for `source_pdf` |
| `GOV_EMBED_MODEL` | `hash` | `hash` = offline lexical embedder. For real Gujarati retrieval use a multilingual model, e.g. `intfloat/multilingual-e5-small` |
| `GOV_DB_PATH`, `GOV_VECTOR_DIR` | under `data/` | SQLite and Chroma locations |

## How it connects to the other squads

- **Lineage engine** (`app/lineage/`): normalize -> patterns -> extract -> resolve -> scope -> graph -> status, behind `LineageService`. `GOV_LINEAGE_ENGINE=auto|real|stub` picks it; `/health` shows `lineage_engine`. The stub (`services/lineage_stub.py`) is only for API tests (`tests/data`).
- **Build and check edges:** `python -m scripts.build_lineage` writes every edge to `data/edges_detected.csv` and lists sentences needing manual review. `python -m scripts.eval_lineage` scores them against `eval/gold_lineage.csv`.
- **LLM fallback:** `LineageService(corpus, llm=LLMFallback(call, cache=db))`, where `call(prompt) -> str`. Off by default; unphrased references are listed in `review_items` instead.
- **Squad 2's pipeline:** if `app.core_ai.answer(question, filters)` exists, `/ask` calls it and expects `{"answer", "citations": [{"chunk_id", "quote"?}], "refusal_reason"?, "answer_status"?}`. Otherwise `/ask` falls back to retrieval-only over the vector store.
- **Chunk IDs** look like `GAD-2014-07:1` (no `#`, which breaks URLs).

## Endpoints

`/health`, `/grs`, `/grs/{id}`, `/grs/{id}/pdf`, `/grs/{id}/pages/{n}`, `/grs/{id}/lineage`, `/clauses/{chunk_id}/status`,
`POST /lineage/annotate`, `/lineage/as-of`, `/lineage/broken`, `POST /ask`, `POST /feedback`, `/logs`,
`POST /admin/rebuild`, `GET|POST /admin/edges/overrides`, `DELETE /admin/edges/overrides/{edge_id}`.

Errors are JSON `{"error": ..., "reason": ...}`; unknown IDs return 404.
