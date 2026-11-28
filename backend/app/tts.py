"""Text-to-speech for the chat's spoken replies (`POST /voice/speak`).

Uses the `edge-tts` package (Microsoft neural voices, no API key; the text is sent to Microsoft's speech service).
Optional: when the package is missing, or TTS_PROVIDER=off, the endpoint answers 503 and the web app falls back to the
browser's own voices. Only the text to be read aloud is sent, never the question or any document.
"""
from __future__ import annotations

import os
import re
from collections import OrderedDict

MAX_CHARS = 1200
_CACHE_SIZE = 32
_cache: OrderedDict[tuple[str, str], bytes] = OrderedDict()

_DEFAULT_VOICES = {"gu": "gu-IN-DhwaniNeural", "en": "en-IN-NeerjaNeural"}


class TTSUnavailable(RuntimeError):
    """No speech service is configured or installed."""


def enabled() -> bool:
    if (os.environ.get("TTS_PROVIDER") or "edge").strip().lower() in ("off", "none", "0", "false"):
        return False
    try:
        import edge_tts  # noqa: F401
    except ImportError:
        return False
    return True


def pick_language(text: str, requested: str | None = None) -> str:
    """'gu' or 'en': the requested one, else Gujarati when the text has Gujarati script."""
    if (requested or "").strip().lower() in ("gu", "en"):
        return requested.strip().lower()
    return "gu" if re.search(r"[઀-૿]", text or "") else "en"


def voice_for(language: str) -> str:
    return (os.environ.get(f"TTS_VOICE_{language.upper()}") or _DEFAULT_VOICES[language]).strip()


def speakable(text: str) -> str:
    """Strip markup and citation tags so the voice does not read them out, and cap the length."""
    out = re.sub(r"\[S\d+\]|\[Reference:[^\]]*\]", " ", text or "")
    out = re.sub(r"[*_`#>]+", " ", out)
    out = re.sub(r"\s+", " ", out).strip()
    if len(out) > MAX_CHARS:
        out = out[: MAX_CHARS - 1].rsplit(" ", 1)[0] + "…"
    return out


async def synthesize(text: str, language: str) -> tuple[bytes, str]:
    """MP3 bytes of `text` read in `language`, and the voice used."""
    if not enabled():
        raise TTSUnavailable("Text-to-speech is not available (install edge-tts or unset TTS_PROVIDER=off).")
    import edge_tts

    voice = voice_for(language)
    key = (voice, text)
    if key in _cache:
        _cache.move_to_end(key)
        return _cache[key], voice
    chunks: list[bytes] = []
    async for part in edge_tts.Communicate(text, voice).stream():
        if part["type"] == "audio":
            chunks.append(part["data"])
    audio = b"".join(chunks)
    if not audio:
        raise TTSUnavailable("The speech service returned no audio.")
    _cache[key] = audio
    while len(_cache) > _CACHE_SIZE:
        _cache.popitem(last=False)
    return audio, voice
