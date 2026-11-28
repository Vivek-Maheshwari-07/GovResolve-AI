# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Repository cleanup (28 Nov 2026)
- Removed files nothing used: `docs/MERGE_REPORT.md`, `docs/HANDOVER_HP_LAPTOP.md`, `docs/notes/part1_ui.md` (branch notes), the early
  `GovResolve-AI_Project_Documentation.pdf` (superseded by the Complete Project Guide), the old nightly scorer `data/eval/evaluate.py` with its
  `gold_set.json`, and the scripts `add_gr.py` (replaced by the admin page), `sync_index.py` (replaced by `build_squad2_index`) and `repair_corpus.py`
  (replaced by `repair_garbled_pages`). Old screenshots were replaced with ones of the current interface.
- README rewritten (voice assistant, OCR, data layout, tools, voice setup); docs index, backend and frontend READMEs updated; `.gitignore`
  deduplicated and now ignores local index builds and the `*_backup_before_repair*` safety copies; `make index` takes `INDEX=`.

### Garbled Gujarati repaired in 15 documents (28 Nov 2026)
- `backend/scripts/repair_garbled_pages.py` finds pages whose Gujarati text layer is garbled (legacy-font PDFs) and re-reads only the
  blocks that contain Gujarati with OCR, clip by clip; English blocks and clean pages keep their text layer, tables fall back to the layer
  text when OCR loses most of a block, and metadata is carried over. Garble markers in those documents went from 1,100+ to 0.
- Originals: `data/corpus_v2_backup_before_repair/`, `data/index/chroma_bge_backup_before_repair/`. The search index was refreshed for the
  changed chunks only (`build_squad2_index --index ../data/index/chroma_bge`); delete `data/index/answers.json` after any corpus change,
  because the answer cache does not notice edited text.
- Fixed: `ocr_to_gr_json.py` and the other corpus scripts failed to import the new OCR module when run from `backend/`.

### Fixes found by testing two Gujlish questions (28 Nov 2026)
- Gujlish questions such as "... kya divas thi amal ma gana jashe?" were read as English (missing common words), so Auto did not answer in Gujarati.
- A translation model that declines ("I'm sorry, but I can't...") is no longer shown as the translation (`looksLikeModelRefusal`).
- A BROKEN_CHAIN warning no longer quotes text read wrongly from a legacy-font PDF (it says "an earlier provision"); the garbled-font
  detector knows a second mapping (`ચનયમ`, `વવભાગ`). Documents already in the collection are not re-read until the corpus is rebuilt.

### Landing page polish (28 Nov 2026)
- The headline's words rise out of a soft blur; a drifting indigo light and dot grid sit behind the masthead; a demo search bar types real
  sample questions in English, Gujarati and Gujlish; live collection numbers count up (hidden when the server is unreachable); the main
  buttons lean towards the pointer; audience cards have a pointer spotlight; the step rules draw in; the specimen sheet drifts on scroll.
  All of it follows `prefers-reduced-motion`; colours, fonts and layout are unchanged.
- The landing page's three bullet lines are now translated (Gujarati, Gujlish).
- The PDF viewer, lineage graph, library, method page and `/admin` load on first use: the first-load script is 657 kB (was 1,075 kB).

### Voice assistant and OCR (28 Nov 2026)
- **Voice input no longer stops at the first pause.** The chat and the search box share one end-of-speech rule
  (`frontend/src/lib/endpointing.js`, `speechSession.js`): it learns the room's noise, then stops after about 1.8 s of silence
  (2.6 s after a very short utterance, +1 s when the sentence ends mid-way), or after 8 s with no speech. Tapping stop still works.
- **Chat speaks its answers** (`POST /voice/speak`, `GET /voice/speak`, `backend/app/tts.py`): Gujarati and English neural voices via the
  optional `edge-tts` package; the browser's own voice is the fallback. `TTS_PROVIDER=off` disables it, `TTS_VOICE_GU` / `TTS_VOICE_EN`
  change the voices. Only the text to be read is sent to the speech service. New optional endpoint; no existing field changed.
- **Chat reply language** (Auto / English / ગુજરાતી): Auto answers in the language of the question; a fixed choice answers in that language
  whatever the question was. The chat also has a typing box and a Listen button on every reply.
