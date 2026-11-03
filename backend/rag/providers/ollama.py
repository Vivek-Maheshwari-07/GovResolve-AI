"""Ollama: local models, no key, works offline. Talks to Ollama's OpenAI-compatible endpoint (`/v1/chat/completions`)."""
from __future__ import annotations

from typing import Optional
from urllib.parse import urlparse

from loguru import logger

from ._http import HTTPFailure, request_json
from .base import Diagnosis, env_first
from .chat_completions import ChatCompletionsProvider

DEFAULT_HOST = "http://localhost:11434"
DEFAULT_MODEL = "qwen3.5:4b"


def ollama_host() -> str:
    """Base URL of the Ollama server: OLLAMA_HOST, else the older OLLAMA_URL / LOCAL_LLM_URL, else localhost.

    Accepts the forms Ollama itself accepts (`127.0.0.1:11434`, `http://host:11434`, `0.0.0.0`).
    """
    raw = env_first("OLLAMA_HOST", "OLLAMA_URL", "LOCAL_LLM_URL", default=DEFAULT_HOST)
    if "/v1/" in raw:  # an old LOCAL_LLM_URL holds the whole chat URL
        raw = raw.split("/v1/")[0]
    if "://" not in raw:
        raw = "http://" + raw
    parsed = urlparse(raw)
    host = parsed.hostname or "localhost"
    if host in ("0.0.0.0", "::"):
        host = "localhost"
    port = parsed.port or 11434
    return f"{parsed.scheme}://{host}:{port}"


def _same_model(wanted: str, available: str) -> bool:
    strip = lambda n: n[: -len(":latest")] if n.endswith(":latest") else n  # noqa: E731
    return strip(wanted) == strip(available)


class OllamaProvider(ChatCompletionsProvider):
    name = "ollama"
    label = "Ollama"
    supports_json_mode = True
    retry_network_errors = False  # a refused connection means Ollama is not running: fail fast

    def __init__(self) -> None:
        self.host = ollama_host()
        self.chat_url = f"{self.host}/v1/chat/completions"
        self.model = env_first("OLLAMA_MODEL", "LOCAL_LLM_MODEL", default=DEFAULT_MODEL)
        self.timeout = float(env_first("OLLAMA_TIMEOUT", "LOCAL_LLM_TIMEOUT", default="180"))  # the first call also loads the model
        self.default_max_tokens = int(env_first("OLLAMA_MAX_TOKENS", "LOCAL_LLM_MAX_TOKENS", default="700"))  # bounds latency
        self.keep_alive = env_first("OLLAMA_KEEP_ALIVE", "LOCAL_LLM_KEEP_ALIVE", default="30m")
        # thinking models (qwen3.5) time out on a CPU unless reasoning is off; set OLLAMA_REASONING= (empty) to omit the option
        self.reasoning_effort = env_first("OLLAMA_REASONING", "LOCAL_LLM_REASONING", default="none", allow_empty=True)

    def is_configured(self) -> bool:
        return True  # no key needed; reachability is checked by trying

    def describe(self) -> dict:
        return {"provider": self.name, "host": self.host, "model": self.model, "timeout_s": self.timeout}

    # ---- model management -----------------------------------------------------------------------------------------------
    def list_models(self) -> list[str]:
        data = request_json(f"{self.host}/api/tags", timeout=5)
        return [m.get("name", "") for m in data.get("models", [])]

    def diagnose(self) -> Diagnosis:
        try:
            models = self.list_models()
        except HTTPFailure as e:
            return Diagnosis(False, f"not reachable at {self.host} ({e.reason})", "Start it with `ollama serve` (or open the Ollama app), or set OLLAMA_HOST.")
        if not any(_same_model(self.model, m) for m in models):
            return Diagnosis(False, f"running, but model '{self.model}' is not installed", f"Run: ollama pull {self.model}", models)
        return Diagnosis(True, f"running, model '{self.model}' installed", models=models)

    def warm_up(self, system_prompt: Optional[str] = None) -> bool:
        """Load the model into memory and keep it there, so the first real question does not pay for loading it.

        With `system_prompt`, also send it once through the normal chat call: Ollama keeps the processed form of an unchanged prompt
        prefix, so the first real question skips reading it. Best effort: failures are logged at info level and ignored.
        """
        try:
            request_json(f"{self.host}/api/generate", {"model": self.model, "prompt": "", "stream": False, "keep_alive": self.keep_alive}, timeout=self.timeout)
            if system_prompt:
                self.generate(system_prompt, "Warm-up. Reply with {}.", max_tokens=1)
            return True
        except HTTPFailure as e:
            logger.info(f"Ollama warm-up skipped: {e.reason}")
            return False
