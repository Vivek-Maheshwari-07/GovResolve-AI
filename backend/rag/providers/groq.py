"""Groq: fast hosted inference through its OpenAI-compatible API (https://console.groq.com). Needs GROQ_API_KEY."""
from __future__ import annotations

from .base import Diagnosis, env_first, is_set
from .chat_completions import ChatCompletionsProvider, diagnose_models_endpoint

DEFAULT_BASE_URL = "https://api.groq.com/openai/v1"
DEFAULT_MODEL = "openai/gpt-oss-120b"  # the model the team evaluated; model names change, check console.groq.com/docs/models
DEFAULT_FALLBACKS = "openai/gpt-oss-20b,qwen/qwen3.8-27b"  # tried in order when the model above is rate-limited or missing
# Reasoning models spend part of max_tokens thinking before they write: a 3- or 8-token cap (the answer check, the smoke ping)
# would come back empty. Their cap is raised to at least this; the reply itself stays as short as the prompt asks.
REASONING_MIN_TOKENS = 256


def _is_reasoning_model(model: str) -> bool:
    return model.startswith("openai/gpt-oss") or "qwen3" in model


def _takes_reasoning_effort(model: str) -> bool:
    """gpt-oss accepts low / medium / high; other models reject or interpret the option differently."""
    return model.startswith("openai/gpt-oss")


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

        # Each Groq model has its own rate limit. When the first one is rate-limited (free tier: about 8,000 tokens a minute for
        # gpt-oss-120b) the next model answers in about a second, instead of waiting or dropping to a local model that takes a minute.
        fallbacks = env_first("GROQ_FALLBACK_MODELS", default=DEFAULT_FALLBACKS, allow_empty=True)
        self.models = list(dict.fromkeys([self.model] + [m.strip() for m in fallbacks.split(",") if m.strip()]))

    def _payload(self, system: str, user: str, max_tokens, json_mode: bool) -> dict:
        body = super()._payload(system, user, max_tokens, json_mode)
        if _is_reasoning_model(self.model):
            body["max_tokens"] = max(int(body.get("max_tokens") or 0), REASONING_MIN_TOKENS)
        effort = self.reasoning_effort or ("low" if self.model.startswith("openai/gpt-oss") else "")
        if effort and _takes_reasoning_effort(self.model):
            body["reasoning_effort"] = effort      # low = fastest; only reasoning models accept the option
        else:
            body.pop("reasoning_effort", None)
        return body

    def generate(self, system: str, user: str, *, max_tokens=None, json_mode: bool = True):
        """Try the configured model, then each of GROQ_FALLBACK_MODELS. A rate limit or an unavailable model moves on at once
        (retries only on the last model); a rejected key (401) stops, since no model will accept it."""
        primary, primary_retries = self.model, self.max_retries
        try:
            for i, model in enumerate(self.models):
                self.model = model
                self.max_retries = primary_retries if i == len(self.models) - 1 else 0
                out = super().generate(system, user, max_tokens=max_tokens, json_mode=json_mode)
                if out:
                    if model != primary:
                        self._warn(f"answered by fallback model '{model}' ('{primary}' was unavailable or rate-limited)")
                    self.answered_by = model
                    return out
                if self.last_status in (401, 403):
                    break
            return None
        finally:
            self.model, self.max_retries = primary, primary_retries

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
