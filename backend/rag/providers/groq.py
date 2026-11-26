"""Groq: fast hosted inference through its OpenAI-compatible API (https://console.groq.com). Needs GROQ_API_KEY."""
from __future__ import annotations

from .base import Diagnosis, env_first, is_set
from .chat_completions import ChatCompletionsProvider, diagnose_models_endpoint

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
        return diagnose_models_endpoint(
            base_url=self.base_url,
            headers=self._headers(),
            model=self.model,
            configured=self.is_configured(),
            key_env="GROQ_API_KEY",
            model_env="GROQ_MODEL",
            base_url_env="GROQ_BASE_URL",
            key_hint="Create a key at https://console.groq.com/keys and put it in .env (never in git).",
        )
