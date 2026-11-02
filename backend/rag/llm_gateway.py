"""
Squad 2 — Pluggable LLM Gateway
Supports:
  - Local OpenAI-compatible endpoints (Ollama / vLLM / LM Studio / llama.cpp): the default, works offline
  - Hosted OpenAI-compatible API (Groq, OpenRouter, OpenAI, Together, ...): set LLM_API_URL, LLM_API_KEY, LLM_API_MODEL
  - Google Gemini API (gemini-2.0-flash / gemini-1.5-pro)
  - Graceful deterministic fallback when nothing answers
LLM_PROVIDER picks the first choice (local | api | gemini | auto); the others are tried after it if it fails or is not configured.
"""
from __future__ import annotations

import json
import os
import re
from typing import Optional
from loguru import logger
import urllib.request
import urllib.error

# Config from environment
LLM_PROVIDER    = os.getenv("LLM_PROVIDER", "local")      # "local" | "api" | "gemini" | "auto" (auto = api, gemini, local)
LLM_API_URL     = os.getenv("LLM_API_URL", "")           # hosted OpenAI-compatible chat endpoint, e.g. https://api.groq.com/openai/v1/chat/completions
LLM_API_KEY     = os.getenv("LLM_API_KEY", "")
LLM_API_MODEL   = os.getenv("LLM_API_MODEL", "")
LLM_API_TIMEOUT = float(os.getenv("LLM_API_TIMEOUT", "60"))
GOOGLE_API_KEY  = os.getenv("GOOGLE_API_KEY", "")
GEMINI_MODEL    = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
LOCAL_LLM_URL   = os.getenv("LOCAL_LLM_URL", "http://localhost:11434/v1/chat/completions")
LOCAL_LLM_MODEL = os.getenv("LOCAL_LLM_MODEL", "gemma3:4b")
LOCAL_LLM_REASONING = os.getenv("LOCAL_LLM_REASONING", "none")  # thinking models (qwen3.5) time out otherwise; "" to omit
LOCAL_LLM_KEEP_ALIVE = os.getenv("LOCAL_LLM_KEEP_ALIVE", "30m")  # how long Ollama keeps the model loaded after warm-up
LOCAL_LLM_TIMEOUT = float(os.getenv("LOCAL_LLM_TIMEOUT", "180"))  # seconds; first call also loads the model

try:
    from google import genai
    from google.genai import types as genai_types
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False


def call_local_llm(system_prompt: str, user_prompt: str, max_tokens: Optional[int] = None, json_mode: bool = True) -> Optional[str]:
    """Call an OpenAI-compatible local LLM endpoint (Ollama / vLLM / LM Studio)."""
    payload = {
        "model": LOCAL_LLM_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.0,
        "max_tokens": max_tokens or int(os.getenv("LOCAL_LLM_MAX_TOKENS", "700")),  # Gujarati costs many tokens; this bounds latency
        "response_format": {"type": "json_object"} if json_mode and "ollama" not in LOCAL_LLM_URL else None
    }
    if LOCAL_LLM_REASONING:
        payload["reasoning_effort"] = LOCAL_LLM_REASONING
    
    headers = {"Content-Type": "application/json"}
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(LOCAL_LLM_URL, data=data, headers=headers)
    
    try:
        with urllib.request.urlopen(req, timeout=LOCAL_LLM_TIMEOUT) as resp:
            res_body = resp.read().decode("utf-8")
            res_json = json.loads(res_body)
            content = res_json["choices"][0]["message"]["content"]
            return content
    except Exception as e:
        logger.warning(f"Local LLM call failed at {LOCAL_LLM_URL}: {e}")
        return None


def _is_set(value: str) -> bool:
    return bool(value) and not value.startswith("your_")


def call_api_llm(system_prompt: str, user_prompt: str, max_tokens: Optional[int] = None) -> Optional[str]:
    """Call a hosted OpenAI-compatible chat endpoint (Groq, OpenRouter, OpenAI, Together, ...). None if not configured or failed.
    The key is sent only in the Authorization header and never logged."""
    if not (_is_set(LLM_API_URL) and _is_set(LLM_API_KEY) and _is_set(LLM_API_MODEL)):
        return None
    payload = {
        "model": LLM_API_MODEL,
        "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
        "temperature": 0.0,
        "max_tokens": max_tokens or int(os.getenv("LLM_API_MAX_TOKENS", "700")),
    }  # no response_format / reasoning options: not every hosted model accepts them, and the reply parser is tolerant
    req = urllib.request.Request(LLM_API_URL, data=json.dumps(payload).encode("utf-8"), headers={
        "Content-Type": "application/json", "Authorization": f"Bearer {LLM_API_KEY}", "User-Agent": "GovResolve-AI/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=LLM_API_TIMEOUT) as resp:
            return json.loads(resp.read().decode("utf-8"))["choices"][0]["message"]["content"]
    except urllib.error.HTTPError as e:
        logger.warning(f"LLM API call failed: HTTP {e.code} {e.reason} from {LLM_API_URL}: {e.read()[:200].decode('utf-8', 'replace')}")
    except Exception as e:
        logger.warning(f"LLM API call failed at {LLM_API_URL}: {type(e).__name__}: {e}")
    return None


def warm_up_local_llm(system_prompt: Optional[str] = None) -> bool:
    """Load the local model into memory and keep it there, so the first real question does not pay for loading it.
    With `system_prompt`, also send it once through the normal chat call: the server keeps the processed form of an unchanged
    prompt prefix, so the first real question skips reading it. Best effort: only meaningful for Ollama; failures are ignored."""
    if LLM_PROVIDER.lower() in ("api", "gemini") or "/v1/" not in LOCAL_LLM_URL:
        return False  # the local model is only a fallback then; do not spend start-up time loading it
    base = LOCAL_LLM_URL.split("/v1/")[0]
    body = json.dumps({"model": LOCAL_LLM_MODEL, "prompt": "", "stream": False, "keep_alive": LOCAL_LLM_KEEP_ALIVE}).encode("utf-8")
    try:
        req = urllib.request.Request(f"{base}/api/generate", data=body, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=LOCAL_LLM_TIMEOUT):
            pass
        if system_prompt:
            call_local_llm(system_prompt, "Warm-up. Reply with {}.", max_tokens=1)
        return True
    except Exception as e:
        logger.info(f"Local LLM warm-up skipped: {e}")
        return False


def call_gemini_api(system_prompt: str, user_prompt: str) -> Optional[str]:
    """Call Google Gemini API using google-genai SDK."""
    if not GEMINI_AVAILABLE or not GOOGLE_API_KEY or GOOGLE_API_KEY.startswith("your_"):
        return None
    try:
        client = genai.Client(api_key=GOOGLE_API_KEY)
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=user_prompt,
            config=genai_types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.0,
                max_output_tokens=2500,
            ),
        )
        return response.text
    except Exception as e:
        logger.warning(f"Gemini API call failed: {e}")
        return None


