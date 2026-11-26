"""Tests for NVIDIA NIM provider, voice endpoints (/voice/*), and RAG latency optimizations."""
from __future__ import annotations

from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import Settings
from app.engine import EngineResult
from app.graph import LineageGraph
from app.main import create_app
from app.schemas import RawCitation, ReasonCode
from app.security import HardeningMiddleware
from app.seed import load_demo
from backend.rag import llm_gateway as gw
from backend.rag import providers as P
from backend.rag.providers.nvidia import NvidiaProvider
from backend.tests.fake_llm_server import FakeLLMServer

NVIDIA_KEY = "nvapi-test_SECRET_key_987654"


class _FakeEngine:
    def __init__(self, result: EngineResult):
        self.result = result
        self.calls: list[tuple[str, str]] = []

    def answer(self, question: str, language: str) -> EngineResult:
        self.calls.append((question, language))
        return self.result


def _seeded_client(engine=None):
    graph = LineageGraph()
    load_demo(graph)
    return TestClient(create_app(graph=graph, engine=engine))


# ── NVIDIA NIM provider ─────────────────────────────────────────────────────────────────────────────

def test_nvidia_provider_request_and_diagnose(monkeypatch):
    for var in ("LLM_PROVIDER", "NVIDIA_API_KEY", "NVIDIA_MODEL", "NVIDIA_BASE_URL", "NVIDIA_TIMEOUT", "NVIDIA_MAX_TOKENS", "NVIDIA_MAX_RETRIES"):
        monkeypatch.delenv(var, raising=False)
    assert not NvidiaProvider().is_configured()
    server = FakeLLMServer().start()
    try:
        monkeypatch.setenv("NVIDIA_API_KEY", NVIDIA_KEY)
        monkeypatch.setenv("NVIDIA_BASE_URL", server.url + "/v1")
        monkeypatch.setenv("NVIDIA_MODEL", "meta/llama-3.3-70b-instruct")
        p = NvidiaProvider()
        assert p.is_configured() and p.generate("sys", "usr") == "OK"
        req = server.chat_requests()[0]
        assert req["path"] == "/v1/chat/completions"
        assert req["headers"]["authorization"] == f"Bearer {NVIDIA_KEY}"
        assert req["json"]["model"] == "meta/llama-3.3-70b-instruct"
        assert "response_format" not in req["json"]

        server.reply(200, {"data": [{"id": "meta/llama-3.3-70b-instruct"}]})
        assert p.diagnose().ok
    finally:
        server.stop()


def test_nvidia_provider_routing_in_auto_when_key_set(monkeypatch):
    for var in ("LLM_PROVIDER", "NVIDIA_API_KEY"):
        monkeypatch.delenv(var, raising=False)
    monkeypatch.setenv("LLM_PROVIDER", "nvidia")
    assert [p.name for p in P.build_providers()] == ["nvidia", "groq", "gemini", "openai", "ollama"]

    monkeypatch.setenv("LLM_PROVIDER", "auto")
    assert [p.name for p in P.build_providers()] == ["groq", "openai", "gemini", "ollama"]
    monkeypatch.setenv("NVIDIA_API_KEY", NVIDIA_KEY)
    assert [p.name for p in P.build_providers()] == ["groq", "nvidia", "openai", "gemini", "ollama"]


# ── Voice endpoints (/voice/query, /voice/webhook, /voice/calls) ─────────────────────────────────────

def test_voice_query_formats_grounded_spoken_answer_and_lineage_warning():
    engine = _FakeEngine(
        EngineResult(
            answer="A medical certificate is required within 7 days. Please attach form B.",
            citations=[RawCitation(doc_id="demo-2018-045", page=2, quote="medical certificate")],
        )
    )
    res = _seeded_client(engine).post("/voice/query", json={"query": "Is a medical certificate required?"})
    assert res.status_code == 200
    data = res.json()
    assert data["verdict"] == "answered"
    assert "A medical certificate is required" in data["spoken_answer"]
    assert "2018-05-20" in data["spoken_answer"]
    assert "page 2" in data["spoken_answer"]
    assert "superseded" in data["spoken_answer"].lower()
    assert "active" not in data["spoken_answer"].lower()
    assert data["citations"][0]["status"] == "superseded"


def test_voice_query_refuses_without_evidence_and_supports_gujarati():
    engine = _FakeEngine(EngineResult(insufficient_reason=None, reason_code=ReasonCode.NO_DOCUMENT))
    res = _seeded_client(engine).post("/voice/query", json={"text": "રજાના નિયમો?", "language": "gu"})
    assert res.status_code == 200
    data = res.json()
    assert data["verdict"] == "insufficient_evidence"
    assert data["reason_code"] == "NO_DOCUMENT"
    assert "ઠરાવો" in data["spoken_answer"]


def test_voice_query_rejects_empty_question():
    res = _seeded_client().post("/voice/query", json={"question": "   "})
    assert res.status_code == 422


