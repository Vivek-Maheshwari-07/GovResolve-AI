"""One entry point for every language-model call in the project.

    execute_llm_generation(system, user)  ->  (text, provider_name)

The providers (Ollama, Groq, any OpenAI-compatible API, Gemini) live in `backend/rag/providers/`. `LLM_PROVIDER` picks the first
choice; the others follow if it is not configured or fails. If nothing answers, a canned reply with no statements comes back and the
pipeline falls back to quoting the best verbatim passage. See docs/LLM_PROVIDERS.md.
"""
from __future__ import annotations

import json
import os
import re
import threading
from typing import Optional

from loguru import logger

from backend.rag.providers import OllamaProvider, build_providers, selected_provider

FALLBACK_REPLY = {
    "summary": "Retrieved official provisions from matched resolutions. (LLM synthesis provider inactive or unreachable)",
    "statements": [],
    "answer_status": "Found, no later change",
    "insufficient_reason": None,
    "follow_up_question": None,
}


def execute_llm_generation(system_prompt: str, user_prompt: str, max_tokens: Optional[int] = None, json_mode: bool = True) -> tuple[str, str]:
    """Run the prompt through the configured providers in order and return (raw_output, provider_name).

    `provider_name` is "ollama", "groq", "openai", "gemini", or "fallback" when nothing answered (offline, unreachable, no key).
    """
    tried = 0
    for provider in build_providers():
        if not provider.is_configured():
            continue
        tried += 1
        out = provider.generate(system_prompt, user_prompt, max_tokens=max_tokens, json_mode=json_mode)
        if out:
            return out, provider.name
        logger.warning(f"LLM provider '{provider.name}' gave no answer; trying the next one.")
    if not tried:
        logger.warning(f"No LLM provider is configured (LLM_PROVIDER={selected_provider()}); see docs/LLM_PROVIDERS.md.")
    return json.dumps(FALLBACK_REPLY), "fallback"


def primary_provider_name() -> str:
    """Name of the provider that would answer first ("groq", "ollama", ...), or "" if none is configured. No network call."""
    for provider in build_providers():
        if provider.is_configured():
            return provider.name
    return ""


def warm_up_llm(system_prompt: Optional[str] = None) -> bool:
    """Load the local model and its prompt prefix now, so the first question is not slow. Only done when Ollama is the model that
    would answer (the first configured provider); with a hosted first choice there is nothing to warm."""
    for provider in build_providers():
        if provider.is_configured():
            return provider.warm_up(system_prompt) if isinstance(provider, OllamaProvider) else False
    return False


TRANSLATE_SYSTEM = (
    "You translate questions about Gujarat Government Resolutions into English. The question may be in Gujarati, in Gujarati written in "
    "Latin letters, or mixed with English. Reply with the English translation only: one sentence, no quotes, no explanation. "
    "Keep numbers, dates, GR numbers and names exactly as written. If the question is already English, repeat it."
)
TRANSLATE_GU_SYSTEM = (
    "You translate questions about Gujarat Government Resolutions into formal Gujarati in Gujarati script (ગુજરાતી લિપિ). "
    "The question may be in English, Gujlish (Gujarati in Latin letters), or mixed. "
    "Reply with the Gujarati translation in Gujarati script only: one concise search query, no quotes, no explanation. "
    "Keep numbers, dates, and GR identifiers intact. If the question is already pure Gujarati script, repeat it."
)
REWRITE_SYSTEM = (
    "You help search Gujarat Government Resolutions: service rules, recruitment and age limits, leave and LTC, allowances, pay, pension, "
    "training and departmental exams, Panchayat and rural development. An officer or a citizen asks a question in everyday words, in "
    "English, Gujarati or Gujarati in Latin letters. Reply with 6 to 10 formal English search terms or short phrases, comma separated, "
    "in the wording such resolutions and rules use (for example: family pension, death-cum-retirement gratuity, compassionate "
    "appointment). Terms only: no sentence, no explanation, no answer, no invented GR numbers or dates."
)
_REWRITES: dict[str, str] = {}
_TRANSLATIONS: dict[str, str] = {}
_TRANSLATIONS_GU: dict[str, str] = {}
_TRANSLATION_LOCK = threading.Lock()
MAX_TRANSLATIONS = 5000   # oldest entries are dropped beyond this, so user questions cannot grow memory or the file without limit


