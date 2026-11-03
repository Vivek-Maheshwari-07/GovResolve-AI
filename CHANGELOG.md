# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
