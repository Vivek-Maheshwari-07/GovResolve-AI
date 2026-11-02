"""Check which language-model providers work, and how fast, with one tiny request each. Run this after editing .env.

Usage (from backend/):
    python -m scripts.llm_smoke

Prints, for the hosted API, Gemini and the local model: configured or not, whether a one-word reply came back, and the seconds it took.
Only the host name of the API URL and the model name are shown; the key is never printed.
"""
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
SYSTEM = "Reply with the single word OK."
USER = "ping"


def timed(call):
    start = time.time()
    reply = call(SYSTEM, USER)
    return reply, time.time() - start


def main() -> int:
    sys.path.insert(0, str(ROOT))
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
    import backend.rag.llm_gateway as gw

    host = urlparse(gw.LLM_API_URL).netloc or "-"
    api_set = all(gw._is_set(v) for v in (gw.LLM_API_URL, gw.LLM_API_KEY, gw.LLM_API_MODEL))
    print(f"LLM_PROVIDER={gw.LLM_PROVIDER}   first choice: {gw.LLM_PROVIDER}, then the others if it fails or is not configured")
    rows = [
        ("hosted API", api_set, f"{host} / {gw.LLM_API_MODEL or '-'}", gw.call_api_llm),
        ("Gemini", gw._is_set(gw.GOOGLE_API_KEY), gw.GEMINI_MODEL, gw.call_gemini_api),
        ("local Ollama", True, f"{gw.LOCAL_LLM_URL} / {gw.LOCAL_LLM_MODEL}", gw.call_local_llm),
    ]
    ok_any = False
    for name, configured, detail, call in rows:
        if not configured:
            print(f"  {name:13} not configured ({detail})")
            continue
        reply, seconds = timed(call)
        ok = bool(reply and reply.strip())
        ok_any = ok_any or ok
        print(f"  {name:13} {'OK ' if ok else 'FAILED'} {seconds:5.1f}s  {detail}  reply={((reply or '').strip()[:30])!r}")
        if not ok:
            print("                see the warning above this line for the HTTP code or error (401 = wrong key, 404 = wrong model name or URL, 429 = rate limit)")
    if not api_set:
        print("\nTo test a hosted API, fill LLM_API_URL, LLM_API_KEY and LLM_API_MODEL in .env (see .env.example) and set LLM_PROVIDER=api.")
    return 0 if ok_any else 1


if __name__ == "__main__":
    sys.exit(main())
