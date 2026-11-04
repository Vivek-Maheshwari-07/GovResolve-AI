"""Google Gemini through the `google-genai` SDK (optional: `pip install google-genai`). Needs GOOGLE_API_KEY."""
from __future__ import annotations

from typing import Optional

from .base import Diagnosis, LLMProvider, env_first, is_set


class GeminiProvider(LLMProvider):
    name = "gemini"
    label = "Google Gemini"

    def __init__(self) -> None:
        self.api_key = env_first("GOOGLE_API_KEY")
        self.model = env_first("GEMINI_MODEL", default="gemini-2.5-flash")
        self.max_output_tokens = int(env_first("GEMINI_MAX_TOKENS", default="2500"))
        self._client = None

    def _get_client(self):
        if self._client is None and self.api_key:
            from google import genai
            self._client = genai.Client(api_key=self.api_key)
        return self._client

    def _secrets(self) -> tuple[str, ...]:
        return (self.api_key,)

    def is_configured(self) -> bool:
        try:
            import google.genai  # noqa: F401
        except ImportError:
            return False
        return is_set(self.api_key)

    def describe(self) -> dict:
        return {"provider": self.name, "model": self.model, "key_set": is_set(self.api_key)}

    def diagnose(self) -> Diagnosis:
        if not is_set(self.api_key):
            return Diagnosis(False, "GOOGLE_API_KEY is not set", "Optional provider.")
        if not self.is_configured():
            return Diagnosis(False, "the google-genai package is not installed", "pip install google-genai")
        return Diagnosis(True, "configured (not probed: use the doctor's ping)")

    def generate(self, system: str, user: str, *, max_tokens: Optional[int] = None, json_mode: bool = True) -> Optional[str]:
        if not self.is_configured():
            return None
        try:
            from google.genai import types

            client = self._get_client()
            if not client:
                return None
            response = client.models.generate_content(
                model=self.model, contents=user,
                config=types.GenerateContentConfig(system_instruction=system, temperature=0.0, max_output_tokens=self.max_output_tokens))
            return response.text
        except Exception as e:  # the SDK raises many types; any failure means "try the next provider"
            self._warn(f"request failed: {type(e).__name__}: {e}")
            return None
