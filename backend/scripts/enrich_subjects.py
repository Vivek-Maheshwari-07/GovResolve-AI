"""Clean noisy OCR/Gazette subjects and populate bilingual `subject_en` + `subject_gu` across all processed GR JSONs.

Usage (from repo root):
    .venv/bin/python -m backend.scripts.enrich_subjects
"""
from __future__ import annotations

import json
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")

from backend.rag.llm_gateway import execute_llm_generation  # noqa: E402

CORPUS_DIR = ROOT / "data" / "processed"

_NOISE_PATTERNS = (
    "□",
    "?",
    "{",
    "}",
    "€",
    "@",
    "Gobeurm",
    "Goherum",
    "Gohesrm",
    "qffig",
    "c{r",
    "qrN$",
    "cilNs",
    "c{f",
    "PT]BLIS",
    "REGISTERED NO",
    "REGISTEREDNo",
    "REGISTSR",
    "Gazette",
    "Wette",
    "Gu?etre",
    "Unknown Subject",
    "RURJAT",
    "Smhlualryt",
    "CONSTITUTION OF INDIA",
    "SachivaldYo",
)

EXTRACT_AND_TRANSLATE_SYS = """You extract the true official subject/title of a Gujarat Government Resolution (GR) / Notification from its page-1 text and provide clear, accurate titles in BOTH English and Gujarati.

Use proper Gujarat Secretariat terminology in Gujarati:
- Resolution -> ઠરાવ
- Notification -> જાહેરનામું
- Circular -> પરિપત્ર
- Rules / Amendment Rules -> નિયમો / સુધારા નિયમો
- Recruitment -> ભરતી
- Department -> વિભાગ (e.g. સામાન્ય વહીવટ વિભાગ, નાણા વિભાગ, ગૃહ વિભાગ, પંચાયત, ગ્રામ ગૃહનિર્માણ અને ગ્રામ વિકાસ વિભાગ)
- Major Head / Sub-head -> મુખ્ય સદર / પેટા-સદર
- House Building Advance -> મકાન બાંધકામ પેશગી
- Upper age limit relaxation -> ઉપલી વયમર્યાદામાં છૂટછાટ
- Departmental Examination -> ખાતાકીય પરીક્ષા

Reply ONLY with valid JSON:
{"canonical": "<clean title in document's original language>", "en": "<concise accurate English title (under 140 chars)>", "gu": "<concise accurate natural Gujarati title in Gujarati script (under 140 chars)>"}
"""


def is_noisy_subject(subj: str | None) -> bool:
    s = (subj or "").strip()
    if len(s) < 15:
        return True
    if any(p in s for p in _NOISE_PATTERNS):
        return True
    # High non-ASCII-non-Gujarati or symbol ratio indicates OCR garbage
    weird = sum(
        not (c.isascii() or ("\u0A80" <= c <= "\u0AFF") or c in "“”‘’–—")
        for c in s
    )
    return weird > 2 or "\n" in s


def _collect_excerpt(data: dict) -> str:
    parts: list[str] = []
    for p in (data.get("pages") or [])[:2]:
        for b in p.get("blocks") or []:
            txt = (b.get("text") or "").strip()
            if txt:
                parts.append(txt)
            if sum(len(x) for x in parts) >= 1800:
                break
        if sum(len(x) for x in parts) >= 1800:
            break
    if not parts:
        for ch in (data.get("chunks") or [])[:3]:
            txt = (ch.get("text") or "").strip()
            if txt:
                parts.append(txt)
    return "\n".join(parts)[:2000]


def _parse_json(raw: str) -> dict | None:
    txt = re.sub(r"```(?:json)?", "", raw or "").strip().rstrip("`").strip()
    m = re.search(r"\{.*\}", txt, re.DOTALL)
    for cand in (txt, m.group() if m else ""):
        try:
            obj = json.loads(cand)
            if isinstance(obj, dict) and obj.get("en") and obj.get("gu"):
                return obj
        except ValueError:
            pass
    return None


def _process_one(path: Path) -> tuple[str, bool, str]:
    data = json.loads(path.read_text(encoding="utf-8"))
    gr_id = data["gr_id"]
    orig_subj = (data.get("subject") or "").strip()
    noisy = is_noisy_subject(orig_subj)
    already_has_both = bool(data.get("subject_en") and data.get("subject_gu")) and not noisy
    if already_has_both:
        return gr_id, False, "already clean"

    excerpt = _collect_excerpt(data)
    user_p = (
        f"GR ID: {gr_id}\n"
        f"GR Number: {data.get('gr_number') or ''}\n"
        f"Department: {data.get('department') or ''}\n"
        f"Original Language: {data.get('language') or 'en'}\n"
        f"Current Subject: {'(GARBLED/MISSING - extract real subject from excerpt)' if noisy else orig_subj}\n\n"
        f"DOCUMENT EXCERPT:\n{excerpt}"
    )

    parsed = None
    for _ in range(2):
        raw, prov = execute_llm_generation(EXTRACT_AND_TRANSLATE_SYS, user_p, max_tokens=260, json_mode=False)
        if prov == "fallback":
            break
        parsed = _parse_json(raw)
        if parsed and sum("\u0A80" <= c <= "\u0AFF" for c in parsed["gu"]) >= 4 and len(re.findall(r"[A-Za-z]", parsed["en"])) >= 4:
            break
        parsed = None

    if not parsed:
        return gr_id, False, "llm_failed"

    if noisy:
        canon = str(parsed.get("canonical") or "").strip()
        if not canon or is_noisy_subject(canon):
            canon = parsed["gu"] if data.get("language") == "gu" else parsed["en"]
        data["subject"] = canon[:240]

    data["subject_en"] = str(parsed["en"]).strip()[:220]
    data["subject_gu"] = str(parsed["gu"]).strip()[:220]

    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return gr_id, True, f"{'FIXED+BILINGUAL' if noisy else 'BILINGUAL'}: {data['subject_en'][:55]}"


def main() -> int:
    files = sorted(CORPUS_DIR.glob("*.json"))
    updated = 0
    failed = 0
    with ThreadPoolExecutor(max_workers=6) as pool:
        futs = [pool.submit(_process_one, p) for p in files]
        for fut in as_completed(futs):
            gr_id, ok, msg = fut.result()
            if ok:
                updated += 1
                print(f"[OK] {gr_id}: {msg}")
            elif msg != "already clean":
                failed += 1
                print(f"[WARN] {gr_id}: {msg}")
    print(f"\nDone: updated={updated}, failed={failed}, total={len(files)}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
