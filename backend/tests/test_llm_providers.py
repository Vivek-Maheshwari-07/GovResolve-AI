"""Ollama and Groq providers, exercised against a fake HTTP server (no network, no key, no model needed)."""
import socket

import pytest
from loguru import logger

pytest.importorskip("backend.rag.providers")
from backend.rag import providers as P  # noqa: E402
from backend.rag.providers import chat_completions as cc  # noqa: E402
from backend.rag.providers.ollama import OllamaProvider, ollama_host  # noqa: E402
from backend.rag.providers.groq import GroqProvider  # noqa: E402
from backend.rag.providers.openai_compat import OpenAICompatibleProvider  # noqa: E402
from backend.tests.fake_llm_server import FakeLLMServer  # noqa: E402

ENV_VARS = ["LLM_PROVIDER", "OLLAMA_HOST", "OLLAMA_URL", "OLLAMA_MODEL", "OLLAMA_TIMEOUT", "OLLAMA_MAX_TOKENS", "OLLAMA_KEEP_ALIVE", "OLLAMA_REASONING",
            "LOCAL_LLM_URL", "LOCAL_LLM_MODEL", "LOCAL_LLM_TIMEOUT", "LOCAL_LLM_MAX_TOKENS", "LOCAL_LLM_KEEP_ALIVE", "LOCAL_LLM_REASONING",
            "GROQ_API_KEY", "GROQ_MODEL", "GROQ_BASE_URL", "GROQ_TIMEOUT", "GROQ_MAX_TOKENS", "GROQ_MAX_RETRIES", "GROQ_REASONING_EFFORT",
            "LLM_API_URL", "LLM_API_KEY", "LLM_API_MODEL", "GOOGLE_API_KEY"]
KEY = "gsk_test_SECRET_key_123456"


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    for name in ENV_VARS:
        monkeypatch.delenv(name, raising=False)


@pytest.fixture
def server():
    s = FakeLLMServer().start()
    yield s
    s.stop()


@pytest.fixture
def no_sleep(monkeypatch):
    delays = []
    monkeypatch.setattr(cc.time, "sleep", lambda s: delays.append(s))
    return delays


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


# ------------------------------------------------------------------------------------------------------------------ Ollama
@pytest.mark.parametrize("env,expected", [
    ({}, "http://localhost:11434"),
    ({"OLLAMA_HOST": "127.0.0.1:11500"}, "http://127.0.0.1:11500"),
    ({"OLLAMA_HOST": "http://gpu-box:11434/"}, "http://gpu-box:11434"),
    ({"OLLAMA_HOST": "0.0.0.0"}, "http://localhost:11434"),
    ({"OLLAMA_URL": "http://old:11434"}, "http://old:11434"),
    ({"LOCAL_LLM_URL": "http://legacy:11434/v1/chat/completions"}, "http://legacy:11434"),
])
def test_ollama_host_resolution(monkeypatch, env, expected):
    for k, v in env.items():
        monkeypatch.setenv(k, v)
    assert ollama_host() == expected


def test_ollama_request_is_deterministic_json_and_needs_no_key(monkeypatch, server):
    monkeypatch.setenv("OLLAMA_HOST", server.url)
    server.reply(200, {"choices": [{"message": {"content": '{"statements": []}'}}]})
    p = OllamaProvider()
    assert p.is_configured() and p.generate("system text", "user text") == '{"statements": []}'
    req = server.chat_requests()[0]
    assert req["path"] == "/v1/chat/completions" and "authorization" not in req["headers"]
    body = req["json"]
    assert body["model"] == "qwen3.5:4b" and body["temperature"] == 0.0 and body["max_tokens"] == 700
    assert body["reasoning_effort"] == "none" and body["response_format"] == {"type": "json_object"}
    assert body["messages"] == [{"role": "system", "content": "system text"}, {"role": "user", "content": "user text"}]


def test_ollama_plain_text_mode_and_custom_length(monkeypatch, server):
    monkeypatch.setenv("OLLAMA_HOST", server.url)
    OllamaProvider().generate("s", "u", max_tokens=80, json_mode=False)
    body = server.chat_requests()[0]["json"]
    assert "response_format" not in body and body["max_tokens"] == 80


