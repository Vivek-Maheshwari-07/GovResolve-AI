"""Convert text-layer GR PDFs into GRRecord JSON files (the shape in app/schemas/gr.py).

Usage (from backend/):
    python -m scripts.pdf_to_gr_json --manifest ../final_dataset/manifest.csv --root ../final_dataset \
        --out D:/test/gr_json --tier 01_core_gad_searchable

Scanned PDFs (no text layer) are skipped: they need OCR first. Output is data, keep it out of git.
Metadata is best-effort and every guess carries a low confidence in field_confidence.
"""
import argparse
import csv
import hashlib
import json
import re
import sys
from datetime import date
from pathlib import Path

import pymupdf

from app.lineage.normalize import normalize_text

_MONTHS = {m: i + 1 for i, m in enumerate(
    "january february march april may june july august september october november december".split())}
_D_WORD = re.compile(r"(\d{1,2})\s*(?:st|nd|rd|th)?[\s,\-]*(" + "|".join(_MONTHS) + r")[\s,\-]*(\d{4})", re.I)
_D_NUM = re.compile(r"\b(\d{1,2})[./\-](\d{1,2})[./\-](\d{4})\b")
_NUMBER = re.compile(r"\b(?:GR|G\.R\.|Circular|Resolution|Order|Notification)?\s*No\.?\s*[:\-]?\s*([A-Za-z0-9અ-હ()]+(?:\s?[-/]\s?[A-Za-z0-9અ-હ()]+){1,})", re.I)
_CLAUSE = re.compile(r"(?m)^\s*\(?(\d{1,2})[.)]\s+(?=\S)")
_DEPT = [(re.compile(r"general\s+administration", re.I), "General Administration Department"),
         (re.compile(r"panchayat", re.I), "Panchayat, Rural Housing and Rural Development Department"),
         (re.compile(r"સામાન્ય\s+વહીવટ"), "સામાન્ય વહીવટ વિભાગ")]


def _first_date(text: str) -> date | None:
    cands = []
    for m in _D_WORD.finditer(text):
        cands.append((m.start(), int(m.group(3)), _MONTHS[m.group(2).lower()], int(m.group(1))))
    for m in _D_NUM.finditer(text):
        d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if 1 <= mo <= 12 and 1 <= d <= 31:
            cands.append((m.start(), y, mo, d))
    for _, y, mo, d in sorted(cands):
        try:
            return date(y, mo, d)
        except ValueError:
            continue
    return None


def _paragraphs(page) -> list[tuple[str, tuple[float, float, float, float]]]:
    out = []
    for x0, y0, x1, y1, txt, *_ in page.get_text("blocks"):
        txt = re.sub(r"[ \t]*\n[ \t]*", " ", txt).strip()
        if len(txt) < 15:
            continue
        out.append((txt, (x0, y0, x1, y1)))
    return out


_ENDS_SENTENCE = (".", ":", ":-", ";", "?", "!", "।", '"', "”")
MAX_MERGED = 1500


def merge_continuations(paras):
    """Join consecutive blocks when the first stops mid-sentence. OCR and PDF text blocks often end at a line or column
    break ('... rules further' / 'to amend the ... Rules'), and the lineage engine reads one chunk at a time."""
    out = []
    for txt, bb in paras:
        if out and not out[-1][0].rstrip().endswith(_ENDS_SENTENCE) and len(out[-1][0]) + len(txt) <= MAX_MERGED:
            prev, pbb = out[-1]
            out[-1] = (prev + " " + txt, (min(pbb[0], bb[0]), min(pbb[1], bb[1]), max(pbb[2], bb[2]), max(pbb[3], bb[3])))
        else:
            out.append((txt, bb))
    return out