def _remember(cache: dict, key: str, value: str) -> None:
    with _TRANSLATION_LOCK:
        cache.pop(key, None)
        cache[key] = value
        while len(cache) > MAX_TRANSLATIONS:
            cache.pop(next(iter(cache)))
_TRANSLATIONS_LOADED = False


def _translation_cache_path() -> Optional[str]:
    """Where translations are remembered between runs (so the same question costs one model call ever); '' disables the file."""
    path = os.getenv("TRANSLATION_CACHE")
    if path is None:
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data", "index", "translations.json")
    return os.path.abspath(path) if path else None


def _clean_translation(reply: str) -> Optional[str]:
    """The model's reply as one plain English sentence, or None if it is empty or not English (a failed translation)."""
    reply = (reply or "").strip()
    if reply.startswith("{"):  # a model told to answer in JSON: take its first string value
        try:
            values = [v for v in json.loads(reply).values() if isinstance(v, str)]
        except (ValueError, AttributeError):
            values = []
        reply = values[0] if values else ""
    lines = [ln.strip() for ln in reply.splitlines() if ln.strip()]
    if not lines:
        return None
    text = re.sub(r"^(?:english\s+)?translation\s*[:\-]\s*", "", lines[0], flags=re.I).strip().strip("\"'`“”‘’ ")
    latin = len(re.findall(r"[A-Za-z]", text))
    gujarati = len(re.findall(r"[઀-૿]", text))
    if len(text) < 3 or latin < 3 or gujarati > latin:
        return None
    return text[:300]


def translate_to_english(question: str) -> Optional[str]:
    """One short model call that renders a Gujarati / Gujlish question in English, so keyword search and sentence choice can match the
    (mostly English) documents. None when no model answers or the reply is not English; the caller then searches as before.
    Remembered in memory and in a small JSON file, so repeated runs and repeated questions cost nothing."""
    path = _translation_cache_path()
    _load_translation_cache(path)
    key = question.strip()
    if key in _TRANSLATIONS:
        return _TRANSLATIONS[key] or None
    reply, provider = execute_llm_generation(TRANSLATE_SYSTEM, key, max_tokens=80, json_mode=False)
    if provider == "fallback":
        return None  # nothing answered; do not remember a failure
    english = _clean_translation(reply)
    _remember(_TRANSLATIONS, key, english or "")
    _save_translation_cache(path)
    return english


def _clean_rewrite(reply: str) -> Optional[str]:
    """The model's reply as one line of comma-separated English search terms, or None if it is empty, not English or not terms."""
    reply = (reply or "").strip()
    if reply.startswith("{"):
        try:
            values = [v for v in json.loads(reply).values() if isinstance(v, str)]
        except (ValueError, AttributeError):
            values = []
        reply = values[0] if values else ""
    lines = [ln.strip() for ln in reply.splitlines() if ln.strip()]
    if not lines:
        return None
    text = re.sub(r"^(?:search\s+terms|terms|keywords)\s*[:\-]\s*", "", " ".join(lines), flags=re.I).strip().strip("\"'`“”‘’ ")
    latin = len(re.findall(r"[A-Za-z]", text))
    gujarati = len(re.findall(r"[઀-૿]", text))
    if latin < 6 or gujarati > latin // 2 or len(text) > 400:
        return None
    return text[:240]


