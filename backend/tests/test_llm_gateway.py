"""The gateway: provider order, fallback, plain-text mode, warm-up and the translation helpers."""
import json

import pytest

pytest.importorskip("backend.rag.llm_gateway")
import backend.rag.llm_gateway as gw  # noqa: E402
from backend.tests.fake_llm_server import FakeLLMServer  # noqa: E402
from backend.tests.test_llm_providers import ENV_VARS, KEY  # noqa: E402


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    for name in ENV_VARS:
        monkeypatch.delenv(name, raising=False)


@pytest.fixture
def ollama(monkeypatch):
    s = FakeLLMServer().start()
    monkeypatch.setenv("OLLAMA_HOST", s.url)
    yield s
    s.stop()


@pytest.fixture
def groq_api(monkeypatch):
    s = FakeLLMServer().start()
    monkeypatch.setenv("GROQ_API_KEY", KEY)
    monkeypatch.setenv("GROQ_BASE_URL", s.url + "/openai/v1")
    monkeypatch.setenv("GROQ_MAX_RETRIES", "0")
    yield s
    s.stop()


def text(s):
    return {"choices": [{"message": {"content": s}}]}


def test_default_is_ollama_and_never_touches_groq(ollama, groq_api):
    ollama.reply(200, text("from ollama"))
    assert gw.execute_llm_generation("s", "u") == ("from ollama", "ollama")
    assert groq_api.requests == []


def test_groq_first_choice(monkeypatch, ollama, groq_api):
    monkeypatch.setenv("LLM_PROVIDER", "groq")
    groq_api.reply(200, text("from groq"))
    assert gw.execute_llm_generation("s", "u") == ("from groq", "groq")
    assert ollama.requests == []


def test_a_failing_groq_falls_back_to_ollama(monkeypatch, ollama, groq_api):
    monkeypatch.setenv("LLM_PROVIDER", "groq")
    groq_api.reply(500, {"error": "down"})
    ollama.reply(200, text("from ollama"))
    assert gw.execute_llm_generation("s", "u") == ("from ollama", "ollama")


def test_groq_without_a_key_is_skipped_without_a_request(monkeypatch, ollama):
    monkeypatch.setenv("LLM_PROVIDER", "groq")
    ollama.reply(200, text("from ollama"))
    assert gw.execute_llm_generation("s", "u") == ("from ollama", "ollama")


def test_auto_prefers_a_hosted_provider_then_the_local_model(monkeypatch, ollama, groq_api):
    monkeypatch.setenv("LLM_PROVIDER", "auto")
    groq_api.reply(200, text("from groq"))
    assert gw.execute_llm_generation("s", "u")[1] == "groq"
    monkeypatch.delenv("GROQ_API_KEY")
    ollama.reply(200, text("from ollama"))
    assert gw.execute_llm_generation("s", "u")[1] == "ollama"


def test_nothing_answering_gives_the_canned_reply_without_statements(monkeypatch):
    monkeypatch.setenv("OLLAMA_HOST", "http://127.0.0.1:9")      # nothing listens there
    out, name = gw.execute_llm_generation("s", "u")
    assert name == "fallback" and json.loads(out)["statements"] == []


def test_plain_text_mode_and_length_reach_the_provider(ollama):
    gw.execute_llm_generation("s", "u", max_tokens=80, json_mode=False)
    body = ollama.chat_requests()[0]["json"]
    assert body["max_tokens"] == 80 and "response_format" not in body
    gw.execute_llm_generation("s", "u")                                  # answers keep JSON mode and the default length
    body = ollama.chat_requests()[1]["json"]
    assert body["max_tokens"] == 700 and body["response_format"] == {"type": "json_object"}


def test_warm_up_only_when_ollama_is_the_model_that_will_answer(monkeypatch, ollama, groq_api):
    assert gw.warm_up_llm("system") is True and ollama.requests[0]["path"] == "/api/generate"
    ollama.requests.clear()
    monkeypatch.setenv("LLM_PROVIDER", "groq")
    assert gw.warm_up_llm("system") is False and ollama.requests == []


@pytest.mark.parametrize("reply,expected", [
    ('{"answer": "What is the age limit for direct selection?"}', "What is the age limit for direct selection?"),
    ('{"content": "When did the rules come into force?"}', "When did the rules come into force?"),
    ('{"n": 3}', None), ("{ broken json", None),
])
def test_a_json_reply_is_unwrapped_for_translation(reply, expected):
    assert gw._clean_translation(reply) == expected