def convert(pdf: Path, gr_id: str, department: str | None, language: str, paragraphs=None) -> dict | None:
    """`paragraphs(page)` defaults to the PDF text layer; scripts.ocr_to_gr_json passes an OCR reader."""
    paragraphs = paragraphs or _paragraphs
    doc = pymupdf.open(pdf)
    chunks, head = [], ""
    for pno, page in enumerate(doc, start=1):
        for txt, bb in merge_continuations(paragraphs(page)):
            if pno == 1 and len(head) < 2500:
                head += txt + "\n"
            pieces = [txt]
            m = list(_CLAUSE.finditer(txt.replace(" ", " ")))
            label = m[0].group(1) if m else None
            for piece in pieces:
                chunks.append({"chunk_id": f"{gr_id}:{len(chunks) + 1}", "page": pno, "text": piece,
                               "clause_label": label, "section": "other",
                               "bbox": {"x0": bb[0], "y0": bb[1], "x1": bb[2], "y1": bb[3]}})
    if not chunks:
        return None
    head_n = normalize_text(head)
    num = _NUMBER.search(head_n)
    dept = department
    for rx, name in _DEPT:
        if rx.search(head_n):
            dept = name
            break
    subj = None
    m = re.search(r"(?is)(?:\bsubject|વિષય)\s*[:\-ઃ]+\s*(.{10,250}?)(?:\n|\.\s|$)", head)
    if m:
        subj = re.sub(r"\s+", " ", m.group(1)).strip()
    return {"gr_id": gr_id, "gr_number": num.group(0).strip() if num else None,
            "gr_number_norm": re.sub(r"\s+", "", num.group(1)) if num else None,
            "department": dept, "issue_date": (_first_date(head_n).isoformat() if _first_date(head_n) else None),
            "subject": subj, "language": language, "source_pdf": pdf.name, "page_count": len(doc),
            "chunks": chunks,
            "field_confidence": {"gr_number": 0.5 if num else 0.0, "issue_date": 0.6 if _first_date(head_n) else 0.0,
                                 "subject": 0.5 if subj else 0.0, "department": 0.7 if dept else 0.0}}


def _scan_dir(root: Path, out: Path) -> int:
    """Walk a folder laid out as dept/section/year/file.pdf; keep unique text-layer PDFs only."""
    seen, done, skipped = set(), 0, 0
    for pdf in sorted(root.rglob("*.pdf")):
        sha = hashlib.sha256(pdf.read_bytes()).hexdigest()
        if sha in seen:
            skipped += 1
            continue
        seen.add(sha)
        try:
            doc = pymupdf.open(pdf)
            n = min(len(doc), 15)
            texty = sum(len(doc[i].get_text().strip()) >= 80 for i in range(n))
            sample = "".join(doc[i].get_text() for i in range(min(len(doc), 3)))
        except Exception:
            skipped += 1
            continue
        if n == 0 or texty < 0.8 * n:
            skipped += 1
            continue
        guj, lat = len(re.findall(r"[઀-૿]", sample)), len(re.findall(r"[A-Za-z]", sample))
        lang = "gu" if guj > lat else "en"
        dept = pdf.relative_to(root).parts[0]
        gr_id = "GR-" + re.sub(r"[^A-Za-z0-9_]+", "-", pdf.stem)[:60] + "-" + sha[:6]
        rec = convert(pdf, gr_id, dept, lang)
        if rec is None:
            skipped += 1
            continue
        (out / f"{gr_id}.json").write_text(json.dumps(rec, ensure_ascii=False), encoding="utf-8")
        done += 1
    print(f"converted {done}, skipped {skipped} (scanned, duplicate or unreadable) -> {out}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", type=Path)
    ap.add_argument("--root", type=Path)
    ap.add_argument("--pdf-dir", type=Path, help="alternative to --manifest: scan a folder of PDFs")
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--tier", default="01_core_gad_searchable")
    args = ap.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    if args.pdf_dir:
        return _scan_dir(args.pdf_dir, args.out)
    done = skipped = 0
    with open(args.manifest, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            if row["tier"] != args.tier or row["text_layer"] == "scanned":
                continue
            gr_id = "GR-" + re.sub(r"[^A-Za-z0-9_]+", "-", Path(row["file"]).stem)[:60] + "-" + row["sha256"][:6]
            rec = convert(args.root / row["file"], gr_id, row["department"], row["language"])
            if rec is None:
                skipped += 1
                continue
            (args.out / f"{gr_id}.json").write_text(json.dumps(rec, ensure_ascii=False), encoding="utf-8")
            done += 1
    print(f"converted {done}, skipped {skipped} -> {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
