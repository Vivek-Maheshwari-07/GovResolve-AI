"""Re-read the pages of corpus documents whose Gujarati text layer is garbled (legacy-font PDFs), with OCR.

A PDF whose embedded Gujarati font maps to the wrong characters has a text layer like "ચનયમ" for "નિયમ". This finds such
pages page by page, reads only those pages with OCR (Gujarati model, see ingestion/ocr.py), and keeps every clean page's text
layer exactly as it was (a gazette's English pages stay perfect). Metadata (GR number, date, subject, department, language) is
carried over from the existing record, so nothing the listing supplied is lost.

Usage (from backend/):
    python -m scripts.repair_garbled_pages --corpus ../data/corpus_v2 --pdf-root ../final_dataset            # dry run: report only
    python -m scripts.repair_garbled_pages --corpus ../data/corpus_v2 --pdf-root ../final_dataset --apply    # back up, then write

Only documents with garbled pages are touched. The originals are copied to `<corpus>_backup_before_repair/` first (once).
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from pathlib import Path

import pymupdf
from PIL import Image

from scripts.build_corpus import gujarati_score
from scripts.pdf_to_gr_json import _paragraphs, convert

try:
    from backend.ingestion import ocr
except ImportError:   # run from backend/
    from ingestion import ocr

_GU_WORD = re.compile(r"[઀-૿]+")
# Mappings seen in the archive: the i-matra read as another letter ("ચનયમ" for "નિયમ", "વવભાગ" for "વિભાગ"), Latin accents, U+FFFD.
_GARBLE = re.compile("ચનયમ|વવભાગ|અચધચનયમ|ચવભાગ|ચનણણય|ાાં|ક્રમાાંક|નવભાગ|નવકાસ|[Ā-˿�]")


def page_is_garbled(text: str) -> bool:
    """A page with enough Gujarati that reads wrongly: known garble patterns, or almost no common Gujarati words."""
    words = _GU_WORD.findall(text)
    if len(words) < 8:
        return False
    if len(_GARBLE.findall(text)) >= 2:
        return True
    return len(words) >= 25 and gujarati_score(text) < 0.02


def find_pdf(root: Path, name: str) -> Path | None:
    hits = sorted(root.rglob(name))
    return hits[0] if hits else None


_GU_LETTER = re.compile(r"[઀-૿]")


def ocr_block(page, bbox, old_text: str, dpi: int, confs: list[float]) -> str:
    """OCR one block of a page (its clip rectangle) with the Gujarati model.

    Tables and multi-column blocks can lose most of their text under one layout setting, so other settings are tried when the
    result is much shorter than the text layer. If none comes close, the layer text is kept: digits and structure
    (rates, dates) matter more than perfect Gujarati words.
    """
    rect = pymupdf.Rect(*bbox) + (-3, -3, 3, 3)
    pix = page.get_pixmap(dpi=dpi, colorspace=pymupdf.csGRAY, clip=rect)
    img = Image.frombytes("L", (pix.width, pix.height), pix.samples)
    best, best_confs = "", []
    for psm in (6, 4, 3):
        result = ocr.ocr_image(img, dpi=dpi, lang="guj", deskew=False, psm=psm)
        text = " ".join(p.text for p in result.paragraphs)
        if len(text) > len(best):
            best, best_confs = text, result.word_confidences
        if len(best) >= 0.6 * len(old_text):
            break
    if len(best) < 0.6 * len(old_text):
        return old_text
    confs.extend(best_confs)
    return best


def repair(rec: dict, pdf: Path, dpi: int = 300) -> tuple[dict | None, list[int], list[float]]:
    """New record for `rec` with garbled text re-read; None when no page is garbled.

    On a garbled page only the blocks that contain Gujarati are re-read (clip by clip); blocks with no Gujarati letters,
    such as the English half of a gazette page, keep their text layer exactly.
    """
    doc = pymupdf.open(pdf)
    bad = [i for i, page in enumerate(doc, start=1) if page_is_garbled(page.get_text())]
    if not bad:
        return None, [], []
    confs: list[float] = []

    def paragraphs(page):
        blocks = _paragraphs(page)
        if page.number + 1 not in bad:
            return blocks
        out = []
        for txt, bb in blocks:
            if len(_GU_LETTER.findall(txt)) < 3:
                out.append((txt, bb))
                continue
            out.append((ocr_block(page, bb, txt, dpi, confs).strip() or txt, bb))
        return out

    new = convert(pdf, rec["gr_id"], rec.get("department"), rec.get("language", "en"), paragraphs)
    if new is None:
        return None, bad, confs
    for key in ("gr_number", "gr_number_norm", "issue_date", "subject", "department", "language"):
        if rec.get(key) is not None:
            new[key] = rec[key]
    new["field_confidence"] = {**new["field_confidence"], **rec.get("field_confidence", {})}
    if confs:
        new["field_confidence"]["ocr_mean_word_conf"] = round(sum(confs) / len(confs) / 100, 3)
    return new, bad, confs


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus", type=Path, required=True)
    ap.add_argument("--pdf-root", type=Path, required=True)
    ap.add_argument("--only", nargs="*", help="gr_ids to look at (default: every record)")
    ap.add_argument("--apply", action="store_true", help="write the repaired records (default: report only)")
    args = ap.parse_args()

    backup = args.corpus.with_name(args.corpus.name + "_backup_before_repair")
    changed = 0
    for f in sorted(args.corpus.glob("*.json")):
        if f.name == "corpus_report.json" or (args.only and f.stem not in args.only):
            continue
        rec = json.loads(f.read_text(encoding="utf-8"))
        if "chunks" not in rec or not rec.get("source_pdf"):
            continue
        old_text = " ".join(c["text"] for c in rec["chunks"])
        if len(_GARBLE.findall(old_text)) < 3:   # cheap filter before opening any PDF
            continue
        pdf = find_pdf(args.pdf_root, rec["source_pdf"])
        if pdf is None:
            print(f"NO PDF   {f.stem}: {rec['source_pdf']}")
            continue
        new, bad, confs = repair(rec, pdf)
        if new is None:
            print(f"CLEAN    {f.stem} (no garbled page found)")
            continue
        new_text = " ".join(c["text"] for c in new["chunks"])
        conf = f"{sum(confs) / len(confs):.0f}" if confs else "-"
        print(f"REPAIRED {f.stem}: pages {bad} of {rec['page_count']}; garble hits {len(_GARBLE.findall(old_text))} -> "
              f"{len(_GARBLE.findall(new_text))}; gujarati score {gujarati_score(old_text):.3f} -> {gujarati_score(new_text):.3f}; "
              f"chunks {len(rec['chunks'])} -> {len(new['chunks'])}; OCR conf {conf}")
        if args.apply:
            backup.mkdir(exist_ok=True)
            if not (backup / f.name).exists():
                shutil.copyfile(f, backup / f.name)
            f.write_text(json.dumps(new, ensure_ascii=False), encoding="utf-8")
        changed += 1
    print(f"{changed} document(s) {'rewritten' if args.apply else 'would change (dry run; add --apply)'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
