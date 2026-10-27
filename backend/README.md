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