def rewrite_for_search(question: str) -> Optional[str]:
    """One short model call that turns an everyday question into the formal terms the resolutions use, so search can find a resolution
    whose words the question does not share. The terms are only ever added to the search, never shown as an answer. None when no model
    answers or the reply is unusable. Remembered in memory and in the translation cache file."""
    path = _translation_cache_path()
    _load_translation_cache(path)
    key = question.strip()
    if not key:
        return None
    if key in _REWRITES:
        return _REWRITES[key] or None
    reply, provider = execute_llm_generation(REWRITE_SYSTEM, key, max_tokens=90, json_mode=False)
    if provider == "fallback":
        return None
    terms = _clean_rewrite(reply)
    _remember(_REWRITES, key, terms or "")
    _save_translation_cache(path)
    return terms


def _load_translation_cache(path: Optional[str]) -> None:
    """Read the saved translations once. English renderings sit at the top level of the file (the original format), Gujarati ones
    under the key "__gu__", so a file written by an older build still loads."""
    global _TRANSLATIONS_LOADED
    if not path or _TRANSLATIONS_LOADED:
        return
    _TRANSLATIONS_LOADED = True
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError):
        return
    if isinstance(data, dict):
        gu = data.pop("__gu__", None)
        rw = data.pop("__rw__", None)
        if isinstance(rw, dict):
            _REWRITES.update({k: v for k, v in rw.items() if isinstance(v, str)})
        _TRANSLATIONS.update({k: v for k, v in data.items() if isinstance(v, str)})
        if isinstance(gu, dict):
            _TRANSLATIONS_GU.update({k: v for k, v in gu.items() if isinstance(v, str)})
    legacy_gu = os.path.join(os.path.dirname(path), "translations_gu.json")  # separate Gujarati file of an earlier build
    try:
        with open(legacy_gu, encoding="utf-8") as f:
            old_gu = json.load(f)
        if isinstance(old_gu, dict):
            for k, v in old_gu.items():
                if isinstance(v, str):
                    _TRANSLATIONS_GU.setdefault(k, v)
    except (OSError, ValueError):
        pass


def _save_translation_cache(path: Optional[str]) -> None:
    if not path:
        return
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        tmp = f"{path}.{threading.get_ident()}.tmp"
        with _TRANSLATION_LOCK:
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump({**_TRANSLATIONS, "__gu__": dict(_TRANSLATIONS_GU), "__rw__": dict(_REWRITES)}, f, ensure_ascii=False, indent=0)
            os.replace(tmp, path)   # atomic: a crash never leaves a half-written cache
    except OSError:
        pass


def _clean_gujarati_translation(reply: str) -> Optional[str]:
    """The model's reply as one plain Gujarati sentence in Gujarati script, or None."""
    reply = (reply or "").strip()
    if reply.startswith("{"):
        try:
            values = [v for v in json.loads(reply).values() if isinstance(v, str)]
        except (ValueError, AttributeError):
            values = []
        reply = values[0] if values else ""
    lines = [ln.strip() for ln in reply.splitlines() if ln.strip()]
    if not lines:
        return None
    text = re.sub(r"^(?:gujarati\s+)?translation\s*[:\-]\s*", "", lines[0], flags=re.I).strip().strip("\"'`“”‘’ ")
    gujarati = len(re.findall(r"[઀-૿]", text))
    if gujarati < 2:
        return None
    return text[:300]


def translate_to_gujarati(question: str) -> Optional[str]:
    """One short model call that renders an English or Gujlish question in Gujarati script, so keyword search and sentence choice can
    match Gujarati resolutions. None when no model answers or the reply is not Gujarati script."""
    path = _translation_cache_path()
    _load_translation_cache(path)
    key = question.strip()
    if key in _TRANSLATIONS_GU:
        return _TRANSLATIONS_GU[key] or None
    reply, provider = execute_llm_generation(TRANSLATE_GU_SYSTEM, key, max_tokens=100, json_mode=False)
    if provider == "fallback":
        return None
    gujarati = _clean_gujarati_translation(reply)
    _remember(_TRANSLATIONS_GU, key, gujarati or "")
    _save_translation_cache(path)
    return gujarati