def test_ollama_reads_the_legacy_setting_names(monkeypatch, server):
    monkeypatch.setenv("LOCAL_LLM_URL", server.url + "/v1/chat/completions")
    monkeypatch.setenv("LOCAL_LLM_MODEL", "gemma3:4b")
    monkeypatch.setenv("LOCAL_LLM_REASONING", "")
    OllamaProvider().generate("s", "u")
    body = server.chat_requests()[0]["json"]
    assert body["model"] == "gemma3:4b" and "reasoning_effort" not in body


def test_ollama_not_running_returns_none_fast(monkeypatch):
    monkeypatch.setenv("OLLAMA_HOST", f"http://127.0.0.1:{free_port()}")
    assert OllamaProvider().generate("s", "u") is None


def test_ollama_diagnose_reports_missing_model_with_the_command_to_fix_it(monkeypatch, server):
    monkeypatch.setenv("OLLAMA_HOST", server.url)
    server.reply(200, {"models": [{"name": "llama3.2:3b"}]})
    d = OllamaProvider().diagnose()
    assert not d.ok and "ollama pull qwen3.5:4b" in d.hint


def test_ollama_diagnose_accepts_the_latest_tag_and_reports_unreachable(monkeypatch, server):
    monkeypatch.setenv("OLLAMA_HOST", server.url)
    monkeypatch.setenv("OLLAMA_MODEL", "bge-m3")
    server.reply(200, {"models": [{"name": "bge-m3:latest"}]})
    assert OllamaProvider().diagnose().ok
    monkeypatch.setenv("OLLAMA_HOST", f"http://127.0.0.1:{free_port()}")
    d = OllamaProvider().diagnose()
    assert not d.ok and "ollama serve" in d.hint


def test_ollama_warm_up_loads_the_model_then_primes_the_prompt(monkeypatch, server):
    monkeypatch.setenv("OLLAMA_HOST", server.url)
    assert OllamaProvider().warm_up("the system prompt") is True
    gen, chat = server.requests[0], server.chat_requests()[0]
    assert gen["path"] == "/api/generate" and gen["json"]["keep_alive"] == "30m" and gen["json"]["prompt"] == ""
    assert chat["json"]["max_tokens"] == 1 and chat["json"]["messages"][0]["content"] == "the system prompt"


# ------------------------------------------------------------------------------------------------------------------- Groq
def groq(monkeypatch, server, **env):
    monkeypatch.setenv("GROQ_API_KEY", KEY)
    monkeypatch.setenv("GROQ_BASE_URL", server.url + "/openai/v1")
    for k, v in env.items():
        monkeypatch.setenv(k, v)
    return GroqProvider()


def test_groq_without_a_key_makes_no_request(monkeypatch, server):
    monkeypatch.setenv("GROQ_BASE_URL", server.url + "/openai/v1")
    assert not GroqProvider().is_configured() and GroqProvider().generate("s", "u") is None
    monkeypatch.setenv("GROQ_API_KEY", "your_groq_api_key_here")      # the .env.example placeholder counts as unset
    assert not GroqProvider().is_configured() and GroqProvider().generate("s", "u") is None
    assert server.requests == []


def test_groq_request_carries_key_model_and_a_user_agent(monkeypatch, server):
    p = groq(monkeypatch, server)
    assert p.generate("system text", "user text") == "OK"
    req = server.chat_requests()[0]
    assert req["path"] == "/openai/v1/chat/completions"
    assert req["headers"]["authorization"] == f"Bearer {KEY}" and req["headers"]["user-agent"].startswith("GovResolve-AI")
    body = req["json"]
    assert body["model"] == "openai/gpt-oss-120b" and body["temperature"] == 0.0
    assert "response_format" not in body and "reasoning_effort" not in body


def test_groq_model_and_reasoning_effort_are_configurable(monkeypatch, server):
    groq(monkeypatch, server, GROQ_MODEL="llama-3.3-70b-versatile", GROQ_REASONING_EFFORT="low", GROQ_MAX_TOKENS="900").generate("s", "u")
    body = server.chat_requests()[0]["json"]
    assert body["model"] == "llama-3.3-70b-versatile" and body["reasoning_effort"] == "low" and body["max_tokens"] == 900


