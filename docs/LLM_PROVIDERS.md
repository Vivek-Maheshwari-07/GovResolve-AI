# Language-model providers: Ollama and Groq

GovResolve-AI needs a language model for one job: to choose which numbered evidence sentences answer the question and to phrase a
short answer. It never writes the quotes; the application copies those from the page text. Because of that, a small local model is
safe to use, and a larger hosted model mainly buys speed.

You can use **Ollama** (local), **Groq** (hosted), or both: one is the first choice and the other is the fallback.

| | Ollama (local) | Groq (hosted) |
|---|---|---|
| Where the model runs | Your machine | Groq's servers |
| Documents leave your machine | No | The question and the retrieved passages are sent |
| Key / account | None | `GROQ_API_KEY` |
| Works offline | Yes | No |
| Speed (reported, see below) | 35 to 80 s per answer on a laptop CPU | about 10 s per answer |
| Cost | Free (your hardware) | Free tier with rate limits, then paid |
| Best for | Offline demos, confidential documents | Live demos, quick evaluation |

Reported figures come from `data/eval/SCORECARD_SUMMARY.md`: local `qwen3.5:4b` on an i5-1235U CPU (median 45 s, p95 66 to 76 s); Groq
`openai/gpt-oss-120b` 9 to 11 s in one clean run on a free tier. Measure your own with `make llm-check`.

## Quick setup

### Ollama

1. Install Ollama from <https://ollama.com> and make sure it is running (`ollama serve`, or the desktop app).
2. Pull the answer model and the embedding model (the search index uses bge-m3):
   ```bash
   ollama pull qwen3.5:4b
   ollama pull bge-m3
   ```
3. In `.env`:
   ```ini
   LLM_PROVIDER=ollama
   OLLAMA_MODEL=qwen3.5:4b
   EMBEDDING_MODEL=ollama:bge-m3
   ```
4. Check: `make llm-check`. It tells you whether Ollama answers and whether the model is installed.

Other models work: set `OLLAMA_MODEL` to anything you have pulled. The project was evaluated with `qwen3.5:4b` only. If you use a
"thinking" model, keep `OLLAMA_REASONING=none` (the default), otherwise answers can time out on a CPU.

### Groq

1. Create a key at <https://console.groq.com/keys>.
2. In `.env` (never in git):
   ```ini
   LLM_PROVIDER=groq
   GROQ_API_KEY=gsk_...
   GROQ_MODEL=openai/gpt-oss-120b
   ```
3. Check: `make llm-check`. It verifies the key and lists the models available to it.

Model availability depends on your account. If `openai/gpt-oss-120b` is not offered, the check prints the models you can use; set
`GROQ_MODEL` to one of them.

### Both, with a fallback

```ini
LLM_PROVIDER=groq              # fast first choice
GROQ_API_KEY=gsk_...
OLLAMA_MODEL=qwen3.5:4b        # used when Groq is rate-limited, down, or has no key
```

or the reverse (`LLM_PROVIDER=ollama` plus a Groq key) to prefer the local model. `LLM_PROVIDER=auto` uses the first hosted
provider that has a key and falls back to Ollama.

## How providers are chosen

`LLM_PROVIDER` names the first choice. A provider without its key or host is skipped without any network call. If the first choice
fails, the next one is tried:

| `LLM_PROVIDER` | Order tried |
|---|---|
| `ollama` (default; legacy `local`) | ollama, groq, openai, gemini |
| `groq` | groq, ollama, openai, gemini |
| `openai` (legacy `api`) | openai, ollama, groq, gemini |
| `gemini` | gemini, ollama, groq, openai |
| `auto` | groq, openai, gemini, ollama |

If **nothing** answers, the application does not invent an answer. It returns the best-matching verbatim sentence, labels it
*inferred*, and shows the warning "The language model is unavailable". The Ollama warm-up at start-up only runs when Ollama is the
provider that would answer.

## Settings

Set in `.env` (loaded at start-up; restart the server after changing it).

