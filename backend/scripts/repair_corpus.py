"""Repair corrupted Gujarati PDF font streams / OCR noise, metadata, and chunk coverage in data/processed.

Backs up the original corpus once before any edit, restores Shruti/CID/OCR-corrupted blocks via LLM
with strict numeric/identifier verification, deterministically re-extracts GR metadata using
`backend.ingestion.metadata`, and rebuilds complete page-faithful chunks while keeping every `gr_id` stable.

Usage (from backend/):
    python -m scripts.repair_corpus --corpus ../data/processed [--dry-run] [--only-gr FD-0000-8a8a0d]
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import os
import re
import shutil
import sys
import time
from pathlib import Path
from typing import Optional

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

load_dotenv(ROOT / ".env")

from backend.ingestion.metadata import (  # noqa: E402
    build_complete_chunks,
    clean_ligatures,
    extract_department,
    extract_gr_number,
    extract_issue_date,
    extract_subject,
    has_garbled_font_stream,
    normalize_digits,
)
from backend.models import ClauseStatus, GRRecord  # noqa: E402

DEFAULT_BACKUP_DIR = Path(
    "/Users/AminBhavya/.gemini/antigravity/brain/8a920e9b-0718-44f4-86e0-31e6a5e1a8b9/scratch/processed_backup"
)

_CTRL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f\ufff0-\uffff]")

RESTORE_SYSTEM = """You fix broken Gujarati Unicode text extracted from Shruti-font PDFs or Gujarati OCR.
Any `[?]` marker in the text marks a missing/corrupted Gujarati character or conjunct from a broken PDF font byte.

EXACT RECONSTRUCTION RULES & EXAMPLES:
- Replace EVERY `[?]` marker using Gujarati spelling & context; NEVER output `[?]` or any control characters.
- Fix mid-word inverted i-matra (`િ`): સિચવાલય -> સચિવાલય, કિમશનર -> કમિશનર, પિસ્થિતિ -> પરિસ્થિતિ, વવભાગ/ધિભાગ/નવભાગ -> વિભાગ.
- Rejoin hyphenated/line-broken Gujarati conjuncts: િવ\\nતારના -> વિસ્તારના, દરખા\\nત -> દરખાસ્ત, સં\\nકૃતિ -> સંસ્કૃતિ, આ\\nથા -> આસ્થા.
- Common Shruti subset patterns:
  * રા[?]ય -> રાજ્ય, [?]ા[?]ય -> ગ્રામ્ય, [?]ો[?]સાહન -> પ્રોત્સાહન, સુવિધાયુ[?]ત -> સુવિધાયુક્ત, નવર[?]ચત -> નવરચિત, િજ[?]ા -> જિલ્લા, એજ[?]સી -> એજન્સી, \\r -> રિ (નાગ\\rરકો -> નાગરિકો)
  * `&` = reph `ર્` (ગૃહિનમા&ણ -> ગૃહનિર્માણ, કાય&ક્રમ -> કાર્યક્રમ, પૂણ& -> પૂર્ણ)
  * `@` -> ક્ષ (વૃ@ો -> વૃક્ષો), `?` inside Gujarati word -> જી (વનરા? -> વનરાજી), `>` -> દ્ધિ/દ્ધ (સમૃિ> -> સમૃદ્ધિ), `*` -> ક્ર/કૃ/ર્ગ (*માંક -> ક્રમાંક, વગ* -> વર્ગ)