def execute_llm_generation(system_prompt: str, user_prompt: str, max_tokens: Optional[int] = None, json_mode: bool = True) -> tuple[str, str]:
    """
    Run the prompt through the configured providers in order and return (raw_llm_output, provider_used).
    The first choice is LLM_PROVIDER; the rest follow if it is not configured or fails, so a flaky network never costs
    the answer when local Ollama is running. If nothing answers, a canned reply with no statements is returned.
    """
    calls = {"api": call_api_llm, "gemini": call_gemini_api, "local": call_local_llm}
    order = {"api": ["api", "local", "gemini"], "gemini": ["gemini", "local", "api"],
             "local": ["local", "api", "gemini"], "auto": ["api", "gemini", "local"]}.get(
        LLM_PROVIDER.lower(), ["local", "api", "gemini"])
    for n, name in enumerate(order):
        extra = {}
        if max_tokens and name != "gemini":
            extra["max_tokens"] = max_tokens
        if not json_mode and name == "local":
            extra["json_mode"] = False  # plain text wanted (translation), not the JSON object the answers use
        out = calls[name](system_prompt, user_prompt, **extra)
        if out:
            return out, name
        if n == 0:
            logger.warning(f"LLM provider '{name}' gave no answer (not configured or failed); trying the others.")

    # Deterministic offline fallback
    fallback_response = {
        "summary": "Retrieved official provisions from matched resolutions. (LLM synthesis provider inactive or unreachable)",
        "statements": [],
        "answer_status": "Found, no later change",
        "insufficient_reason": None,
        "follow_up_question": None
    }
    return json.dumps(fallback_response), "fallback"


TRANSLATE_SYSTEM = (
    "You translate questions about Gujarat Government Resolutions into English. The question may be in Gujarati, in Gujarati written in "
    "Latin letters, or mixed with English. Reply with the English translation only: one sentence, no quotes, no explanation. "
    "Keep numbers, dates, GR numbers and names exactly as written. If the question is already English, repeat it."
)
_TRANSLATIONS: dict[str, str] = {}
_TRANSLATIONS_LOADED = False


def _translation_cache_path() -> Optional[str]:
    """Where translations are remembered between runs (so the same question costs one model call ever); '' disables the file."""
    path = os.getenv("TRANSLATION_CACHE")
    if path is None:
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data", "index", "translations.json")
    return os.path.abspath(path) if path else None


def _clean_translation(reply: str) -> Optional[str]:
    """The model's reply as one plain English sentence, or None if it is empty or not English (a failed translation)."""
    reply = (reply or "").strip()
    if reply.startswith("{"):  # a model told to answer in JSON: take its first string value
        try:
            values = [v for v in json.loads(reply).values() if isinstance(v, str)]
        except (ValueError, AttributeError):
            values = []
        reply = values[0] if values else ""
    lines = [ln.strip() for ln in reply.splitlines() if ln.strip()]
    if not lines:
        return None
    text = re.sub(r"^(?:english\s+)?translation\s*[:\-]\s*", "", lines[0], flags=re.I).strip().strip("\"'`“”‘’ ")
    latin = len(re.findall(r"[A-Za-z]", text))
    gujarati = len(re.findall(r"[઀-૿]", text))
    if len(text) < 3 or latin < 3 or gujarati > latin:
        return None
    return text[:300]


def translate_to_english(question: str) -> Optional[str]:
    """One short model call that renders a Gujarati / Gujlish question in English, so keyword search and sentence choice can match the
    (mostly English) documents. None when no model answers or the reply is not English; the caller then searches as before.
    Remembered in memory and in a small JSON file, so repeated runs and repeated questions cost nothing."""
    global _TRANSLATIONS_LOADED
    path = _translation_cache_path()
    if path and not _TRANSLATIONS_LOADED:
        _TRANSLATIONS_LOADED = True
        try:
            with open(path, encoding="utf-8") as f:
                _TRANSLATIONS.update(json.load(f))
        except (OSError, ValueError):
            pass
    key = question.strip()
    if key in _TRANSLATIONS:
        return _TRANSLATIONS[key] or None
    reply, provider = execute_llm_generation(TRANSLATE_SYSTEM, key, max_tokens=80, json_mode=False)
    if provider == "fallback":
        return None  # nothing answered; do not remember a failure
    english = _clean_translation(reply)
    _TRANSLATIONS[key] = english or ""
    if path:
        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w", encoding="utf-8") as f:
                json.dump(_TRANSLATIONS, f, ensure_ascii=False, indent=0)
        except OSError:
            pass
    return english
