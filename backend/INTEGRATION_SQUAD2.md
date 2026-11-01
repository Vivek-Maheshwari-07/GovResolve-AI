# Squad 2 <-> Squad 3 integration (Phase 3)

State on 2026-11-01: `origin/squad2` is at `33c3224` (unchanged since Oct 31), `origin/squad3` at `296286a`. A trial merge conflicts only
in `.gitignore`; the code does not overlap (theirs: `backend/api`, `rag`, `ingestion`, `lineage`; ours: `backend/app`).

## Decision: our contract is the public API
Squad 2's pipeline plugs in behind `/query` through the `AnswerEngine` seam the contract already defines. Their `/api/*` routes
are not part of the contract; they stay only as their own dev server. Assumption to confirm: their React UI (in their earlier commits)
calls `/api/*`, so if Squad 4 reuses it, either the UI is repointed to the contract or we add a thin `/api` adapter.

| Piece | Owner after integration |
|---|---|
| Ingestion and OCR (`backend/ingestion`, Tesseract) | Assumed: Squad 2's code, run offline to produce GR JSON. The spec gives ingestion to Squad 1; confirm who owns it |
| Retrieval, ranking, answer, citation check (`backend/rag`) | Squad 2, called through `app/squad2_bridge.py` |
| Lineage graph and statuses | Squad 3 only. Their `backend/lineage/lineage_graph.py` is not used |
| Public endpoints | `app/main.py` (the contract) |

## What is done (uncommitted, on squad3)
- `app/squad2_bridge.py`: `Squad2Engine(pipeline)` (our `AnswerEngine`), `to_engine_result(QueryResponse)`,
  `to_squad2_records(our GRRecords)`. Tests in `tests/test_squad2_bridge.py` (210 pass, 1 skipped until the branches are merged).
- Checked against the real `backend.models` from the squad2 branch: all 91 rule-family documents (1,615 chunks) convert.

## Field mapping
| Squad 2 `QueryResponse` | Our `EngineResult` / `/query` |
|---|---|
| `summary` | `answer` |
| `citations[].gr_id` / `.page` / `.passage` | `doc_id` / `page` / `quote` |
| `citations[].bbox` (x0,y0,x1,y1,page) | `bbox` `[x0,y0,x1,y1]` (page dropped; same page as the citation) |
| `answer_status == Insufficient Evidence`, `insufficient_reason`, `follow_up_question` | `verdict: insufficient_evidence`, `reason` = `CODE: text` |
| `answer_status` (Found / amended / superseded) | **ignored**: status comes from our lineage |
| `lineage_chain` | **ignored**: we attach `citations[].lineage` ourselves |
| `statements[].label` (Established / Inferred / Not found) | `statements[].label` (`established` / `inferred` / `not_found`), contract v0.2 |
| `insufficient_reason` (enum) | `reason_code`, contract v0.2 |

## Gaps and decisions needed before Nov 5
1. **Done in v0.2 (2026-11-01): `statements` and `reason_code` added as optional fields.** Was: statement labels are lost. The spec requires Established / Inferred / Not found (AI-16). Proposal: add an optional
   `statements` list to the `/query` response (adding an optional field does not rename or remove anything). Needs the other squads' OK.
2. **Insufficient-evidence reason is free text in `reason`.** The spec lists six codes. Proposal: also add an optional `reason_code`
   (`NO_DOCUMENT`, `TOO_VAGUE`, `MISSING_FACTS`, `BROKEN_CHAIN`, `POOR_SCAN`, `OUT_OF_SCOPE`). `BROKEN_CHAIN` is NOT produced anywhere yet: our graph has external stubs for missing GRs, but nothing turns a cited GR's stub into
   that code. To do on our side; Squad 2 produces the other five.
3. **Their pipeline has never been run.** Installing `requirements.txt` in a clean venv (needs `loguru`, `rank_bm25`,
   `indic_transliteration`; `BAAI/bge-m3` is a large download) and running `tests/test_pipeline.py` and `eval/evaluate.py` is Squad 2's job
   and the first thing to do. Until then the bridge is tested only against stand-ins.
4. **They need a language model.** `llm_gateway.py` wants a Gemini key or a local Ollama model. Without one the pipeline falls back
   to a deterministic answer. Decide which model the demo uses.
5. **Document ids must match.** Both sides must use the same `doc_id` as `gr_id`. Our converters build `GR-<file stem>-<sha6>`;
   `POST /documents` ids are Squad 1's. Pick one rule and keep it.
6. **Their `GRRecord.pages` blocks and bboxes** are filled from our chunks (one block per chunk). Highlighting uses the chunk box,
   which for OCR is the merged paragraph, not the exact line.
7. **Frontend was deleted on the squad2 tip** (`33c3224`). Ask Deep whether the UI lives elsewhere; Squad 4 needs the contract, not their UI.

## Order of work
1. Squad 2: clean venv, run their tests, report what fails (day 1).
2. Squad 2: build the index from `to_squad2_records(corpus)`; run five questions against the 91 family documents.
3. Squad 3: merge `squad2` into an integration branch, wire `create_app(engine=Squad2Engine(pipeline))`, add the optional fields if agreed.
4. Both: run the eval on the gold questions; fix retrieval misses.
5. Demo scenarios: amended rule, superseded rule, unanswerable, Gujarati question.
