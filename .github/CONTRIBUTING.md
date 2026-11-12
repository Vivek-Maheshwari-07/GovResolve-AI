# Contributing

Thanks for helping. This project answers questions about legal documents, so correctness matters more than speed: a change that makes
the system sound more certain than its evidence is a bug.

## Hard rules

These are enforced by tests and must not be broken by a change:

1. **Edges point newer to older.** The acting order is the source, the order it changes is the target.
2. **Only explicit references create edges.** Never infer a link from topic similarity.
3. **No "active" status.** Finding no later order does not prove a rule is in force.
4. **Quotes are verbatim.** Cited text is copied from the stored page text, never retyped by a model.
5. **Public API fields are frozen.** Add optional fields if you must; never rename or remove one (`docs/API_CONTRACT.md`).

## Setup

```bash
git clone https://github.com/Vivek-Maheshwari-07/GovResolve-AI.git && cd GovResolve-AI
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
make install-dev                                        # Python and web dependencies
cp .env.example .env                                    # then see docs/LLM_PROVIDERS.md
make demo                                               # synthetic documents, no model needed
```

## Before you open a pull request

```bash
make lint        # ruff (pyflakes rules)
make test        # backend pytest and frontend tests
make ui          # the web app must still build
```

- Add or update tests for what you change. Lineage changes need a test with the real sentence that motivated them.
- Behaviour or setting changes need a line in `CHANGELOG.md` and, for settings, `.env.example` and the README.
- Keep pull requests focused. Describe how you tested it; paste the question and the status you saw for UI or answer changes.
- Never commit `.env`, keys, or documents you are not allowed to publish.

## Where things are

| Area | Path |
|---|---|
| Language-model providers (Ollama, Groq, ...) | `backend/rag/providers/`, entry point `backend/rag/llm_gateway.py` |
| Retrieval and answer pipeline | `backend/rag/search_engine.py` |
| Lineage engine | `backend/app/lineage/`, `backend/app/graph.py` |
| API | `backend/app/main.py`, `backend/app/routers/api.py` |
| Corpus building and OCR | `backend/ingestion/`, `backend/scripts/` |
| Web app | `frontend/src/` |

## Adding a language-model provider

Subclass `ChatCompletionsProvider` (any OpenAI-compatible endpoint) or `LLMProvider` in `backend/rag/providers/`, register it in
`providers/__init__.py` (`CLASSES` and `ORDERS`), document its settings in `.env.example`, and test it against
`backend/tests/fake_llm_server.py`. Details in `docs/LLM_PROVIDERS.md`.

## Commit messages

Short imperative summary, then a body that says why. Examples: `fix: ignore quoted text when matching instrument titles`,
`feat: retry Groq rate limits`.
