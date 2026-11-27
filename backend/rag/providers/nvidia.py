"""NVIDIA NIM: fast hosted inference through NVIDIA's OpenAI-compatible endpoint (https://build.nvidia.com). Needs NVIDIA_API_KEY."""
from __future__ import annotations

from .base import Diagnosis, env_first, is_set
from .chat_completions import ChatCompletionsProvider, diagnose_models_endpoint

DEFAULT_BASE_URL = "https://integrate.api.nvidia.com/v1"
DEFAULT_MODEL = "nvidia/nemotron-3.5-bolt-e4b"


class NvidiaProvider(ChatCompletionsProvider):
    name = "nvidia"
    label = "NVIDIA NIM"
    supports_json_mode = False
    retry_network_errors = True

    def __init__(self) -> None:
        base = env_first("NVIDIA_BASE_URL", default=DEFAULT_BASE_URL).rstrip("/")
        self.base_url = base
        self.chat_url = f"{base}/chat/completions"
        self.api_key = env_first("NVIDIA_API_KEY")
        self.model = env_first("NVIDIA_MODEL", default=DEFAULT_MODEL)
        self.timeout = float(env_first("NVIDIA_TIMEOUT", default="60"))
        self.default_max_tokens = int(env_first("NVIDIA_MAX_TOKENS", default="700"))
        self.max_retries = int(env_first("NVIDIA_MAX_RETRIES", default="2"))

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
            key_env="NVIDIA_API_KEY",
            model_env="NVIDIA_MODEL",
            base_url_env="NVIDIA_BASE_URL",
            key_hint="Create a key at https://build.nvidia.com and put it in .env (never in git).",
        )
