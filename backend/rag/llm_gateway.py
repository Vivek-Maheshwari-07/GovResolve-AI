"""One entry point for every language-model call in the project.

    execute_llm_generation(system, user)  ->  (text, provider_name)

The providers (Ollama, Groq, any OpenAI-compatible API, Gemini) live in `backend/rag/providers/`. `LLM_PROVIDER` picks the first
choice; the others follow if it is not configured or fails. If nothing answers, a canned reply with no statements comes back and the
pipeline falls back to quoting the best verbatim passage. See docs/LLM_PROVIDERS.md.
"""
from __future__ import annotations

import json
import os
import re
import threading
from typing import Optional

from loguru import logger

from backend.rag.providers import OllamaProvider, build_providers, selected_provider

FALLBACK_REPLY = {
    "summary": "Retrieved official provisions from matched resolutions. (LLM synthesis provider inactive or unreachable)",
    "statements": [],
    "answer_status": "Found, no later change",
    "insufficient_reason": None,
    "follow_up_question": None,
}


def execute_llm_generation(system_prompt: str, user_prompt: str, max_tokens: Optional[int] = None, json_mode: bool = True) -> tuple[str, str]:
    """Run the prompt through the configured providers in order and return (raw_output, provider_name).

    `provider_name` is "ollama", "groq", "openai", "gemini", or "fallback" when nothing answered (offline, unreachable, no key).
    """
    tried = 0
    for provider in build_providers():
        if not provider.is_configured():
            continue
        tried += 1
        out = provider.generate(system_prompt, user_prompt, max_tokens=max_tokens, json_mode=json_mode)
        if out:
            return out, provider.name
        logger.warning(f"LLM provider '{provider.name}' gave no answer; trying the next one.")
    if not tried:
        logger.warning(f"No LLM provider is configured (LLM_PROVIDER={selected_provider()}); see docs/LLM_PROVIDERS.md.")
    return json.dumps(FALLBACK_REPLY), "fallback"


def warm_up_llm(system_prompt: Optional[str] = None) -> bool:
    """Load the local model and its prompt prefix now, so the first question is not slow. Only done when Ollama is the model that
    would answer (the first configured provider); with a hosted first choice there is nothing to warm."""
    for provider in build_providers():
        if provider.is_configured():
            return provider.warm_up(system_prompt) if isinstance(provider, OllamaProvider) else False
    return False


TRANSLATE_SYSTEM = (
    "You translate questions about Gujarat Government Resolutions into English. The question may be in Gujarati, in Gujarati written in "
    "Latin letters, or mixed with English. Reply with the English translation only: one sentence, no quotes, no explanation. "
    "Keep numbers, dates, GR numbers and names exactly as written. If the question is already English, repeat it."
)
TRANSLATE_GU_SYSTEM = (
    "You translate questions about Gujarat Government Resolutions into formal Gujarati in Gujarati script (ગુજરાતી લિપિ). "
    "The question may be in English, Gujlish (Gujarati in Latin letters), or mixed. "
    "Reply with the Gujarati translation in Gujarati script only: one concise search query, no quotes, no explanation. "
    "Keep numbers, dates, and GR identifiers intact. If the question is already pure Gujarati script, repeat it."
)
_TRANSLATIONS: dict[str, str] = {}
_TRANSLATIONS_GU: dict[str, str] = {}
_TRANSLATION_LOCK = threading.Lock()
MAX_TRANSLATIONS = 5000   # oldest entries are dropped beyond this, so user questions cannot grow memory or the file without limit


def _remember(cache: dict, key: str, value: str) -> None:
    with _TRANSLATION_LOCK:
        cache.pop(key, None)
        cache[key] = value
        while len(cache) > MAX_TRANSLATIONS:
            cache.pop(next(iter(cache)))
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
    _remember(_TRANSLATIONS, key, english or "")
    if path:
        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            tmp = f"{path}.tmp"
            with _TRANSLATION_LOCK:
                with open(tmp, "w", encoding="utf-8") as f:
                    json.dump(_TRANSLATIONS, f, ensure_ascii=False, indent=0)
                os.replace(tmp, path)   # atomic: a crash never leaves a half-written cache
        except OSError:
            pass
    return english


def _clean_gujarati_translation(reply: str) -> Optional[str]:
    """The model's reply as one plain Gujarati sentence in Gujarati script, or None."""
    reply = (reply or "").strip()
    if reply.startswith("{"):
        try:
            values = [v for v in json.loads(reply).values() if isinstance(v, str)]
        except (ValueError, AttributeError):
            values = []
        reply = values[0] if values else ""
    lines = [ln.strip() for ln in reply.splitlines() if ln.strip()]
    if not lines:
        return None
    text = re.sub(r"^(?:gujarati\s+)?translation\s*[:\-]\s*", "", lines[0], flags=re.I).strip().strip("\"'`“”‘’ ")
    gujarati = len(re.findall(r"[઀-૿]", text))
    if gujarati < 2:
        return None
    return text[:300]


def translate_to_gujarati(question: str) -> Optional[str]:
    """One short model call that renders an English or Gujlish question in Gujarati script, so keyword search and sentence choice can
    match Gujarati resolutions. None when no model answers or the reply is not Gujarati script."""
    key = question.strip()
    if key in _TRANSLATIONS_GU:
        return _TRANSLATIONS_GU[key] or None
    reply, provider = execute_llm_generation(TRANSLATE_GU_SYSTEM, key, max_tokens=100, json_mode=False)
    if provider == "fallback":
        return None
    gujarati = _clean_gujarati_translation(reply)
    _remember(_TRANSLATIONS_GU, key, gujarati or "")
    return gujarati
