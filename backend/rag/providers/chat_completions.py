"""Base class for endpoints that speak the OpenAI `chat/completions` protocol (Ollama, Groq, OpenRouter, OpenAI, Together, vLLM, ...)."""
from __future__ import annotations

import time
from typing import Optional

from ._http import HTTPFailure, request_json
from .base import Diagnosis, LLMProvider

RETRY_STATUSES = {429, 500, 502, 503, 504}
MAX_BACKOFF_SECONDS = 8.0


class ChatCompletionsProvider(LLMProvider):
    """Subclasses fill in the connection settings; the request, retry and parsing logic lives here."""

    chat_url: str = ""
    model: str = ""
    api_key: str = ""
    timeout: float = 60.0
    default_max_tokens: int = 700
    max_retries: int = 0            # extra attempts after a 429 / 5xx answer
    retry_network_errors = False    # also retry timeouts and refused connections (useful for a hosted API, pointless for localhost)
    reasoning_effort: str = ""      # sent as `reasoning_effort` when set (thinking models)

    # ---- request -------------------------------------------------------------------------------------------------------
    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}

    def _payload(self, system: str, user: str, max_tokens: Optional[int], json_mode: bool) -> dict:
        body = {
            "model": self.model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "temperature": 0.0,  # deterministic: the same question must give the same answer and citation
            "max_tokens": max_tokens or self.default_max_tokens,
        }
        if self.reasoning_effort:
            body["reasoning_effort"] = self.reasoning_effort
        if json_mode and self.supports_json_mode:
            body["response_format"] = {"type": "json_object"}
        return body

    def _secrets(self) -> tuple[str, ...]:
        return (self.api_key,)

    def generate(self, system: str, user: str, *, max_tokens: Optional[int] = None, json_mode: bool = True) -> Optional[str]:
        if not self.is_configured():
            return None
        payload = self._payload(system, user, max_tokens, json_mode)
        attempts = 1 + max(0, self.max_retries)
        for attempt in range(attempts):
            try:
                data = request_json(self.chat_url, payload, self._headers(), self.timeout)
                text = data["choices"][0]["message"]["content"]
                return text if isinstance(text, str) else None
            except HTTPFailure as e:
                retryable = e.status in RETRY_STATUSES or (e.status is None and self.retry_network_errors)
                if retryable and attempt + 1 < attempts:
                    delay = min(e.retry_after if e.retry_after is not None else 2.0 ** attempt, MAX_BACKOFF_SECONDS)
                    self._warn(f"{e.status or 'network error'} ({e.reason}); retrying in {delay:.0f}s ({attempt + 1}/{attempts - 1})")
                    time.sleep(delay)
                    continue
                self._warn(f"request failed: {e.status or 'network error'} {e.reason} at {self.chat_url}"
                           + (f": {e.body[:200]}" if e.body else "") + self._hint_for(e.status))
                return None
            except (KeyError, IndexError, TypeError):
                self._warn(f"unexpected response shape from {self.chat_url}")
                return None
        return None

    def _hint_for(self, status: Optional[int]) -> str:
        hints = {401: " (check the API key)", 403: " (access refused: key, region or user agent)", 404: " (wrong model name or URL)", 429: " (rate limit reached)"}
        return hints.get(status, "")

    def diagnose(self) -> Diagnosis:  # pragma: no cover - overridden
        return Diagnosis(self.is_configured(), "configured" if self.is_configured() else "not configured")
