"""Any other OpenAI-compatible chat endpoint (OpenRouter, OpenAI, Together, vLLM, LM Studio, ...). Set LLM_API_URL, LLM_API_KEY, LLM_API_MODEL."""
from __future__ import annotations

from urllib.parse import urlparse

from .base import Diagnosis, env_first, is_set
from .chat_completions import ChatCompletionsProvider


class OpenAICompatibleProvider(ChatCompletionsProvider):
    name = "openai"
    label = "OpenAI-compatible API"
    retry_network_errors = True

    def __init__(self) -> None:
        self.chat_url = env_first("LLM_API_URL")
        self.api_key = env_first("LLM_API_KEY")
        self.model = env_first("LLM_API_MODEL")
        self.timeout = float(env_first("LLM_API_TIMEOUT", default="60"))
        self.default_max_tokens = int(env_first("LLM_API_MAX_TOKENS", default="700"))
        self.max_retries = int(env_first("LLM_API_MAX_RETRIES", default="1"))

    def is_configured(self) -> bool:
        return all(is_set(v) for v in (self.chat_url, self.api_key, self.model))

    def describe(self) -> dict:
        return {"provider": self.name, "host": urlparse(self.chat_url).netloc or "-", "model": self.model or "-", "key_set": is_set(self.api_key)}

    def diagnose(self) -> Diagnosis:
        if not self.is_configured():
            return Diagnosis(False, "LLM_API_URL, LLM_API_KEY and LLM_API_MODEL are not all set", "Optional: only needed for a provider other than Groq or Ollama.")
        return Diagnosis(True, "configured (not probed: use the doctor's ping)")