GUJARAT_GOV_GLOSSARY = """Use authentic Gujarat Secretariat / Government Resolution Gujarati terminology (never word-for-word literal translations):
- Major Head -> મુખ્ય સદર
- Sub-head -> પેટા-સદર
- Detailed Head -> વિગતવાર સદર
- House Building Advance -> મકાન બાંધકામ પેશગી
- Government Resolution -> સરકારી ઠરાવ
- Circular -> પરિપત્ર
- Notification -> જાહેરનામું
- Amendment / Amended -> સુધારો / સુધારેલ
- Superseded / In supersession of -> રદબાતલ / અવેજીમાં
- Sanctioned / Approved -> મંજૂર થયેલ
- All India Service Officers -> અખિલ ભારતીય સેવા અધિકારીઓ
- Government Servants -> સરકારી કર્મચારીઓ
- Recruitment Rules -> ભરતી નિયમો
- Upper age limit relaxation -> ઉપલી વયમર્યાદામાં છૂટછાટ
- Direct Selection / Recruitment -> સીધી ભરતી / પસંદગી
- Departmental Examination -> ખાતાકીય પરીક્ષા
- Maternity Leave / Casual Leave / Earned Leave -> પ્રસૂતિ રજા / પરચુરણ રજા / હક રજા
- Finance Department -> નાણા વિભાગ
- General Administration Department (GAD) -> સામાન્ય વહીવટ વિભાગ
- Home Department -> ગૃહ વિભાગ"""

TRANSLATE_ANSWER_TO_GU_SYSTEM = (
    "You translate official Gujarat Government Resolution findings or passages from English into clear, natural, formal "
    "administrative Gujarati (ગુજરાતી લિપિ). Preserve every GR number, date, amount, percentage, office name, and citation fact accurately.\n"
    f"{GUJARAT_GOV_GLOSSARY}\n"
    "Reply ONLY with natural Gujarati text, nothing else."
)
TRANSLATE_ANSWER_TO_EN_SYSTEM = (
    "You translate official Gujarat Government Resolution findings or passages from Gujarati into clear, concise, formal English. "
    "Preserve every GR number, date, amount, percentage, person/office name, and citation fact accurately. "
    "Reply ONLY with the English translation text, nothing else."
)
_ANSWER_TRANSLATE_CACHE: dict[tuple[str, str], str] = {}


def translate_answer_text(text: str, target_lang: str) -> Optional[str]:
    """Translate a grounded answer statement, summary, or passage into 'gu' or 'en', preserving factual tokens."""
    src = (text or "").strip()
    if not src:
        return None
    lang = (target_lang or "").strip().lower()
    if lang in ("gu", "gujarati"):
        norm_lang = "gu"
        sys_p = TRANSLATE_ANSWER_TO_GU_SYSTEM
    elif lang in ("en", "english"):
        norm_lang = "en"
        sys_p = TRANSLATE_ANSWER_TO_EN_SYSTEM
    else:
        return None

    ckey = (norm_lang, src)
    with _TRANSLATION_LOCK:
        cached = _ANSWER_TRANSLATE_CACHE.get(ckey)
    if cached:
        return cached

    reply, provider = execute_llm_generation(sys_p, src[:2500], max_tokens=450, json_mode=False)
    if provider == "fallback" or not reply:
        return None
    cleaned = re.sub(r"^(?:translation\s*[:\-]\s*)", "", reply.strip(), flags=re.I).strip().strip("\"'`")
    if not cleaned:
        return None
    if norm_lang == "gu":
        if sum("઀" <= ch <= "૿" for ch in cleaned) < 2:
            return None
    else:
        if len(re.findall(r"[A-Za-z]", cleaned)) < 3:
            return None
    out = cleaned[:1800]
    _remember(_ANSWER_TRANSLATE_CACHE, ckey, out)
    return out
