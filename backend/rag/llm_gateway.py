"""
Squad 2 — Pluggable LLM Gateway (Cloud Gemini or Local LLM)
Supports:
  - Google Gemini API (gemini-2.0-flash / gemini-1.5-pro)
  - Local OpenAI-compatible endpoints (Ollama / vLLM / LM Studio / llama.cpp)
  - Graceful deterministic fallback when offline
"""
from __future__ import annotations

import json
import os
import re
from typing import Optional
from loguru import logger
import urllib.request
import urllib.error

# Config from environment
LLM_PROVIDER    = os.getenv("LLM_PROVIDER", "auto")      # "gemini" | "local" | "auto"
GOOGLE_API_KEY  = os.getenv("GOOGLE_API_KEY", "")
GEMINI_MODEL    = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
LOCAL_LLM_URL   = os.getenv("LOCAL_LLM_URL", "http://localhost:11434/v1/chat/completions")
LOCAL_LLM_MODEL = os.getenv("LOCAL_LLM_MODEL", "gemma3:4b")

try:
    from google import genai
    from google.genai import types as genai_types
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False


def call_local_llm(system_prompt: str, user_prompt: str) -> Optional[str]:
    """Call an OpenAI-compatible local LLM endpoint (Ollama / vLLM / LM Studio)."""
    payload = {
        "model": LOCAL_LLM_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.0,
        "max_tokens": 2048,
        "response_format": {"type": "json_object"} if "ollama" not in LOCAL_LLM_URL else None
    }
    
    headers = {"Content-Type": "application/json"}
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(LOCAL_LLM_URL, data=data, headers=headers)
    
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            res_body = resp.read().decode("utf-8")
            res_json = json.loads(res_body)
            content = res_json["choices"][0]["message"]["content"]
            return content
    except Exception as e:
        logger.warning(f"Local LLM call failed at {LOCAL_LLM_URL}: {e}")
        return None


def call_gemini_api(system_prompt: str, user_prompt: str) -> Optional[str]:
    """Call Google Gemini API using google-genai SDK."""
    if not GEMINI_AVAILABLE or not GOOGLE_API_KEY or GOOGLE_API_KEY.startswith("your_"):
        return None
    try:
        client = genai.Client(api_key=GOOGLE_API_KEY)
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=user_prompt,
            config=genai_types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.0,
                max_output_tokens=2500,
            ),
        )
        return response.text
    except Exception as e:
        logger.warning(f"Gemini API call failed: {e}")
        return None


def execute_llm_generation(system_prompt: str, user_prompt: str) -> tuple[str, str]:
    """
    Execute generation across configured provider:
    Returns (raw_llm_output, provider_used)
    """
    provider = LLM_PROVIDER.lower()
    
    if provider == "local":
        out = call_local_llm(system_prompt, user_prompt)
        if out:
            return out, "local"
        logger.warning("Local LLM failed; attempting Gemini fallback if available.")
        
    # Default or Gemini provider
    if provider in ("gemini", "auto"):
        out = call_gemini_api(system_prompt, user_prompt)
        if out:
            return out, "gemini"
            
    # If auto, try local before fallback
    if provider == "auto":
        out = call_local_llm(system_prompt, user_prompt)
        if out:
            return out, "local"
            
    # Deterministic offline fallback
    fallback_response = {
        "summary": "Retrieved official provisions from matched resolutions. (LLM synthesis provider inactive or unreachable)",
        "statements": [],
        "answer_status": "Found, no later change",
        "insufficient_reason": None,
        "follow_up_question": None
    }
    return json.dumps(fallback_response), "fallback"
