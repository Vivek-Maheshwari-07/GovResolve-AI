"""Groq: fast hosted inference through its OpenAI-compatible API (https://console.groq.com). Needs GROQ_API_KEY."""
from __future__ import annotations

from ._http import HTTPFailure, request_json
from .base import Diagnosis, env_first, is_set
from .chat_completions import ChatCompletionsProvider

DEFAULT_BASE_URL = "https://api.groq.com/openai/v1"
DEFAULT_MODEL = "openai/gpt-oss-120b"  # the model the team evaluated; model names change, check console.groq.com/docs/models


class GroqProvider(ChatCompletionsProvider):
    name = "groq"
    label = "Groq"
    supports_json_mode = False        # not every Groq model accepts response_format; the reply parser tolerates plain JSON text
    retry_network_errors = True       # a hosted API can blip; local servers cannot

    def __init__(self) -> None:
        base = env_first("GROQ_BASE_URL", default=DEFAULT_BASE_URL).rstrip("/")
        self.base_url = base
        self.chat_url = f"{base}/chat/completions"
        self.api_key = env_first("GROQ_API_KEY")
        self.model = env_first("GROQ_MODEL", default=DEFAULT_MODEL)
        self.timeout = float(env_first("GROQ_TIMEOUT", default="60"))
        self.default_max_tokens = int(env_first("GROQ_MAX_TOKENS", default="700"))
        self.max_retries = int(env_first("GROQ_MAX_RETRIES", default="2"))  # free tiers rate-limit: honour Retry-After, then try again
        self.reasoning_effort = env_first("GROQ_REASONING_EFFORT")          # low | medium | high for reasoning models; empty = server default

    def is_configured(self) -> bool:
        return is_set(self.api_key)

    def describe(self) -> dict:
        return {"provider": self.name, "base_url": self.base_url, "model": self.model, "key_set": self.is_configured(), "max_retries": self.max_retries}

    def diagnose(self) -> Diagnosis:
        if not self.is_configured():
            return Diagnosis(False, "GROQ_API_KEY is not set", "Create a key at https://console.groq.com/keys and put it in .env (never in git).")
        try:
            data = request_json(f"{self.base_url}/models", headers=self._headers(), timeout=10)
        except HTTPFailure as e:
            hint = {401: "The key was rejected: check GROQ_API_KEY.", 403: "Access refused: check the key and your region."}.get(e.status, "Check your network and GROQ_BASE_URL.")
            return Diagnosis(False, f"request failed: {e.status or 'network error'} {e.reason}", hint)
        models = sorted(m.get("id", "") for m in data.get("data", []))
        if self.model not in models:
            return Diagnosis(False, f"key works, but model '{self.model}' is not available to it", "Pick one from the list below and set GROQ_MODEL.", models)
        return Diagnosis(True, f"key works, model '{self.model}' available", models=models)
