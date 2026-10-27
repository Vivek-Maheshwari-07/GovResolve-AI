# SFIC backend (Squad 3: API + lineage graph)

```bash
pip install -r requirements.txt
python -m pytest                      # from this folder
SFIC_SEED=1 uvicorn app.main:app --reload   # synthetic DEMO data, docs at /docs
```

Env: `SFIC_GRAPH_PATH` (JSON persistence file), `SFIC_SEED=1` (load DEMO docs when empty).

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/documents` | Squad 1 sends a doc with per-page text; detector runs, edges are stored |
| GET | `/documents`, `/documents/{id}` | metadata (+ lineage status) |
| GET | `/lineage/{id}` | connected chain: nodes (with status), edges (with quote + page), timeline order |
| GET | `/lineage/{id}/status` | status of one document |
| POST | `/query` | calls Squad 2's engine, attaches lineage to each citation, adds warnings |

## Modules

- `schemas.py` - the contract. Edge direction: `source` (newer) acts on `target` (older).
- `normalize.py` - Gujarati digits, GR-number keys, dates, language detection.
- `detector.py` - trigger phrases (en + gu) + GR-number/date references, sentence-scoped.
- `graph.py` - networkx store, reference resolution, `ext:` stubs, status logic, JSON persistence.
- `engine.py` - `AnswerEngine` protocol for Squad 2 (`NullEngine` always refuses).
- `seed.py` - synthetic DEMO chain for Squad 4. Not real data.

## Status values

`superseded` / `amended` / `no_later_amendment_found` / `unknown`. There is deliberately no
"active": absence of a later order in the corpus never proves a rule is current.

## Known limits

- Gujarati trigger words are unvalidated against real GRs.
- Pronoun references ("the above resolution") are reported in `unresolved`, not linked.
- Document-level lineage only; no clause-level status yet.
- A trigger and its reference must share a sentence on the same page.
