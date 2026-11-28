"""Spoken replies: POST /voice/speak and its helpers (the speech service itself is faked)."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import tts
from app.routers import voice


def _client() -> TestClient:
    app = FastAPI()
    app.include_router(voice.router)
    return TestClient(app)


def test_language_follows_script_unless_requested():
    assert tts.pick_language("પંચવટી યોજના") == "gu"
    assert tts.pick_language("Leave rules") == "en"
    assert tts.pick_language("Leave rules", "gu") == "gu"
    assert tts.pick_language("પંચવટી", "en") == "en"
    assert tts.pick_language("hello", "fr") == "en"   # unsupported request: fall back to the script


def test_speakable_drops_markup_and_citation_tags_and_caps_length():
    assert tts.speakable("**Leave** is allowed [S1] under `rule` 4.") == "Leave is allowed under rule 4."
    long = ("word " * 600).strip()
    out = tts.speakable(long)
    assert len(out) <= tts.MAX_CHARS and out.endswith("…")


def test_speak_returns_mp3_with_the_voice_for_the_language(monkeypatch):
    seen = []

    async def fake(text, language):
        seen.append((text, language))
        return b"ID3-fake-mp3", tts.voice_for(language)

    monkeypatch.setattr(tts, "synthesize", fake)
    c = _client()
    r = c.post("/voice/speak", json={"text": "સામાન્ય વહીવટ વિભાગ"})
    assert r.status_code == 200 and r.headers["content-type"] == "audio/mpeg"
    assert r.content == b"ID3-fake-mp3" and r.headers["x-tts-voice"] == "gu-IN-DhwaniNeural"
    r = c.post("/voice/speak", json={"text": "Leave rules", "language": "gu"})
    assert seen[-1] == ("Leave rules", "gu")   # asked in English, answer read in Gujarati voice when forced


def test_speak_reports_unavailable_and_rejects_empty_text(monkeypatch):
    async def down(text, language):
        raise tts.TTSUnavailable("off")

    monkeypatch.setattr(tts, "synthesize", down)
    c = _client()
    assert c.post("/voice/speak", json={"text": "hello"}).status_code == 503
    assert c.post("/voice/speak", json={"text": "  [S1]  "}).status_code == 422


def test_speak_status_reflects_provider_switch(monkeypatch):
    monkeypatch.setenv("TTS_PROVIDER", "off")
    assert _client().get("/voice/speak").json()["available"] is False
