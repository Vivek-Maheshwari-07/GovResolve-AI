"""Voice agent endpoints (OmniDimension / Exotel / telephony integration & browser Whisper STT)."""
from __future__ import annotations

import os
import re
import time
import uuid

import requests
from fastapi import APIRouter, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import HTMLResponse

from ..normalize import detect_language
from ..query_eval import evaluate_query
from .api import render_logs_html
from ..schemas import (
    LineageStatus,
    QueryResponse,
    Verdict,
    VoiceCitationSummary,
    VoiceQueryRequest,
    VoiceQueryResponse,
)

router = APIRouter(prefix="/voice", tags=["voice"])


def _clean_for_speech(text: str, max_sentences: int = 3) -> str:
    """Strip markdown artifacts and trim long passages to a crisp spoken length."""
    cleaned = re.sub(r"[*_`#>]+", " ", text or "")
    cleaned = re.sub(r"\[S\d+\]", "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    if not cleaned:
        return ""
    parts = re.split(r"(?<=[.!?।])\s+", cleaned)
    picked = [p.strip() for p in parts if p.strip()][:max_sentences]
    out = " ".join(picked)
    if len(out) > 650:
        out = out[:647].rsplit(" ", 1)[0] + "..."
    return out


def _status_phrase(status: LineageStatus, is_gu: bool) -> str:
    if status is LineageStatus.SUPERSEDED:
        return "આ ઠરાવ પછીના આદેશ દ્વારા રદ કે સુધારિત થયો છે" if is_gu else "Warning: this resolution has been superseded by a later order"
    if status is LineageStatus.AMENDED:
        return "આ ઠરાવમાં પછીથી સુધારો કરવામાં આવ્યો છે" if is_gu else "Note: this resolution has been amended by a later order"
    if status is LineageStatus.UNKNOWN:
        return "આ નિયમની વર્તમાન સ્થિતિ ઉપલબ્ધ દસ્તાવેજોથી સ્પષ્ટ નથી" if is_gu else "Note: current applicability could not be verified from the collection"
    return "ઉપલબ્ધ સંગ્રહમાં આ પછી કોઈ સુધારો મળ્યો નથી" if is_gu else "No later amendment was found in the collection"


def format_spoken_answer(resp: QueryResponse, graph, max_sentences: int = 3) -> tuple[str, list[VoiceCitationSummary]]:
    """Build a concise, grounded spoken response + citation summaries without ever claiming 'active'."""
    is_gu = resp.language == "gu"
    summaries: list[VoiceCitationSummary] = []
    for c in resp.citations:
        meta = graph.get_meta(c.doc_id)
        summaries.append(
            VoiceCitationSummary(
                doc_id=c.doc_id,
                gr_number=meta.gr_number if meta else None,
                issue_date=c.issue_date.isoformat() if c.issue_date else None,
                page=c.page,
                status=c.lineage.status.value,
            )
        )

    if resp.verdict is not Verdict.ANSWERED or not resp.answer:
        raw_reason = (resp.reason or "").strip()
        if is_gu and (not raw_reason or raw_reason == "The available documents do not support an answer."):
            spoken = "માફ કરશો, ઉપલબ્ધ સરકારી ઠરાવોમાં આ પ્રશ્નનો પૂરતો આધાર મળ્યો નથી."
        else:
            spoken = _clean_for_speech(raw_reason, max_sentences=2) or (
                "માફ કરશો, ઉપલબ્ધ સરકારી ઠરાવોમાં આ પ્રશ્નનો પૂરતો આધાર મળ્યો નથી."
                if is_gu
                else "I could not find enough evidence in the available Government Resolutions to answer that."
            )
        return spoken, summaries

    body = _clean_for_speech(resp.answer, max_sentences=max_sentences)
    primary = summaries[0]
    ref_label = primary.gr_number or primary.doc_id
    date_part = f" dated {primary.issue_date}" if primary.issue_date else ""
    date_part_gu = f" (તારીખ {primary.issue_date})" if primary.issue_date else ""
    source_line = (
        f"આ માહિતી સરકારી ઠરાવ {ref_label}{date_part_gu}, પાના નંબર {primary.page} પરથી છે."
        if is_gu
        else f"Source: Government Resolution {ref_label}{date_part}, page {primary.page}."
    )

    primary_status = resp.citations[0].lineage.status
    status_line = _status_phrase(primary_status, is_gu) + "."
    has_broken = any("BROKEN_CHAIN" in w for w in resp.warnings)
    broken_line = (
        " ચેતવણી: આ સંદર્ભનો મૂળ ઠરાવ સંગ્રહમાં ઉપલબ્ધ નથી."
        if (has_broken and is_gu)
        else (" Warning: an amended or referenced base resolution is missing from the collection." if has_broken else "")
    )
    return f"{body} {source_line} {status_line}{broken_line}".strip(), summaries


@router.post("/query", response_model=VoiceQueryResponse)
def voice_query(body: VoiceQueryRequest, request: Request) -> VoiceQueryResponse:
    t0 = time.perf_counter()
    question = (body.question or body.query or body.text or "").strip()
    if not question:
        raise HTTPException(422, "Provide 'question' (or 'query' / 'text') with a non-empty question.")

    graph = getattr(request.app.state, "contract_graph", None)
    engine = getattr(request.app.state, "engine", None)
    if graph is None or engine is None:
        raise HTTPException(503, "Voice query engine is not initialized.")

    resp = evaluate_query(question, body.language or body.lang, graph, engine)
    spoken, summaries = format_spoken_answer(resp, graph, max_sentences=body.max_sentences)
    latency_ms = int((time.perf_counter() - t0) * 1000)

    gov = getattr(request.app.state, "gov", None)
    if gov is not None and gov.db is not None:
        gov.db.log_query(
            query_id=f"voice_{uuid.uuid4().hex[:10]}",
            question=question,
            answer=resp.answer or "",
            answer_status=resp.verdict.value,
            refusal_reason=resp.reason,
            citations=[s.model_dump(mode="json") for s in summaries],
            latency_ms=latency_ms,
        )

    return VoiceQueryResponse(
        verdict=resp.verdict.value,
        spoken_answer=spoken,
        answer=resp.answer,
        language=resp.language,
        reason_code=resp.reason_code.value if resp.reason_code else None,
        citations=summaries,
        warnings=resp.warnings,
        latency_ms=latency_ms,
    )


@router.post("/webhook")
async def voice_webhook(request: Request) -> dict:
    payload = await request.json()
    if not isinstance(payload, dict):
        raise HTTPException(422, "Webhook payload must be a JSON object.")

    call_id = str(payload.get("call_id") or payload.get("call_sid") or uuid.uuid4().hex[:12])
    report = payload.get("call_report") if isinstance(payload.get("call_report"), dict) else {}
    summary = str(payload.get("summary") or report.get("summary") or "")
    duration = payload.get("call_duration") if payload.get("call_duration") is not None else payload.get("duration")
    try:
        duration_sec = float(duration) if duration is not None else None
    except (TypeError, ValueError):
        duration_sec = None

    gov = getattr(request.app.state, "gov", None)
    if gov is not None and gov.db is not None:
        gov.db.log_voice_call(
            call_id=call_id,
            call_status=str(payload.get("call_status") or payload.get("status") or ""),
            direction=str(payload.get("direction") or ""),
            from_number=str(payload.get("from_number") or payload.get("from") or ""),
            to_number=str(payload.get("to_number") or payload.get("to") or ""),
            duration_sec=duration_sec,
            summary=summary,
            recording_url=str(payload.get("recording_url") or ""),
            payload=payload,
        )
    return {"ok": True, "call_id": call_id}


@router.get("/calls")
def recent_voice_calls(request: Request, limit: int = Query(20, ge=1, le=200)) -> list[dict]:
    gov = getattr(request.app.state, "gov", None)
    if gov is None or gov.db is None:
        return []
    return gov.db.recent_voice_calls(limit)


@router.get("/monitor", response_class=HTMLResponse)
def voice_monitor(request: Request, limit: int = Query(30, ge=1, le=200)) -> HTMLResponse:
    gov = getattr(request.app.state, "gov", None)
    rows = gov.db.recent_logs(limit) if gov is not None and gov.db is not None else []
    return HTMLResponse(render_logs_html(rows, limit), media_type="text/html; charset=utf-8")


_MAX_AUDIO_BYTES = 10 * 1024 * 1024  # 10 MB cap per short voice clip
_LANG_ISO_MAP = {
    "gu": "gu", "gujarati": "gu",
    "en": "en", "english": "en",
    "hi": "hi", "hindi": "hi",
}


def _env_key(*names: str) -> str:
    for n in names:
        val = (os.environ.get(n) or "").strip()
        if val and "your_" not in val.lower() and not val.endswith("_here"):
            return val
    return ""


def _resolve_spoken_language(text: str, raw_lang: str | None) -> str:
    """Detect spoken language from transcript script, Whisper label, and Gujlish cues."""
    if any("઀" <= ch <= "૿" for ch in text):
        return "gu"
    mapped = _LANG_ISO_MAP.get((raw_lang or "").strip().lower())
    text_lang = detect_language(text)
    if text_lang == "mixed":
        return "gujlish"
    if mapped:
        return mapped
    return text_lang if text_lang in ("gu", "en") else "en"


_WHISPER_NOISE_PHRASES = {
    "thank you", "thank you.", "thanks for watching", "thanks for watching.",
    "you", "bye", "bye.", "...", ".", "subtitle", "subtitles by",
}


def _clean_whisper_payload(payload: dict) -> str:
    """Extract clean transcript from Whisper verbose_json while suppressing pure-silence hallucinations."""
    segments = payload.get("segments")
    if isinstance(segments, list) and segments:
        kept = []
        for seg in segments:
            seg_text = str(seg.get("text") or "").strip()
            if not seg_text:
                continue
            no_speech = float(seg.get("no_speech_prob") or 0.0)
            avg_logprob = float(seg.get("avg_logprob") or 0.0)
            if no_speech >= 0.8 and avg_logprob <= -1.0:
                continue
            kept.append(seg_text)
        text = " ".join(kept).strip()
    else:
        text = str(payload.get("text") or "").strip()
    if text.lower() in _WHISPER_NOISE_PHRASES:
        return ""
    return text


def _stt_targets(mode: str = "accurate") -> list[tuple[str, str, str, str]]:
    """Return ordered list of (provider, url, api_key, model) candidates for Whisper STT."""
    targets: list[tuple[str, str, str, str]] = []
    groq_key = _env_key("GROQ_API_KEY")
    if groq_key:
        base = (os.environ.get("GROQ_BASE_URL") or "https://api.groq.com/openai/v1").strip().rstrip("/")
        primary = (os.environ.get("GROQ_STT_MODEL") or "whisper-large-v3").strip()
        if mode == "fast":
            models = ["whisper-large-v3-turbo"] + ([primary] if primary != "whisper-large-v3-turbo" else [])
        else:
            models = [primary] + (["whisper-large-v3-turbo"] if primary != "whisper-large-v3-turbo" else [])
        for m in models:
            targets.append(("groq", f"{base}/audio/transcriptions", groq_key, m))
    openai_key = _env_key("OPENAI_API_KEY")
    if openai_key:
        base = (os.environ.get("OPENAI_BASE_URL") or "https://api.openai.com/v1").strip().rstrip("/")
        model = (os.environ.get("OPENAI_STT_MODEL") or "whisper-1").strip()
        targets.append(("openai", f"{base}/audio/transcriptions", openai_key, model))
    return targets


def transcribe_audio_bytes(
    audio_bytes: bytes,
    filename: str = "speech.webm",
    content_type: str = "audio/webm",
    language: str | None = None,
    mode: str = "accurate",
) -> dict:
    """Transcribe short audio clip using Groq Whisper (auto-detecting Gujarati vs English)."""
    targets = _stt_targets(mode=mode)
    if not targets:
        raise HTTPException(503, "No cloud STT provider key (GROQ_API_KEY / OPENAI_API_KEY) is configured.")

    req_lang = (language or "").strip().lower()
    explicit_iso = req_lang if req_lang in ("gu", "en", "hi") else None
    t0 = time.perf_counter()
    last_err = "STT request failed"

    for provider, url, key, model in targets:
        data: dict[str, str] = {
            "model": model,
            "response_format": "verbose_json",
            "temperature": "0",
        }
        if explicit_iso:
            data["language"] = explicit_iso
        try:
            resp = requests.post(
                url,
                headers={"Authorization": f"Bearer {key}", "User-Agent": "GovResolve-AI/0.1"},
                files={"file": (filename or "speech.webm", audio_bytes, content_type or "audio/webm")},
                data=data,
                timeout=20,
            )
            if resp.status_code == 200:
                payload = resp.json() if resp.content else {}
                text = _clean_whisper_payload(payload)
                raw_lang = payload.get("language")
                return {
                    "text": text,
                    "detected_language": explicit_iso or _resolve_spoken_language(text, raw_lang),
                    "raw_language": raw_lang,
                    "provider": provider,
                    "model": model,
                    "latency_ms": int((time.perf_counter() - t0) * 1000),
                }
            last_err = f"{provider} HTTP {resp.status_code}"
            if resp.status_code in (401, 403):
                continue
        except requests.RequestException as exc:
            last_err = f"{provider} network error: {type(exc).__name__}"
            continue

    raise HTTPException(502, f"Speech-to-text failed ({last_err}).")


@router.get("/transcribe")
def voice_transcribe_status() -> dict:
    """Fast capability check for browser voice UI before starting MediaRecorder streaming."""
    targets = _stt_targets()
    if not targets:
        return {"available": False, "provider": None, "model": None}
    provider, _, _, model = targets[0]
    return {"available": True, "provider": provider, "model": model}


@router.post("/transcribe")
async def voice_transcribe(
    file: UploadFile = File(...),
    language: str | None = Form(None),
    mode: str | None = Form("accurate"),
) -> dict:
    """Auto-detecting multilingual speech-to-text endpoint for browser voice chat."""
    audio_bytes = await file.read(_MAX_AUDIO_BYTES + 1)
    if len(audio_bytes) > _MAX_AUDIO_BYTES:
        raise HTTPException(413, "Audio clip is too large (max 10 MB).")
    if len(audio_bytes) < 100:
        raise HTTPException(422, "Audio clip is empty or too short.")
    return transcribe_audio_bytes(
        audio_bytes,
        filename=file.filename or "speech.webm",
        content_type=file.content_type or "audio/webm",
        language=language,
        mode=(mode or "accurate").strip().lower(),
    )
