# Project instructions for AI coding tools

Project: Gujarati-English assistant for Government Resolutions (PS000230), Seva First Innovation Challenge.
Layout: `backend/` (FastAPI service, RAG pipeline, lineage engine), `frontend/` (React app), `docs/`, `eval/`. See `README.md`.

Before changing anything, read `CONTRIBUTING.md` and `backend/IMPLEMENTATION_PLAN.md` (context, code map, rules).
API contract: `backend/API_CONTRACT.md`. Language-model providers (Ollama, Groq): `docs/LLM_PROVIDERS.md`, code in `backend/rag/providers/`.

Hard rules: edge direction is newer -> older; never output an "active" status; only explicit references create edges;
quotes are verbatim; do not rename or remove existing API fields (frozen after Nov 2); add tests.
Before finishing run `make test` and `make lint` (or `python -m pytest` from `backend/`, and `npm test` in `frontend/`).
