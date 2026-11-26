"""Fill missing GR metadata (issue date, GR number, subject) in ingested records, from the document text, its file name and the
dataset manifest. Only empty, "UNKNOWN" or impossible values (a date in the future or before 1947) are replaced; every value written
records its source under `metadata_sources`, so a reader can tell an extracted date from one taken from a file name.

    python -m backend.scripts.enrich_metadata --corpus data/processed --manifest final_dataset/manifest.csv [--dry-run]

Order of trust for the issue date: the Gazette header ("TUESDAY, FEBRUARY 1, 2022"), "Dated the 17th October, 2020", a Gujarati
"તા./તારીખ" date near the top, a date in the file name, the manifest's detected date (first date in the text, least reliable).
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import ntpath
import re
from pathlib import Path
from typing import Optional

GU_DIGITS = str.maketrans("૦૧૨૩૪૫૬૭૮૯", "0123456789")
MONTHS = {m: i + 1 for i, m in enumerate(
    "january february march april may june july august september october november december".split())}
MON_RE = "|".join(MONTHS)
GU_MONTHS = {"જાન્યુઆરી": 1, "ફેબ્રુઆરી": 2, "માર્ચ": 3, "એપ્રિલ": 4, "મે": 5, "જૂન": 6, "જુન": 6, "જુલાઈ": 7, "જુલાઇ": 7,
             "ઓગસ્ટ": 8, "સપ્ટેમ્બર": 9, "ઓક્ટોબર": 10, "ઓકટોબર": 10, "નવેમ્બર": 11, "ડિસેમ્બર": 12}
TODAY = dt.date.today()

_GAZETTE = re.compile(r"(?:MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)\s*,\s*(" + MON_RE + r")\s+(\d{1,2})\s*,\s*(\d{4})", re.I)
_DATED = re.compile(r"Dated\s+(?:the\s+)?(\d{1,2})\s*(?:st|nd|rd|th)?\s+(" + MON_RE + r")\s*,?\s*(\d{4})", re.I)
_GU_DATE = re.compile(r"(?:તા\.|તારીખ|તા)\s*[:&\-–.]*\s*(\d{1,2})\s*[./\-]\s*(\d{1,2})\s*[./\-]\s*(\d{4})")
_GU_WORD_DATE = re.compile(r"(\d{1,2})\s*(?:મી|લી|થી)?\s*(" + "|".join(GU_MONTHS) + r")\s*,?\s*(\d{4})")
_FILE_DMY = re.compile(r"(?<!\d)(\d{1,2})[-_.](\d{1,2})[-_.](\d{4})(?!\d)")
_FILE_YMD = re.compile(r"(?<!\d)((?:19|20)\d{2})(\d{2})(\d{2})(?!\d)")
_FILE_DMY_PACKED = re.compile(r"(?<!\d)(\d{2})(\d{2})((?:19|20)\d{2})(?!\d)")

_EN_NUMBER = re.compile(r"\bNo\s*\.?\s*([A-Z]{1,8}\s*[-/.]\s*[\w\-/.() ]{3,70}?)\s*[:;]\s*-")
_GU_NUMBER = re.compile(r"(?:ક્રમા+ં?ક|ક્રમાક|કમાંક|કમ ક|,માંક|/માંક|નંબર|નબર)\s*[:&\-–.ઃ ]*\s*([઀-૿A-Za-z0-9][઀-૿A-Za-z0-9/\-.()]{4,60})")
_RULES_TITLE = re.compile(r"(?:may be called|be called)\s+the\s+(.{10,160}?(?:Rules|Regulations|Order|Scheme)\s*,?\s*\d\s?\d{3})", re.I | re.S)
_SUBJECT_EN = re.compile(r"\b(?:Subject|SUBJECT|Sub)\s*[:.]+\s*(.{8,200}?)(?:\n|\.\s|Read|Ref)")
_SUBJECT_GU = re.compile(r"વિષય\s*[:\-ઃ]+\s*(.{6,200}?)(?:\n|વંચાણે|સંદર્ભ|આમુખ)")
_GU_TITLE = re.compile(r"^\s*(.{8,220}?બાબત)")


def _valid(y: int, m: int, d: int) -> Optional[dt.date]:
    try:
        day = dt.date(int(y), int(m), int(d))
    except ValueError:
        return None
    return day if dt.date(1947, 1, 1) <= day <= TODAY else None


def date_from_text(text: str) -> tuple[Optional[dt.date], str]:
    head = (text or "")[:3000].translate(GU_DIGITS)
    m = _GAZETTE.search(head)
    if m and (d := _valid(m.group(3), MONTHS[m.group(1).lower()], m.group(2))):
        return d, "gazette_header"
    m = _DATED.search(head)
    if m and (d := _valid(m.group(3), MONTHS[m.group(2).lower()], m.group(1))):
        return d, "dated_line"
    for rx, kind in ((_GU_DATE, "dmy"), (_GU_WORD_DATE, "word")):
        for m in rx.finditer(head[:1500]):
            d = (_valid(m.group(3), m.group(2), m.group(1)) if kind == "dmy"
                 else _valid(m.group(3), GU_MONTHS[m.group(2)], m.group(1)))
            if d:
                return d, "gujarati_date_line"
    return None, ""


_FILE_DMY_SHORT = re.compile(r"(?<!\d)(?=(\d{1,2})[-_.](\d{1,2})[-_.](\d{2})(?!\d))")   # 25-10-24; lookahead: every start is tried


def date_from_filename(name: str) -> Optional[dt.date]:
    stem = Path(name).stem
    for rx, order in ((_FILE_DMY, "dmy"), (_FILE_YMD, "ymd"), (_FILE_DMY_PACKED, "dmy")):
        for m in rx.finditer(stem):
            a, b, c = m.groups()
            d = _valid(a, b, c) if order == "ymd" else _valid(c, b, a)
            if d:
                return d
    for m in _FILE_DMY_SHORT.finditer(stem):
        a, b, yy = m.groups()
        year = 2000 + int(yy) if 2000 + int(yy) <= TODAY.year else 1900 + int(yy)
        if d := _valid(year, b, a):
            return d
    return None


# Panchayat notifications print "KP/22 of 2022 /PRR /102014 /77 /KH:" with no "No." in front
_KP_NUMBER = re.compile(r"\b((?:KP|GP|GS|GU)\s*/\s*\d{1,4}\s+of\s+\d{4}\s*(?:/\s*[\w\-.()]+\s*){1,8}?)\s*[:;]")


def number_from_text(text: str) -> Optional[str]:
    head = (text or "")[:3000]
    m = _EN_NUMBER.search(head) or _KP_NUMBER.search(head)
    if m:
        return re.sub(r"\s*/\s*", "/", re.sub(r"\s+", " ", m.group(1))).strip(" .-/")
    m = _GU_NUMBER.search(head)
    if m and re.search(r"[0-9૦-૯]", m.group(1)):
        return m.group(1).strip(" .-/")
    return None


def subject_from_text(text: str, name: str) -> tuple[Optional[str], str]:
    head = text or ""
    for rx, src in ((_RULES_TITLE, "rules_title"), (_SUBJECT_EN, "subject_line"), (_SUBJECT_GU, "subject_line")):
        m = rx.search(head[:6000])
        if m:
            title = re.sub(r"\s+", " ", m.group(1)).strip(" ,.:-")
            return re.sub(r"(\d) (\d{3})$", r"\1\2", title), src
    m = _GU_TITLE.search(re.sub(r"\s+", " ", head[:400]))
    if m:
        return m.group(1).strip(), "gujarati_title"
    stem = re.sub(r"^\d+_\d+_\d+_", "", Path(name).stem)                     # portal prefix 1_2198_1_
    stem = re.sub(r"[-_.]+", " ", re.sub(r"\d{1,4}([-_.]\d{1,4}){1,2}", " ", stem)).strip()
    words = [w for w in stem.split() if not w.isdigit()]
    if len(words) >= 2:
        return " ".join(words).strip().title(), "file_name"
    return None, ""


def _missing_number(v) -> bool:
    return not v or str(v).strip().upper() == "UNKNOWN"


def _missing_subject(v) -> bool:
    return not v or str(v).strip().lower().startswith("unknown")


def _bad_date(v) -> bool:
    if not v:
        return True
    try:
        d = dt.date.fromisoformat(str(v)[:10])
    except ValueError:
        return True
    return not (dt.date(1947, 1, 1) <= d <= TODAY)


def enrich(record: dict, manifest_row: Optional[dict] = None, recheck: bool = False) -> dict:
    """The fields changed in `record` (updated in place), as {field: (new value, source)}.

    With `recheck`, values the ingester found itself (no `metadata_sources` entry) are also checked: its date is the first date in the
    text, often one the order only cites in its read list, so a different date in the portal file name wins (unless the Gazette header
    gives the publication date); and a GR number that is only a tail of the one printed in the text is replaced by the full number."""
    name = ntpath.basename(record.get("file_path") or record.get("source_pdf") or "")
    text = record.get("raw_text") or " ".join(c.get("text", "") for c in record.get("chunks", [])[:3])
    sources = record.setdefault("metadata_sources", {})
    changed = {}
    if recheck and record.get("issue_date") and "issue_date" not in sources and not _bad_date(record.get("issue_date")):
        fd = date_from_filename(name)
        td, tsrc = date_from_text(text)
        best, src = (td, tsrc) if tsrc == "gazette_header" else (fd, "file_name")
        if best and best.isoformat() != str(record["issue_date"])[:10]:
            changed["issue_date"] = (best.isoformat(), f"{src} (was {record['issue_date']}, a date cited in the text)")
            record["issue_date"] = best.isoformat()
            sources["issue_date"] = src
    if recheck and not _missing_number(record.get("gr_number")) and "gr_number" not in sources:
        n = number_from_text(text)
        old = str(record["gr_number"]).strip()
        if n and len(n) > len(old) and old in n:
            record["gr_number"] = n
            sources["gr_number"] = "document_text"
            changed["gr_number"] = (n, "document_text (was truncated)")
    if _bad_date(record.get("issue_date")):
        d, src = date_from_text(text)
        fd = date_from_filename(name)
        # A "Dated ..." or Gujarati date line near the top is often a date the document cites (the order it amends), while the portal
        # file name carries the order's own date; only the Gazette header (the publication date) outranks the file name.
        if fd and src != "gazette_header" and d != fd:
            d, src = fd, "file_name"
        if not d and manifest_row and manifest_row.get("doc_date_detected"):
            md = _valid(*manifest_row["doc_date_detected"].split("-"))
            if md:
                d, src = md, "manifest_detected_date"
        if d:
            record["issue_date"] = d.isoformat()
            sources["issue_date"] = src
            changed["issue_date"] = (record["issue_date"], src)
        elif record.get("issue_date"):           # impossible date and nothing better: drop it rather than show it
            changed["issue_date"] = (None, "removed_impossible_date")
            record["issue_date"] = None
    if _missing_number(record.get("gr_number")):
        n = number_from_text(text)
        if n:
            record["gr_number"] = n
            sources["gr_number"] = "document_text"
            changed["gr_number"] = (n, "document_text")
    if _missing_subject(record.get("subject")):
        s, src = subject_from_text(text, name)
        if s:
            record["subject"] = s
            sources["subject"] = src
            changed["subject"] = (s, src)
    if manifest_row and manifest_row.get("source_url") and not record.get("source_url"):
        record["source_url"] = manifest_row["source_url"]
    if not sources:
        record.pop("metadata_sources", None)
    return changed


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--corpus", default="data/processed")
    ap.add_argument("--manifest", default="final_dataset/manifest.csv")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--recheck-dates", action="store_true", help="also correct dates and GR numbers the ingester found (see enrich)")
    args = ap.parse_args(argv)
    manifest = {}
    if Path(args.manifest).is_file():
        with open(args.manifest, encoding="utf-8-sig") as f:
            manifest = {ntpath.basename(r["file"]).lower(): r for r in csv.DictReader(f)}
    totals = {"issue_date": 0, "gr_number": 0, "subject": 0}
    files = sorted(Path(args.corpus).glob("*.json"))
    for path in files:
        rec = json.loads(path.read_text(encoding="utf-8"))
        changed = enrich(rec, manifest.get(ntpath.basename(rec.get("file_path") or "").lower()), recheck=args.recheck_dates)
        if args.dry_run and changed:
            print(rec["gr_id"], {k: v for k, v in changed.items()})
        for k in changed:
            totals[k] = totals.get(k, 0) + 1
        if changed and not args.dry_run:
            path.write_text(json.dumps(rec, ensure_ascii=False, indent=2), encoding="utf-8")
    left = {"issue_date": 0, "gr_number": 0, "subject": 0}
    for path in files:
        rec = json.loads(path.read_text(encoding="utf-8")) if not args.dry_run else None
        if rec is None:
            break
        left["issue_date"] += _bad_date(rec.get("issue_date"))
        left["gr_number"] += _missing_number(rec.get("gr_number"))
        left["subject"] += _missing_subject(rec.get("subject"))
    print(f"{len(files)} records; filled {totals}; still missing {left if not args.dry_run else '(dry run)'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