- Reconstruct only corrupted Gujarati tokens in place; NEVER summarize, translate, repeat lines, expand content, drop lines, or alter ANY number, date, percentage, rupee amount, file/GR ID, or English word.
- Output ONLY clean repaired plain text matching the input line-by-line — no markdown fences, no commentary."""


def _preclean_gujarati_shruti(text: str) -> str:
    """Apply 100%-deterministic Gujarati Shruti visual-matra, Wingdings bullets, and unambiguous OCR fixes."""
    s = clean_ligatures(text or "")
    s = s.replace("\uf0d8", "• ").replace("\uf0b7", "• ").replace("\uf0a7", "• ")
    # Visual i-matra placed before consonant at word start
    s = re.sub(r"(^|[\s(\[\"'“‘\-–/:])(\u0abf)([\u0a95-\u0ab9])", r"\1\3\2", s)
    # Unambiguous Gujarati OCR/Shruti token fixes
    replacements = [
        ("ાાં", "ાં"),
        ("૫રર૫ત્ર", "પરિપત્ર"),
        ("ક્રમાાંક", "ક્રમાંક"),
        ("ક્રભાાંક", "ક્રમાંક"),
        ("*માંક", "ક્રમાંક"),
        ("*મ", "ક્રમ"),
        ("સંવગ*", "સંવર્ગ"),
        ("વગ*", "વર્ગ"),
        ("નવભાગ", "વિભાગ"),
        ("ધિભાગ", "વિભાગ"),
        ("મલબાગ", "વિભાગ"),
        ("નવકાસ", "વિકાસ"),
        ("િહીિટ", "વહીવટ"),
        ("િાંિાણે", "વંચાણે"),
        ("વાંર્ાણે", "વંચાણે"),
        ("ગાાંિીનગર", "ગાંધીનગર"),
        ("ગાાંઘીનગર", "ગાંધીનગર"),
        ("પાાંર્ાયત", "પંચાયત"),
        ("તાયીખ", "તારીખ"),
        ("વયકાય", "સરકાર"),
        ("વચિલારમ", "સચિવાલય"),
        ("સિચવાલય", "સચિવાલય"),
    ]
    for bad, good in replacements:
        s = s.replace(bad, good)
    s = re.sub(r"([\u0a85-\u0acc])(?<![0-9૦-૯])7(?![0-9૦-૯])(?=\s|$|[\u0a85-\u0acc.,:;)])", r"\1ત્ર", s)
    s = re.sub(r"(?<![0-9૦-૯])6ી", "શ્રી", s)
    return s


def needs_llm_repair(text: str) -> bool:
    return has_garbled_font_stream(text)


def _split_for_llm(text: str, max_chars: int = 650) -> list[str]:
    if len(text) <= max_chars:
        return [text]
    lines = text.splitlines(keepends=True)
    parts: list[str] = []
    cur = ""
    for ln in lines:
        if cur and len(cur) + len(ln) > max_chars:
            parts.append(cur)
            cur = ln
        else:
            cur += ln
    if cur:
        parts.append(cur)
    return parts


def _numeric_tokens(text: str) -> list[str]:
    """Extract normalized 2+ digit numeric sequences (dates, years, GR codes, amounts)."""
    norm = normalize_digits(text)
    return re.findall(r"\d{2,}", norm)


def _strip_code_fences(text: str) -> str:
    s = text.strip()
    if s.startswith("```"):
        s = re.sub(r"^```[^\n]*\n?", "", s)
        s = re.sub(r"\n?```$", "", s)
    return s.strip()


def verify_restored_text(original: str, restored: str) -> tuple[bool, str]:
    """Verify repaired text removed corruption while keeping numbers, length, and Gujarati script."""
    if not restored or not restored.strip():
        return False, "empty output"
    if _CTRL_RE.search(restored):
        return False, "control characters still present"
    if "[?]" in restored and "[?]" not in original:
        return False, "unresolved [?] marker remaining"

    ratio = len(restored) / max(1, len(original))
    if not (0.60 <= ratio <= 1.75):
        return False, f"length ratio out of bounds ({ratio:.2f})"

    orig_nums = _numeric_tokens(original)
    rest_nums = _numeric_tokens(restored)
    # Count multiset containment so no critical year/amount/GR number vanishes silently
    from collections import Counter

    c_orig = Counter(orig_nums)
    c_rest = Counter(rest_nums)
    missing = []
    for tok, cnt in c_orig.items():
        # Skip noise 2-digit OCR numbers glued to symbols like '6ી' -> handled as token only if >=3 digits
        if len(tok) >= 3 and c_rest[tok] < cnt:
            missing.append(tok)
    if missing:
        return False, f"dropped numeric tokens: {missing[:5]}"

    orig_gu = len(re.findall(r"[\u0a80-\u0aff]", original))
    rest_gu = len(re.findall(r"[\u0a80-\u0aff]", restored))
    if orig_gu >= 20 and rest_gu < int(orig_gu * 0.70):
        return False, f"Gujarati char drop ({orig_gu} -> {rest_gu})"

    return True, "ok"


def _call_groq_or_nvidia(text: str, model_spec: str, timeout: int = 90) -> str:
    provider, model = model_spec.split(":", 1)
    if provider == "groq":
        key = os.getenv("GROQ_API_KEY", "").strip()
        if not key:
            raise RuntimeError("GROQ_API_KEY not set")
        url = "https://api.groq.com/openai/v1/chat/completions"
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": RESTORE_SYSTEM},
                {"role": "user", "content": f"Repair the following text strictly:\n\n{text}"},
            ],
            "temperature": 0.0,
            "max_tokens": 4096,
        }
        if "gpt-oss" in model:
            payload["reasoning_effort"] = "low"
    else:
        key = os.getenv("NVIDIA_API_KEY", "").strip()
        if not key:
            raise RuntimeError("NVIDIA_API_KEY not set")
        url = f"{os.getenv('NVIDIA_BASE_URL', 'https://integrate.api.nvidia.com/v1').rstrip('/')}/chat/completions"
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": RESTORE_SYSTEM},
                {"role": "user", "content": f"Repair the following text strictly:\n\n{text}"},
            ],
            "temperature": 0.0,
            "max_tokens": 4096,
        }

    resp = requests.post(
        url,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json=payload,
        timeout=timeout,
    )
    if resp.status_code == 429:
        retry_after = float(resp.headers.get("Retry-After", "4"))
        raise TimeoutError(f"429 rate limited ({retry_after}s)")
    resp.raise_for_status()
    msg = resp.json()["choices"][0]["message"]["content"]
    return _strip_code_fences(msg or "")


def restore_block_via_llm(text: str, models: list[str]) -> tuple[str, bool, str]:
    """Repair one block segment by segment with deterministic pre-cleaning, model fallback, and strict verification."""
    pre = _preclean_gujarati_shruti(text)
    if not needs_llm_repair(pre):
        return pre, True, "precleaned"

    pieces = _split_for_llm(pre, max_chars=650)
    repaired_pieces: list[str] = []
    for piece in pieces:
        if not needs_llm_repair(piece):
            repaired_pieces.append(clean_ligatures(piece))
            continue

        # Escape raw control bytes/CR so tokenizer never passes invisible bytes through verbatim
        visible_piece = _CTRL_RE.sub("[?]", re.sub(r"([\u0a80-\u0aff])\r|\r([\u0a80-\u0aff])", r"\1[?]\2", piece))
        last_reason = "not attempted"
        success: Optional[str] = None
        for model_spec in models:
            prompt_text = visible_piece
            for attempt in range(3):
                try:
                    candidate = _call_groq_or_nvidia(prompt_text, model_spec)
                    ok, reason = verify_restored_text(piece, candidate)
                    if ok:
                        success = candidate
                        break
                    last_reason = f"{model_spec}: {reason}"
                    prompt_text = (
                        f"RETRY FIXING STRICTLY ({reason}). Keep every digit identically and output clean Gujarati with zero [?]:\n\n"
                        + visible_piece
                    )
                except TimeoutError as rate_err:
                    wait_s = 5.0 * (attempt + 1)
                    m = re.search(r"([0-9.]+)s", str(rate_err))
                    if m:
                        wait_s = max(2.0, min(25.0, float(m.group(1)) + 1.0))
                    time.sleep(wait_s)
                    last_reason = str(rate_err)
                except Exception as exc:
                    last_reason = f"{model_spec}: {type(exc).__name__}: {exc}"
                    time.sleep(1.5 * (attempt + 1))
            if success is not None:
                break

        if success is None:
            return pre, False, last_reason
        repaired_pieces.append(success)

    return "".join(repaired_pieces), True, "repaired"


def _is_valid_gr_number(val: Optional[str]) -> bool:
    if not val or val.strip().upper() == "UNKNOWN":
        return False
    if len(val.strip()) < 4 or not re.search(r"[0-9૦-૯]", val):
        return False
    if _CTRL_RE.search(val):
        return False
    if re.search(r"પ્રાચીનતા|In\s+exercise|http://|www\.", val, re.I):
        return False
    return True


def backup_corpus(corpus: Path, backup_dir: Path) -> None:
    if backup_dir.exists() and any(backup_dir.glob("*.json")):
        print(f"Backup already present at {backup_dir}; keeping untouched.", flush=True)
        return
    backup_dir.mkdir(parents=True, exist_ok=True)
    count = 0
    for f in sorted(corpus.glob("*.json")):
        shutil.copy2(f, backup_dir / f.name)
        count += 1
    print(f"Backed up {count} JSON files to {backup_dir}", flush=True)


def repair_one_file(
    path: Path,
    *,
    models: list[str],
    dry_run: bool = False,
    enable_llm: bool = True,
) -> dict:
    raw_obj = json.loads(path.read_text(encoding="utf-8"))
    rec = GRRecord.model_validate(raw_obj)
    repaired_blocks = 0
    failed_blocks = []

    for pg in rec.pages:
        for blk in pg.blocks:
            orig_txt = blk.text or ""
            if enable_llm and needs_llm_repair(orig_txt):
                if dry_run:
                    repaired_blocks += 1
                else:
                    restored, ok, reason = restore_block_via_llm(orig_txt, models)
                    if ok:
                        blk.text = clean_ligatures(restored)
                        blk.text_clean = normalize_digits(blk.text)
                        repaired_blocks += 1
                    else:
                        failed_blocks.append((blk.block_id, reason))
                        # At minimum scrub broken ligatures while flagging failure
                        blk.text = clean_ligatures(orig_txt)
                        blk.text_clean = normalize_digits(blk.text)
            else:
                cleaned = clean_ligatures(orig_txt)
                if cleaned != orig_txt or not blk.text_clean:
                    blk.text = cleaned
                    blk.text_clean = normalize_digits(cleaned)

    full_text = "\n\n".join(blk.text for pg in rec.pages for blk in pg.blocks if (blk.text or "").strip())
    rec.raw_text = full_text

    # Re-extract metadata cleanly while guarding already-valid identifiers
    new_gr, meta_conf = extract_gr_number(full_text)
    old_gr = re.sub(r"^[\s:;.,\-–—ઃ'\"]+", "", (rec.gr_number or "")).strip() or "UNKNOWN"
    old_gr_noisy = bool(re.search(r"(?:ચિવાલય|સચિવાલય|સિચવાલય)", old_gr))
    if _is_valid_gr_number(new_gr):
        if not _is_valid_gr_number(old_gr) or has_garbled_font_stream(old_gr) or old_gr_noisy:
            rec.gr_number = new_gr
            rec.metadata_confidence = max(rec.metadata_confidence or 0.0, meta_conf)
        else:
            rec.gr_number = old_gr
    elif not _is_valid_gr_number(old_gr):
        rec.gr_number = "UNKNOWN"
    else:
        rec.gr_number = old_gr

    new_date = extract_issue_date(full_text, rec.file_path or path.name)
    old_date = rec.issue_date
    if new_date:
        # Prefer freshly extracted header/gazette/signature date whenever missing OR when
        # existing date was likely a stale cited 'વંચાણે' date (e.g. year differs cleanly)
        if not old_date or new_date != old_date:
            rec.issue_date = new_date

    rec.department = extract_department(full_text, current_dept=rec.department)
    new_subj = extract_subject(full_text)
    if new_subj and new_subj != "Unknown Subject":
        rec.subject = new_subj

    clause_status = rec.chunks[0].clause_status if rec.chunks else ClauseStatus.UNKNOWN
    old_chunk_count = len(rec.chunks)
    rec.chunks = build_complete_chunks(
        rec.gr_id,
        rec.pages,
        subject=rec.subject,
        department=rec.department,
        gr_number=rec.gr_number,
        issue_date=rec.issue_date,
        clause_status=clause_status,
    )

    if not dry_run:
        path.write_text(json.dumps(rec.model_dump(mode="json"), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    return {
        "gr_id": rec.gr_id,
        "repaired_blocks": repaired_blocks,
        "failed_blocks": failed_blocks,
        "gr_number": (old_gr, rec.gr_number),
        "issue_date": (old_date, rec.issue_date),
        "department": rec.department,
        "chunks": (old_chunk_count, len(rec.chunks)),
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus", type=Path, default=ROOT / "data" / "processed")
    ap.add_argument("--backup", type=Path, default=DEFAULT_BACKUP_DIR)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--only-gr", action="append", help="process only matching gr_id (repeatable)")
    ap.add_argument("--no-restore-llm", action="store_true", help="skip LLM text repair (deterministic metadata/chunk pass only)")
    ap.add_argument(
        "--models",
        default="nvidia:nvidia/nemotron-3.5-bolt-e4b",
        help="comma-separated provider:model list in fallback priority order",
    )
    ap.add_argument("--workers", type=int, default=4, help="parallel worker files during repair")
    args = ap.parse_args()

    if not args.dry_run:
        backup_corpus(args.corpus, args.backup)

    models = [m.strip() for m in args.models.split(",") if m.strip()]
    files = sorted(args.corpus.glob("*.json"))
    if args.only_gr:
        want = set(args.only_gr)
        files = [f for f in files if f.stem in want]

    tot_repaired = 0
    tot_failed = 0
    total = len(files)

    def _run_one(item: tuple[int, Path]):
        idx, f = item
        return idx, repair_one_file(
            f,
            models=models,
            dry_run=args.dry_run,
            enable_llm=not args.no_restore_llm,
        )

    workers = 1 if (args.dry_run or args.no_restore_llm or total <= 1) else max(1, args.workers)
    if workers == 1:
        results = [_run_one((idx, f)) for idx, f in enumerate(files, 1)]
    else:
        results = []
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futs = [pool.submit(_run_one, (idx, f)) for idx, f in enumerate(files, 1)]
            for fut in as_completed(futs):
                idx, res = fut.result()
                results.append((idx, res))
                changed = (
                    res["repaired_blocks"] > 0
                    or res["failed_blocks"]
                    or res["gr_number"][0] != res["gr_number"][1]
                    or res["issue_date"][0] != res["issue_date"][1]
                )
                if changed:
                    print(
                        f"[{idx}/{total}] {res['gr_id']}: blocks_repaired={res['repaired_blocks']} "
                        f"failed={len(res['failed_blocks'])} gr={res['gr_number']} date={res['issue_date']} "
                        f"chunks={res['chunks'][0]}->{res['chunks'][1]}",
                        flush=True,
                    )
                    for bid, why in res["failed_blocks"]:
                        print(f"   WARN {bid}: {why}", flush=True)
        results.sort(key=lambda x: x[0])

    for idx, res in results:
        tot_repaired += res["repaired_blocks"]
        tot_failed += len(res["failed_blocks"])
        if workers == 1:
            changed = (
                res["repaired_blocks"] > 0
                or res["failed_blocks"]
                or res["gr_number"][0] != res["gr_number"][1]
                or res["issue_date"][0] != res["issue_date"][1]
            )
            if changed or args.only_gr:
                print(
                    f"[{idx}/{total}] {res['gr_id']}: blocks_repaired={res['repaired_blocks']} "
                    f"failed={len(res['failed_blocks'])} gr={res['gr_number']} date={res['issue_date']} "
                    f"chunks={res['chunks'][0]}->{res['chunks'][1]}",
                    flush=True,
                )
                for bid, why in res["failed_blocks"]:
                    print(f"   WARN {bid}: {why}", flush=True)

    print(
        f"Done ({'dry-run' if args.dry_run else 'written'}): files={len(files)}, "
        f"repaired_blocks={tot_repaired}, failed_blocks={tot_failed}",
        flush=True,
    )
    return 0 if tot_failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