def test_groq_retries_a_rate_limit_and_honours_retry_after(monkeypatch, server, no_sleep):
    server.reply(429, {"error": "rate limit"}, {"Retry-After": "3"})
    p = groq(monkeypatch, server)
    assert p.generate("s", "u") == "OK"
    assert len(server.chat_requests()) == 2 and no_sleep == [3.0]


def test_groq_gives_up_after_the_configured_retries(monkeypatch, server, no_sleep):
    for _ in range(3):
        server.reply(503, {"error": "overloaded"})
    assert groq(monkeypatch, server, GROQ_MAX_RETRIES="2").generate("s", "u") is None
    assert len(server.chat_requests()) == 3 and len(no_sleep) == 2


def test_groq_backoff_is_capped(monkeypatch, server, no_sleep):
    server.reply(429, {}, {"Retry-After": "600"})
    groq(monkeypatch, server).generate("s", "u")
    assert no_sleep == [cc.MAX_BACKOFF_SECONDS]


def test_groq_does_not_retry_a_wrong_key_and_never_logs_the_key(monkeypatch, server, no_sleep):
    server.reply(401, {"error": {"message": f"Invalid API Key {KEY}"}})
    logs = []
    sink = logger.add(lambda m: logs.append(str(m)), level="DEBUG")
    try:
        assert groq(monkeypatch, server).generate("s", "u") is None
    finally:
        logger.remove(sink)
    assert len(server.chat_requests()) == 1 and no_sleep == []
    assert logs and all(KEY not in line for line in logs) and any("check the API key" in line for line in logs)


def test_groq_diagnose(monkeypatch, server):
    server.reply(200, {"data": [{"id": "openai/gpt-oss-120b"}, {"id": "llama-3.3-70b-versatile"}]})
    assert groq(monkeypatch, server).diagnose().ok
    server.reply(200, {"data": [{"id": "something-else"}]})
    d = groq(monkeypatch, server).diagnose()
    assert not d.ok and "GROQ_MODEL" in d.hint and d.models == ["something-else"]
    server.reply(401, {"error": "bad key"})
    assert "GROQ_API_KEY" in groq(monkeypatch, server).diagnose().hint


# ------------------------------------------------------------------------------------------------- generic OpenAI-compatible
def test_generic_api_needs_url_key_and_model(monkeypatch, server):
    assert not OpenAICompatibleProvider().is_configured()
    monkeypatch.setenv("LLM_API_URL", server.url + "/v1/chat/completions")
    monkeypatch.setenv("LLM_API_KEY", KEY)
    assert not OpenAICompatibleProvider().is_configured()
    monkeypatch.setenv("LLM_API_MODEL", "some-model")
    p = OpenAICompatibleProvider()
    assert p.is_configured() and p.generate("s", "u") == "OK"
    req = server.chat_requests()[0]
    assert req["headers"]["authorization"] == f"Bearer {KEY}" and "response_format" not in req["json"]


# ----------------------------------------------------------------------------------------------------------------- routing
@pytest.mark.parametrize("setting,order", [
    ("ollama", ["ollama", "groq", "openai", "gemini"]),
    ("local", ["ollama", "groq", "openai", "gemini"]),       # legacy name
    ("groq", ["groq", "ollama", "openai", "gemini"]),
    ("api", ["openai", "ollama", "groq", "gemini"]),         # legacy name
    ("gemini", ["gemini", "ollama", "groq", "openai"]),
    ("auto", ["groq", "openai", "gemini", "ollama"]),
    ("banana", ["ollama", "groq", "openai", "gemini"]),      # unknown value behaves like the default
    ("GROQ", ["groq", "ollama", "openai", "gemini"]),        # case-insensitive
])
def test_provider_order(monkeypatch, setting, order):
    monkeypatch.setenv("LLM_PROVIDER", setting)
    assert [p.name for p in P.build_providers()] == order


def test_default_provider_is_ollama():
    assert P.selected_provider() == "ollama"
