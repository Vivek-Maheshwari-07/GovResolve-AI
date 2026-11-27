"""Language-model providers and the order in which the gateway tries them.

    LLM_PROVIDER = ollama | groq | nvidia | openai | gemini | auto        (legacy values `local` and `api` still work)

The named provider is tried first; the others follow if it is not configured or fails. A provider without its key or host is skipped
without any network call.
"""
from __future__ import annotations

import os

from .base import Diagnosis, LLMProvider, env_first, is_set
from .gemini import GeminiProvider
from .groq import GroqProvider
from .nvidia import NvidiaProvider
from .ollama import OllamaProvider, ollama_host
from .openai_compat import OpenAICompatibleProvider

ALIASES = {"local": "ollama", "api": "openai", "": "ollama"}
ORDERS = {
    "ollama": ["ollama", "groq", "openai", "gemini"],
    "groq": ["groq", "ollama", "openai", "gemini"],
    "nvidia": ["nvidia", "groq", "gemini", "openai", "ollama"],
    "openai": ["openai", "ollama", "groq", "gemini"],
    "gemini": ["gemini", "ollama", "groq", "openai"],
    "auto": ["groq", "openai", "gemini", "ollama"],  # whichever hosted service has a key, then the local model
}
CLASSES = {
    "ollama": OllamaProvider,
    "groq": GroqProvider,
    "nvidia": NvidiaProvider,
    "openai": OpenAICompatibleProvider,
    "gemini": GeminiProvider,
}


def selected_provider() -> str:
    """The normalised first choice from LLM_PROVIDER. An unknown value behaves like the default (ollama)."""
    raw = os.environ.get("LLM_PROVIDER", "ollama").strip().lower()
    name = ALIASES.get(raw, raw)
    return name if name in ORDERS else "ollama"


def build_providers(first: str | None = None) -> list[LLMProvider]:
    """Provider instances in the order they should be tried (settings are read from the environment now)."""
    choice = first or selected_provider()
    order = list(ORDERS[choice])
    if "nvidia" not in order and is_set(os.environ.get("NVIDIA_API_KEY")):
        # Include configured NVIDIA NIM in auto/fallback chains right after Groq, or before Ollama.
        insert_at = 1 if choice == "auto" else len(order) - 1
        order.insert(insert_at, "nvidia")
    return [CLASSES[n]() for n in order]


__all__ = [
    "Diagnosis", "LLMProvider", "GeminiProvider", "GroqProvider", "NvidiaProvider", "OllamaProvider",
    "OpenAICompatibleProvider", "build_providers", "selected_provider", "ollama_host", "env_first", "is_set",
    "ORDERS", "ALIASES",
]