def test_voice_token_protects_voice_endpoints():
    app = FastAPI()
    app.add_middleware(HardeningMiddleware, admin_token="adm1n", rate_per_min=0, voice_token="v0ice")

    @app.post("/voice/query")
    def vq():
        return {"ok": True}

    @app.post("/voice/webhook")
    def vw():
        return {"ok": True}

    @app.get("/voice/calls")
    def vc():
        return []

    c = TestClient(app)
    assert c.post("/voice/query").status_code == 401
    assert c.post("/voice/webhook").status_code == 401
    assert c.post("/voice/query", headers={"X-Voice-Token": "v0ice"}).status_code == 200
    assert c.post("/voice/webhook", headers={"Authorization": "Bearer v0ice"}).status_code == 200
    assert c.get("/voice/calls").status_code == 401
    assert c.get("/voice/calls", headers={"X-Admin-Token": "adm1n"}).status_code == 200


def test_voice_webhook_persists_call_logs_in_sqlite(tmp_path):
    fix = Path(__file__).parents[2] / "data" / "fixtures"
    cfg = Settings(db_path=tmp_path / "v.sqlite", embed_model="hash", corpus_dir=fix, lineage_engine="stub")
    with TestClient(create_app(cfg, persist_vectors=False)) as c:
        res = c.post(
            "/voice/webhook",
            json={
                "call_id": "call-123",
                "call_status": "completed",
                "direction": "inbound",
                "from_number": "+919999999999",
                "to_number": "+919513886363",
                "call_duration": 42.5,
                "recording_url": "https://example.test/rec.mp3",
                "call_report": {"summary": "Asked about leave rules."},
            },
        )
        assert res.status_code == 200 and res.json() == {"ok": True, "call_id": "call-123"}
        calls = c.get("/voice/calls").json()
        assert len(calls) == 1 and calls[0]["call_id"] == "call-123"
        assert calls[0]["summary"] == "Asked about leave rules." and calls[0]["duration_sec"] == 42.5


# ── RAG latency optimizations ───────────────────────────────────────────────────────────────────────

def test_rag_guardrails_skip_prepare_translations(monkeypatch):
    se = pytest.importorskip("backend.rag.search_engine")
    called = []
    monkeypatch.setattr(se, "translate_to_english", lambda q: called.append(("en", q)) or None)
    monkeypatch.setattr(se, "translate_to_gujarati", lambda q: called.append(("gu", q)) or None)

    class _EmptyIndex:
        def search(self, bundle, top_k=20, filters=None):
            return []

    pipe = se.RAGPipeline(_EmptyIndex(), [])
    r1 = pipe.answer("leave")
    r2 = pipe.answer("Can I sue the department and will I win?")
    assert r1.insufficient_reason.value == "TOO_VAGUE"
    assert r2.insufficient_reason.value == "OUT_OF_SCOPE"
    assert called == []


def test_gujarati_translation_cache_persists_to_disk(monkeypatch, tmp_path):
    cache_file = tmp_path / "translations_gu.json"
    monkeypatch.setenv("TRANSLATION_GU_CACHE", str(cache_file))
    monkeypatch.setattr(gw, "_TRANSLATIONS_GU", {})
    monkeypatch.setattr(gw, "_TRANSLATIONS_GU_LOADED", False)
    calls = []
    monkeypatch.setattr(gw, "execute_llm_generation", lambda *a, **kw: (calls.append(a), ("રજાના નિયમો શું છે?", "fake"))[1])

    assert gw.translate_to_gujarati("What are the leave rules?") == "રજાના નિયમો શું છે?"
    assert len(calls) == 1 and cache_file.exists()

    # Simulate restart by clearing in-memory dict and resetting loaded flag
    monkeypatch.setattr(gw, "_TRANSLATIONS_GU", {})
    monkeypatch.setattr(gw, "_TRANSLATIONS_GU_LOADED", False)
    assert gw.translate_to_gujarati("What are the leave rules?") == "રજાના નિયમો શું છે?"
    assert len(calls) == 1


def test_grindex_opens_existing_chroma_collection_despite_embedder_mismatch(tmp_path):
    chromadb = pytest.importorskip("chromadb")
    from chromadb.utils import embedding_functions
    se = pytest.importorskip("backend.rag.search_engine")

    client = chromadb.PersistentClient(path=str(tmp_path))
    col = client.get_or_create_collection(
        name="gr_chunks",
        embedding_function=embedding_functions.DefaultEmbeddingFunction(),
    )
    col.add(ids=["c1"], documents=["sample gr text"], embeddings=[[0.1] * 384], metadatas=[{"gr_id": "GR-1"}])

    idx = se.GRIndex(str(tmp_path))
    assert idx.collection is not None and idx.collection.count() == 1


