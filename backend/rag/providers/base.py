"""Common interface for every language-model backend (Ollama, Groq, any OpenAI-compatible API, Gemini).

A provider turns a (system prompt, user prompt) pair into text. It never raises for an ordinary failure (network down, bad key,
rate limit, model missing): it logs one warning and returns None, so the gateway can try the next provider.
"""
from __future__ import annotations

import abc
import re
from dataclasses import dataclass, field
from typing import Optional

from loguru import logger


@dataclass
class Diagnosis:
    """Result of `LLMProvider.diagnose()`: whether the provider can answer, in words a person can act on. Never contains a secret."""

    ok: bool
    summary: str
    hint: str = ""
    models: list[str] = field(default_factory=list)


class LLMProvider(abc.ABC):
    name: str = "provider"          # short id used in logs, settings and the `provider_used` value
    label: str = "Provider"         # human name shown by the doctor script
    supports_json_mode = False      # whether the endpoint can be asked for a JSON object

    @abc.abstractmethod
    def is_configured(self) -> bool:
        """True when this provider has what it needs (a key, a host). An unconfigured provider is skipped without any network call."""

    @abc.abstractmethod
    def generate(self, system: str, user: str, *, max_tokens: Optional[int] = None, json_mode: bool = True) -> Optional[str]:
        """The model's text, or None on any failure."""

    @abc.abstractmethod
    def describe(self) -> dict:
        """Non-secret settings (model, host) for logs and the doctor script."""

    def diagnose(self) -> Diagnosis:
        """Cheap reachability and configuration check without generating text. Subclasses override with something more specific."""
        return Diagnosis(self.is_configured(), "configured" if self.is_configured() else "not configured")

    # ---- shared helpers -------------------------------------------------------------------------------------------------
    def _secrets(self) -> tuple[str, ...]:
        return ()

    def _redact(self, text: str) -> str:
        for secret in self._secrets():
            if secret:
                text = text.replace(secret, "***")
        return re.sub(r"(?i)(bearer\s+)[\w\-.=]{8,}", r"\1***", text)

    def _warn(self, message: str) -> None:
        logger.warning(f"{self.label}: {self._redact(message)}")


def is_set(value: Optional[str]) -> bool:
    """A setting counts as set when it is non-empty and not one of the `your_...` placeholders from .env.example."""
    return bool(value) and not str(value).strip().lower().startswith("your_")


def env_first(*names: str, default: str = "", allow_empty: bool = False) -> str:
    """The first environment variable among `names` (new name first, then legacy names), else `default`.

    An empty value counts as "not set" unless `allow_empty` is true (then an explicitly empty variable wins, e.g. `OLLAMA_REASONING=`
    to leave the reasoning option out of the request).
    """
    import os

    for name in names:
        value = os.environ.get(name)
        if value is not None and (allow_empty or value.strip() != ""):
            return value.strip()
    return default
