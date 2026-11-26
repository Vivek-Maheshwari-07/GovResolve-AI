# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
- Removed dead code and unused imports; the dead `BM25_WEIGHT` / `VECTOR_WEIGHT` / `TEMPERATURE` settings were dropped from `.env.example`.

### Removed
- `warm_up_local_llm` (replaced by `warm_up_llm`) and the module-level LLM constants of `llm_gateway` (settings are read when used).

### Known issues
See "Known limitations" in the README and findings F1 to F16 in `docs/GovResolve-AI_HLD_LLD.pdf`.

## [0.1.0] - 2026-11-03

First complete build for the Seva First Innovation Challenge (problem PS000230): corpus builder with OCR, hybrid retrieval, grounded
answers with verbatim citations, amendment lineage engine and graph, FastAPI service, and the web app.
