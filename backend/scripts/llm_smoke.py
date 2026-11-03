"""LLM doctor: check that Ollama and Groq (and any other configured provider) work, and how fast. Run it after editing .env.

Usage (from the repository root):
    python -m backend.scripts.llm_smoke                 # every provider, in the order the app would try them
    python -m backend.scripts.llm_smoke --provider groq # only one
    python -m backend.scripts.llm_smoke --no-ping       # configuration and reachability only, no generation

For each provider it prints whether it is configured, whether the server answers (Ollama: is the model installed; Groq: does the key
work and is the model available), and the seconds one tiny request takes. Keys are never printed.
Exit status: 0 when at least one provider works (the app falls back to it), 1 when none does.
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SYSTEM = "Reply with the single word OK."
USER = "ping"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--provider", choices=["ollama", "groq", "openai", "gemini"], help="check only this provider")
    ap.add_argument("--no-ping", action="store_true", help="skip the one-word generation test")
    args = ap.parse_args(argv)

    sys.path.insert(0, str(ROOT))
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
    from backend.rag.providers import build_providers, selected_provider

    first = selected_provider()
    chain = build_providers()
    print(f"LLM_PROVIDER={first}   order tried: {' -> '.join(p.name for p in chain)}\n")

    results: list[tuple[str, bool]] = []
    for provider in chain:
        if args.provider and provider.name != args.provider:
            continue
        info = ", ".join(f"{k}={v}" for k, v in provider.describe().items() if k != "provider")
        print(f"{provider.label}  ({info})")
        d = provider.diagnose()
        print(f"  {'OK    ' if d.ok else 'PROBLEM' if provider.is_configured() else 'skipped'}  {d.summary}")
        if d.hint:
            print(f"          -> {d.hint}")
        if d.models and not d.ok:
            print(f"          available: {', '.join(d.models[:12])}{' ...' if len(d.models) > 12 else ''}")
        ok = d.ok
        if d.ok and not args.no_ping and provider.is_configured():
            start = time.time()
            reply = provider.generate(SYSTEM, USER, max_tokens=8, json_mode=False)
            seconds = time.time() - start
            ok = bool(reply and reply.strip())
            print(f"  {'OK    ' if ok else 'FAILED'}  ping {seconds:.1f}s  reply={(reply or '').strip()[:30]!r}")
            if not ok:
                print("          see the warning above for the HTTP status (401 wrong key, 404 wrong model or URL, 429 rate limit)")
        if provider.is_configured():
            results.append((provider.name, ok))
        print()

    working = [name for name, ok in results if ok]
    if not working:
        print("No provider works. Start Ollama (and `ollama pull` the model), or set GROQ_API_KEY in .env. See docs/LLM_PROVIDERS.md.")
        return 1
    if results and not results[0][1]:
        print(f"Note: the first choice ({results[0][0]}) is not working; answers will come from {working[0]}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