| Variable | Default | Meaning |
|---|---|---|
| `LLM_PROVIDER` | `ollama` | First choice, see above |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama server. `host:port` and `http://host:port` both work. Also used for embeddings. |
| `OLLAMA_MODEL` | `qwen3.5:4b` | Answer model |
| `OLLAMA_REASONING` | `none` | Sent as `reasoning_effort`; set empty to omit |
| `OLLAMA_TIMEOUT` | `180` | Seconds per call (the first also loads the model) |
| `OLLAMA_MAX_TOKENS` | `700` | Cap on the answer length |
| `OLLAMA_KEEP_ALIVE` | `30m` | How long the model stays in memory after warm-up |
| `GROQ_API_KEY` | unset | Required for Groq. The `your_...` placeholder counts as unset. |
| `GROQ_MODEL` | `openai/gpt-oss-120b` | Answer model |
| `GROQ_BASE_URL` | `https://api.groq.com/openai/v1` | Change only for a proxy |
| `GROQ_TIMEOUT` / `GROQ_MAX_TOKENS` | `60` / `700` | Per call |
| `GROQ_MAX_RETRIES` | `2` | Retries after a 429 or 5xx, honouring `Retry-After` (capped at 8 s) |
| `GROQ_REASONING_EFFORT` | unset | `low`, `medium` or `high` for reasoning models |
| `LLM_API_URL` / `LLM_API_KEY` / `LLM_API_MODEL` | unset | Any other OpenAI-compatible service (all three required) |
| `GOOGLE_API_KEY` / `GEMINI_MODEL` | unset / `gemini-2.0-flash` | Gemini (`pip install google-genai`) |

Older names still work: `LOCAL_LLM_URL`, `LOCAL_LLM_MODEL`, `LOCAL_LLM_TIMEOUT`, `LOCAL_LLM_MAX_TOKENS`, `LOCAL_LLM_KEEP_ALIVE`,
`LOCAL_LLM_REASONING` (now `OLLAMA_*`), `OLLAMA_URL`, and `LLM_PROVIDER=local|api`.

## What is sent to the model

The fixed system prompt, numbered evidence sentences chosen from the retrieved documents (a few thousand characters at most, set by `EVIDENCE_MAX_CHARS`), and the
question. For Gujarati and Gujlish questions one extra short call sends only the question, to translate it to English (the result is
cached in `data/index/translations.json`). With `ANSWER_CHECK=warn|refuse` a second call sends the question, the answer and the
cited sentences. Nothing else leaves the machine. With Ollama none of it leaves the machine at all.

## Troubleshooting

Run `make llm-check` first; it prints the reason for most of these.

| Symptom | Likely cause | Fix |
|---|---|---|
| `not reachable at http://localhost:11434` | Ollama is not running | `ollama serve` or start the app; check `OLLAMA_HOST` |
| `model 'qwen3.5:4b' is not installed` | Not pulled yet | `ollama pull qwen3.5:4b` |
| Search fails or returns nothing after changing `EMBEDDING_MODEL` | The index was built with another embedder | Rebuild: `make index` |
| Groq `401` | Wrong or revoked key | Check `GROQ_API_KEY` |
| Groq `403` | Key, region or network blocks the request | Check the key and any proxy |
| Groq `404` | Model not available to your key, or wrong `GROQ_BASE_URL` | Use a model from the list `make llm-check` prints |
| Groq `429` | Free-tier rate limit | Retries are automatic; lower the question rate, raise `GROQ_MAX_RETRIES`, or fall back to Ollama |
| "The model's reply could not be read", answers cut off | A reasoning model spent the token budget thinking | Raise `GROQ_MAX_TOKENS` or set `GROQ_REASONING_EFFORT=low` |
| Answers take about a minute | Local model on a CPU | Expected (see the table above). Use Groq, a GPU, or a smaller model |
| Warning "The language model is unavailable" | No provider answered | Fix the provider; the answer shown is one verbatim passage |
| First answer after start is slow | Model loading | Ollama is warmed at start-up; keep `OLLAMA_KEEP_ALIVE` high |

## For developers

Everything is in `backend/rag/providers/`; the single entry point is `backend/rag/llm_gateway.py`:

```python
from backend.rag.llm_gateway import execute_llm_generation
text, provider = execute_llm_generation(system_prompt, user_prompt)   # provider: ollama | groq | openai | gemini | fallback
```

| File | Role |
|---|---|
| `base.py` | `LLMProvider` interface, `Diagnosis`, key redaction, `env_first` (new name, then legacy names) |
| `chat_completions.py` | Shared OpenAI-style request, retry with `Retry-After`, parsing |
| `ollama.py`, `groq.py`, `openai_compat.py`, `gemini.py` | One provider each |
| `__init__.py` | Provider registry and the order table |

To add a provider, subclass `ChatCompletionsProvider` (OpenAI-compatible) or `LLMProvider`, implement `is_configured`, `generate`
and `describe` (plus `diagnose` for the doctor), register it in `CLASSES` and `ORDERS`, and add its settings to `.env.example`.
A provider returns `None` on any failure instead of raising, and must never log its key.

Tests run against a real local HTTP server that imitates Ollama and Groq (`backend/tests/fake_llm_server.py`), so they need no
network and no key: `cd backend && python -m pytest tests/test_llm_providers.py tests/test_llm_gateway.py`.
