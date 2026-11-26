# Handover: run the finale demo from branch `aayush`

## What changed (26 Nov 2026)
**Fixes to core features**
1. **The app answered nothing on a fresh copy.** The bundled search index was built with a different embedder than `.env` says, so
   every question failed with "Answer engine unavailable". Rebuilt the index with bge-m3 (1,265 passages); a mismatched index now
   falls back to keyword search with a warning instead of failing.
2. **Speed: ~2 s per answer with Groq** (was 45-75 s). Refusals need no model call (instant); question translations run in parallel and
   are cached; repeated questions come from an answer cache (0 s); a rate-limited Groq model hands over to the next Groq model
   instead of the slow local one.
3. **Document metadata repaired** (`backend/scripts/enrich_metadata.py`): missing dates 95 -> 13, subjects 85 -> 8, GR numbers
   123 -> 66, and 28 wrong dates corrected (the old ingester took a date the GR *cites* instead of its own). Each fixed value records
   its source in `metadata_sources`.
4. **Amendment lineage now works inside the collection**: 8 verified amendment links (there were 0). Removed 5 false links (a 2022
   rule matched a 2021 one; same-day sibling notifications).
5. **Amendments reach the answer**: the amending order's operative clause is given to the model; if the model still says "no
   amendment" for a GR the graph records as amended, that sentence is removed and a warning names the amending order.
6. **Verbatim fix**: quotes from amending orders could contain an added "[OPERATIVE AMENDMENT...]" label; fixed.
7. **Problem statement's leave example is now answerable**: added 6 Leave/LTC circulars (2001-2025) from `final_dataset`.
8. Duplicate citations/warnings removed; "(S1)" ids stripped from answers; `run.py` prefers `data/corpus_v2` if present.

**New features**
- **Live pipeline panel**: while answering, the UI shows each real step with its time (new endpoint `POST /query/stream`; `/query`
  unchanged).
- **Speak button**: ask by voice in Gujarati or English (Chrome/Edge, needs internet and microphone permission).
- **Garbled-quote notice**: Gujarati PDFs in legacy fonts show a note to read the PDF page; invisible control characters hidden.
- **Pre-flight script**: `python -m backend.scripts.preflight` checks the whole setup and pre-warms the demo answers.
- Landing-page sample questions replaced with ones verified against this collection.

Tests: 482 backend + 15 frontend pass, ruff clean. Full list: `CHANGELOG.md`. Demo script with timings: `docs/DEMO.md`.

## Set up the HP laptop (about 15 minutes)
1. Get the code:
   ```
   git fetch origin
   git checkout aayush
   git pull
   ```
2. **Files git does not carry** (get them from Aayush by USB / drive):
   - `final_dataset/` folder (the source PDFs, 435 files) into the repo root, or unzip `final_dataset.zip` there.
   - `.env`: start from `.env.example` and set these lines (put the Groq key in yourself, never in chat or git):
     ```
     LLM_PROVIDER=groq
     GROQ_API_KEY=<your key>
     GROQ_MODEL=openai/gpt-oss-120b
     TOP_K_RERANK=5
     EVIDENCE_CANDIDATES=8
     EVIDENCE_CHARS_PER_CHUNK=1200
     EVIDENCE_MAX_CHARS=4500
     EMBEDDING_MODEL=ollama:bge-m3
     GOV_ENGINE=squad2
     ```
   - Ollama must be running with `bge-m3` pulled (`ollama pull bge-m3`): it embeds the questions for vector search.
3. Install and build (skip what is already done): `pip install -r requirements/dev.txt`, then `cd frontend && npm ci && npm run build`.
4. Run the tests: `cd backend && python -m pytest -q` (expect 482 passed), `cd frontend && npm test` (15 passed).
5. Start the app: `python run.py` (or `start.bat`). Opens http://localhost:8000.
6. In a second terminal, from the repo root: `python -m backend.scripts.preflight`. Fix anything marked FAIL; it must end with
   **READY FOR THE DEMO**. This also asks each demo question once, so they answer instantly on stage.
7. Open http://localhost:8000 in Chrome, click **Skip tour** (or keep it for the pitch), allow the microphone once.

Do **not** run `build_squad2_index` unless pre-flight says the index is incomplete: the committed index is complete.

## Run the demo
Follow `docs/DEMO.md`: 8 questions in order (amendment, Gujarati, the leave example, Gujlish, amendment timeline, old scanned order,
two refusals), what each should show, and the honest limits to say out loud. Start with question 1 (Health Worker age limit and its
2022 amendment): it shows the Amended badge, both cited orders with page, the lineage link and the PDF page.