- **OCR** (`backend/ingestion/ocr.py`, used by upload, `ingest_accurate.py`, `ocr_to_gr_json.py`, `build_corpus.py`): the language is chosen
  per page (a mostly Gujarati page is read with `guj` alone, which stops Gujarati words coming out as Latin junk), pages are read at
  300 DPI and straightened, short lines such as clause numbers are kept, and `ingest_accurate.py` stores the real word confidence
  instead of a fixed 0.85. `ocr_to_gr_json.py` now defaults to `--lang auto` (was English only).

### Finale hardening (26 Nov 2026)
- **Fixed: no question was answered on a fresh copy.** The bundled index was built with `intfloat/multilingual-e5-large` while
  `.env` names `ollama:bge-m3`, and Chroma refused every query. A mismatched index now falls back to keyword search with a visible
  warning; the index was rebuilt with bge-m3 (1,265 passages).
- **Speed: about 2 s per answer with Groq** (was 45-75 s on the local model). Guard refusals run before any model call (instant);
  the English and Gujarati question renderings run in parallel and are cached on disk; the Gujarati rendering of an English question is
  skipped when only a CPU model is available (`GU_QUERY_TRANSLATION`); repeated questions come from an answer cache (`ANSWER_CACHE`).
- **Groq model rotation** (`GROQ_FALLBACK_MODELS`): a rate-limited model hands over to the next Groq model at once instead of falling
  back to the slow local model; gpt-oss runs with low reasoning effort and a token floor so short calls are never empty.
- **Live pipeline view**: `POST /query/stream` (NDJSON) reports each step with its time; the UI loader shows the real steps.
  `/query` is unchanged.
- **Voice input** (Speak button, Gujarati or English, browser speech recognition).
- **Metadata repair** (`backend/scripts/enrich_metadata.py`): missing dates 95 -> 13, subjects 85 -> 8, GR numbers 123 -> 66;
  `--recheck-dates` corrected 28 dates the ingester had taken from a document's read list (a cited date, not its own). Each value
  records its source in `metadata_sources`. With the dates fixed, 8 amendment links inside the collection resolve (there were 0).
- **Lineage precision**: a cleanly printed year must match ('Rules, 2022' is not 'Rules, 2021'; OCR-confusable digits still slip);
  a date-only reference within 14 days of the citing order is not linked (own dating line or same-day sibling). Removed 5 false links.
- **Amendments reach the answer**: the amending order's operative chunk is injected (not only its preamble), every block of an
  amending order is labelled as such, and a model sentence denying an amendment the graph records is removed with a warning.
- **Verbatim fix**: the "[OPERATIVE AMENDMENT ...]" marker was prepended to document text and could end up inside a quote; it now
  lives only in the evidence block header.
- Duplicate citations and warnings removed; sentence ids such as "(S1)" stripped from answer text.
- Six Leave/LTC circulars (2001-2025) added from `final_dataset`, so the problem statement's leave example is answerable.
- Landing-page samples replaced with questions verified against the bundled collection; `docs/DEMO.md` rewritten with timings.
- `run.py` prefers `data/corpus_v2` when present.

### Removed
- `tests/test_pipeline.py`, a manual smoke script superseded by the pytest suite in `backend/tests/`; lint no longer lists `tests`.

