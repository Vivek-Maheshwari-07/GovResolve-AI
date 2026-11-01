"""LLM gateway: local Ollama by default, optional hosted OpenAI-compatible API behind a key. Needs the squad2 modules."""
import io
import json
import urllib.error

import pytest
from loguru import logger

pytest.importorskip("backend.rag.llm_gateway")
import backend.rag.llm_gateway as gw  # noqa: E402

KEY = "sk-test-SECRET-123"


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def reply(text):
    return FakeResponse(json.dumps({"choices": [{"message": {"content": text}}]}).encode())


@pytest.fixture
def configured(monkeypatch):
    monkeypatch.setattr(gw, "LLM_API_URL", "https://api.example.test/v1/chat/completions")
    monkeypatch.setattr(gw, "LLM_API_KEY", KEY)
    monkeypatch.setattr(gw, "LLM_API_MODEL", "some-model")


def test_unconfigured_api_makes_no_network_call(monkeypatch):
    monkeypatch.setattr(gw.urllib.request, "urlopen", lambda *a, **k: pytest.fail("network call"))
    monkeypatch.setattr(gw, "LLM_API_KEY", "")
    assert gw.call_api_llm("s", "u") is None
    monkeypatch.setattr(gw, "LLM_API_URL", "https://x/v1/chat/completions")
    monkeypatch.setattr(gw, "LLM_API_MODEL", "m")
    monkeypatch.setattr(gw, "LLM_API_KEY", "your_api_key_here")  # the .env.example placeholder counts as unset
    assert gw.call_api_llm("s", "u") is None


def test_request_carries_key_model_and_no_provider_specific_options(monkeypatch, configured):
    seen = {}

    def fake_urlopen(req, timeout):
        seen.update(url=req.full_url, auth=req.get_header("Authorization"), body=json.loads(req.data), timeout=timeout)
        return reply('{"statements": []}')

    monkeypatch.setattr(gw.urllib.request, "urlopen", fake_urlopen)
    assert gw.call_api_llm("system text", "user text") == '{"statements": []}'
    assert seen["url"] == "https://api.example.test/v1/chat/completions" and seen["auth"] == f"Bearer {KEY}"
    body = seen["body"]
    assert body["model"] == "some-model" and body["temperature"] == 0.0
    assert body["messages"] == [{"role": "system", "content": "system text"}, {"role": "user", "content": "user text"}]
    assert "reasoning_effort" not in body and "response_format" not in body


@pytest.mark.parametrize("failure", [
    urllib.error.HTTPError("https://api.example.test", 401, "Unauthorized", {}, io.BytesIO(b'{"error": "bad key"}')),
    urllib.error.URLError("no network"),
    TimeoutError("slow"),
])
def test_failures_return_none_and_never_log_the_key(monkeypatch, configured, failure):
    def boom(*a, **k):
        raise failure

    monkeypatch.setattr(gw.urllib.request, "urlopen", boom)
    logs = []
    sink = logger.add(lambda m: logs.append(str(m)), level="DEBUG")
    try:
        assert gw.call_api_llm("s", "u") is None
    finally:
        logger.remove(sink)
    assert logs and all(KEY not in line for line in logs)


def route(monkeypatch, provider, api=None, local=None, gemini=None):
    calls = []
    monkeypatch.setattr(gw, "LLM_PROVIDER", provider)
    for name, out in (("api", api), ("local", local), ("gemini", gemini)):
        monkeypatch.setattr(gw, f"call_{name}_llm" if name != "gemini" else "call_gemini_api",
                            lambda s, u, name=name, out=out, **k: calls.append(name) or out)
    return calls


def test_default_provider_is_local_and_does_not_touch_the_api(monkeypatch):
    calls = route(monkeypatch, "local", api="from api", local="from local")
    assert gw.execute_llm_generation("s", "u") == ("from local", "local") and calls == ["local"]


def test_api_provider_is_first_and_falls_back_to_local(monkeypatch):
    calls = route(monkeypatch, "api", api="from api", local="from local")
    assert gw.execute_llm_generation("s", "u") == ("from api", "api") and calls == ["api"]
    calls = route(monkeypatch, "api", api=None, local="from local")
    assert gw.execute_llm_generation("s", "u") == ("from local", "local") and calls == ["api", "local"]


def test_auto_tries_api_then_gemini_then_local(monkeypatch):
    calls = route(monkeypatch, "auto", api=None, gemini=None, local="from local")
    assert gw.execute_llm_generation("s", "u") == ("from local", "local") and calls == ["api", "gemini", "local"]


def test_nothing_answering_gives_the_canned_reply_without_statements(monkeypatch):
    route(monkeypatch, "api")
    out, name = gw.execute_llm_generation("s", "u")
    assert name == "fallback" and json.loads(out)["statements"] == []


def test_unknown_provider_name_behaves_like_local(monkeypatch):
    calls = route(monkeypatch, "banana", local="from local")
    assert gw.execute_llm_generation("s", "u") == ("from local", "local") and calls == ["local"]


def test_local_warm_up_is_skipped_when_the_api_is_the_first_choice(monkeypatch):
    monkeypatch.setattr(gw.urllib.request, "urlopen", lambda *a, **k: pytest.fail("network call"))
    monkeypatch.setattr(gw, "LLM_PROVIDER", "api")
    assert gw.warm_up_local_llm("system") is False