def test_logs_returns_utf8_json_for_api_and_formatted_html_for_browser(tmp_path):
    fix = Path(__file__).parents[2] / "data" / "fixtures"
    cfg = Settings(db_path=tmp_path / "logs.sqlite", embed_model="hash", corpus_dir=fix, lineage_engine="stub")
    with TestClient(create_app(cfg, persist_vectors=False)) as c:
        c.app.state.gov.db.log_query(
            query_id="voice_abc123",
            question="પંચવટી યોજના શું છે? <script>",
            answer="ગ્રામીણ બગીચા સહાય યોજના.",
            answer_status="answered",
            refusal_reason=None,
            citations=[{"doc_id": "FD-0000-8a8a0d", "page": 1}],
            latency_ms=1234,
        )
        r_json = c.get("/logs")
        assert r_json.status_code == 200
        assert "charset=utf-8" in r_json.headers["content-type"].lower()
        assert r_json.json()[0]["question"] == "પંચવટી યોજના શું છે? <script>"

        r_html = c.get("/logs", headers={"Accept": "text/html"})
        assert r_html.status_code == 200
        assert "text/html" in r_html.headers["content-type"].lower()
        assert "પંચવટી યોજના શું છે?" in r_html.text
        assert "<script>alert" not in r_html.text and "&lt;script&gt;" in r_html.text

        r_forced = c.get("/logs?format=json", headers={"Accept": "text/html"})
        assert "application/json" in r_forced.headers["content-type"].lower()
        assert r_forced.json()[0]["query_id"] == "voice_abc123"


# ── Browser Whisper STT (/voice/transcribe) & Auto Language Detection ──────────────────────────────────

def test_voice_transcribe_auto_detects_gujarati_and_handles_missing_key(monkeypatch):
    from app.routers import voice as voice_mod

    for var in ("GROQ_API_KEY", "OPENAI_API_KEY", "GROQ_STT_MODEL"):
        monkeypatch.delenv(var, raising=False)

    client = _seeded_client()
    assert client.post("/voice/transcribe", files={"file": ("clip.webm", b"0" * 50, "audio/webm")}).status_code == 422
    assert client.post("/voice/transcribe", files={"file": ("clip.webm", b"0" * 500, "audio/webm")}).status_code == 503

    calls = []

    class _FakeResp:
        def __init__(self, code, payload):
            self.status_code = code
            self._payload = payload
            self.content = b"{}"

        def json(self):
            return self._payload

    def fake_post(url, **kwargs):
        calls.append((url, kwargs))
        return _FakeResp(200, {"text": "પંચવટી યોજના શું છે?", "language": "gujarati"})

    monkeypatch.setenv("GROQ_API_KEY", "gsk_test_1234567890")
    monkeypatch.setattr(voice_mod.requests, "post", fake_post)

    cap = client.get("/voice/transcribe")
    assert cap.status_code == 200 and cap.json()["available"] is True

    res = client.post(
        "/voice/transcribe",
        files={"file": ("voice.webm", b"RIFF" + b"0" * 400, "audio/webm")},
        data={"language": "auto", "mode": "fast"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["text"] == "પંચવટી યોજના શું છે?"
    assert body["detected_language"] == "gu"
    assert body["provider"] == "groq"
    assert calls[0][1]["data"]["model"] == "whisper-large-v3-turbo"
    assert "language" not in calls[0][1]["data"]  # auto-detect omits forced language

    assert voice_mod._clean_whisper_payload({"text": "Thank you.", "segments": [{"text": "Thank you.", "no_speech_prob": 0.9, "avg_logprob": -1.4}]}) == ""


def test_security_allows_browser_transcribe_when_voice_token_set():
    app = FastAPI()
    app.add_middleware(HardeningMiddleware, admin_token="adm1n", rate_per_min=0, voice_token="v0ice")

    @app.post("/voice/query")
    def vq():
        return {"ok": True}

    @app.post("/voice/transcribe")
    def vt():
        return {"text": "ok"}

    c = TestClient(app)
    assert c.post("/voice/query").status_code == 401
    assert c.post("/voice/transcribe").status_code == 200


def test_auto_language_detection_gujlish_and_explicit_switch():
    from app.normalize import detect_language, detect_requested_language
    from app.query_eval import evaluate_query

    assert detect_language("Panchwati Yojna") == "mixed"
    assert detect_language("maternity leave rule") == "en"
    assert detect_requested_language("Explain in Gujarati") == "gu"
    assert detect_requested_language("English ma samjavo please") == "en"

    graph = LineageGraph()
    load_demo(graph)
    engine = _FakeEngine(
        EngineResult(
            answer="તબીબી પ્રમાણપત્ર જરૂરી છે.",
            citations=[RawCitation(doc_id="demo-2018-045", page=2, quote="medical certificate")],
        )
    )
    resp = evaluate_query("Explain in Gujarati", "auto", graph, engine)
    assert engine.calls[0][1] == "gu"
    assert resp.language == "gu"