### Added
- Responsive multilingual composer, persistent saved chat history, and corrected/compact Library and lineage views.
- **Guided bilingual Chat & Helpline drawer** (`frontend/src/components/ChatHelpline.jsx`, `frontend/src/lib/chat.js`): floating Gujarati/English chat widget with guided quick-start topics, stateful follow-up context, auto-detecting Groq Whisper speech-to-text (`POST /voice/transcribe` with live audio meter and `SpeechRecognition` fallback), automatic Gujarati/English/Gujlish detection & reply language switching, phone helpline badge, and clickable PDF citations that open directly in `PdfInspector`.
- **Chat performance & language detection upgrades**: removed heavy fullscreen `feTurbulence` / `backdrop-filter` / `9999px` shadow repaints in CSS, memoized chat thread/composer state to eliminate typing lag, added `Panchvati/Panchwati Yojna` bilingual glossary terms, parallelized fallback translations in `search_engine.py`, and improved Romanized Gujlish & explicit switch detection in `normalize.py` and `query_eval.py`.
- **Voice agent endpoints** (`backend/app/routers/voice.py`): `POST /voice/query` (speech-formatted grounded answers with GR citations and lineage warnings), `POST /voice/webhook` (post-call transcript/recording logging to SQLite), and `GET /voice/calls`, protected by optional `GOV_VOICE_TOKEN` / `GOV_ADMIN_TOKEN`.
- **NVIDIA NIM provider** (`backend/rag/providers/nvidia.py`): `LLM_PROVIDER=nvidia` (`NVIDIA_API_KEY`, `NVIDIA_MODEL`, `NVIDIA_BASE_URL`), plus automatic inclusion in `auto`/fallback chains when `NVIDIA_API_KEY` is set.
- **RAG latency optimizations**: deterministic guardrails (`is_out_of_scope`, `is_too_vague`, `looks_like_injection`) now run before query translation, bilingual translations and hybrid search legs (`dense_en`, `dense_gu`, `bm25`) run concurrently, Gujarati query translations persist to disk (`translations_gu.json`), and `ENABLE_GUJARATI_QUERY_TRANSLATION` allows opting out of Gujarati search translation.
- **LLM provider layer** (`backend/rag/providers/`): Ollama and Groq are first-class providers, with a generic OpenAI-compatible
  provider and optional Gemini. `LLM_PROVIDER=ollama|groq|openai|gemini|auto`; the others act as fallbacks.
- Groq: retries after rate limits and server errors (honours `Retry-After`), optional `GROQ_REASONING_EFFORT`, key redacted from logs.
- Ollama: host resolution (`OLLAMA_HOST`), model check, start-up warm-up, `ollama pull` hint when the model is missing.
- `make llm-check` / `python -m backend.scripts.llm_smoke`: checks configuration, reachability and speed of every provider.
- Landing page, 11-step guided product tour on the live app, Trust Shield under every answer, session history, lineage that follows the
  selected citation, department filter in the Library, and the "Gazette Dossier" design system.
- Repository tooling: Makefile, Dockerfile and Compose file (with an optional Ollama profile), GitHub Actions CI, issue and pull-request
  templates, Dependabot, `pyproject.toml` (ruff), `requirements*.txt`, LICENSE, CONTRIBUTING and SECURITY policies.
- Documentation: rewritten README, `docs/LLM_PROVIDERS.md`, `docs/REQUIREMENTS_TRACEABILITY.md`, system design PDF (HLD, LLD, evaluation).

### Changed
- The default local model in code is now `qwen3.5:4b` (it was `gemma3:4b`), matching the documentation and the evaluation.
- LLM settings were renamed (`OLLAMA_*`, `GROQ_*`); the previous names (`LOCAL_LLM_*`, `LLM_PROVIDER=local|api`) still work.
- `llm_gateway.execute_llm_generation` now returns the provider name `ollama`, `groq`, `openai`, `gemini` or `fallback`.
- Dependencies are managed in one place (`requirements.txt`); `backend/requirements.txt` points to it.

### Fixed
- PDF lookup is case-insensitive, so files named `*.PDF` are found on Linux and macOS.
- Date-only `Read (n)` references are no longer reported as missing GR numbers in broken-chain warnings.
- Bilingual evidence selection now considers the full bounded retrieval set; generic "disposal" queries no longer
  expand into unrelated dead-stock terms.
- Removed dead code and unused imports; the dead `BM25_WEIGHT` / `VECTOR_WEIGHT` / `TEMPERATURE` settings were dropped from `.env.example`.

### Removed
- `warm_up_local_llm` (replaced by `warm_up_llm`) and the module-level LLM constants of `llm_gateway` (settings are read when used).

### Known issues
See "Known limitations" in the README and findings F1 to F16 in `docs/GovResolve-AI_HLD_LLD.pdf`.

## [0.1.0] - 2026-11-03

First complete build for the Seva First Innovation Challenge (problem PS000230): corpus builder with OCR, hybrid retrieval, grounded
answers with verbatim citations, amendment lineage engine and graph, FastAPI service, and the web app.
