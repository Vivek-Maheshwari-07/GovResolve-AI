"""
Squad 1 — Data Ingestion Pipeline
Turns raw GR PDFs (scanned or digital) into canonical GRRecord JSON objects.

Pipeline stages:
  1. PDF type detection (per page: digital vs scanned)
  2. Text extraction (PyMuPDF for digital, Tesseract for scanned)
  3. Image pre-processing (denoise, deskew) before OCR
  4. Metadata extraction (GR number, date, department, subject)
  5. Gujarati digit normalisation
  6. Structural chunking (clauses, paragraphs, tables)
  7. Duplicate detection
  8. Save to data/processed/<gr_id>.json
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import sys
from pathlib import Path
from typing import Optional

import pymupdf as fitz       # PyMuPDF (modern import)
import pdfplumber
from PIL import Image, ImageFilter, ImageOps
from loguru import logger

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))
from backend.models import (
    BoundingBox, Chunk, ClauseStatus, GRRecord, Language,
    PageRecord, SourceType, TextBlock,
)

try:
    import pytesseract
    TESSERACT_AVAILABLE = True

    # Auto-detect Tesseract binary on Windows and standard paths
    candidates = [
        os.getenv("TESSERACT_CMD", ""),
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        shutil.which("tesseract") or "",
    ]
    for c in candidates:
        if c and Path(c).is_file():
            pytesseract.pytesseract.tesseract_cmd = c
            logger.info(f"Using Tesseract OCR at: {c}")
            break

    # Setup local or custom tessdata prefix
    local_tessdata = Path(__file__).parent.parent.parent / "data" / "tessdata"
    if local_tessdata.exists() and "TESSDATA_PREFIX" not in os.environ:
        os.environ["TESSDATA_PREFIX"] = str(local_tessdata.resolve())
        logger.info(f"Using TESSDATA_PREFIX: {local_tessdata.resolve()}")
except ImportError:
    TESSERACT_AVAILABLE = False
    logger.warning("pytesseract not installed — scanned pages will have empty text.")

# ── Config ────────────────────────────────────
TESSERACT_LANG = "guj+eng"         # Gujarati + English
OCR_CONF_THRESHOLD = 0.60          # below → flag as POOR_SCAN
DIGITAL_TEXT_THRESHOLD = 50        # chars per page → digital if above

# Gujarati digit map
GU_DIGIT_MAP = str.maketrans("૦૧૨૩૪૫૬૭૮૯", "0123456789")

# GR number patterns (adjust from real GRs during Days 1-3)
GR_NUMBER_PATTERNS = [
    r"ક્રમાંક\s*[:\-]?\s*([^\n\r]{5,60})",
    r"No\.?\s*([A-Z]{2,5}/\d{4}/\d+/[^\s]+)",
    r"GR\s*No\.?\s*([^\s\n]{5,30})",
    r"(\w+/\d{4}/\w+/\w+)",
]

DATE_PATTERNS = [
    r"(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})",    # DD/MM/YYYY
    r"(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})",    # YYYY-MM-DD
    r"(\d{1,2})\s+(January|February|March|April|May|June|July|August|"
    r"September|October|November|December)\s+(\d{4})",
    # Gujarati months mapped later
]

DEPT_KEYWORDS = {
    "General Administration": "General Administration Department",
    "GAD": "General Administration Department",
    "Finance": "Finance Department",
    "Revenue": "Revenue Department",
    "Education": "Education Department",
    "Health": "Health Department",
    "Home": "Home Department",
    "સામાન્ય વહીવટ": "General Administration Department",
    "નાણા": "Finance Department",
}


# ──────────────────────────────────────────────
# Utilities
# ──────────────────────────────────────────────

def normalise_gujarati_digits(text: str) -> str:
    """Replace Gujarati digits with ASCII digits in a copy for search."""
    return text.translate(GU_DIGIT_MAP)


def file_hash(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def detect_page_type(page: fitz.Page) -> SourceType:
    """Digital if the page has enough extractable text chars."""
    text = page.get_text("text")
    return SourceType.DIGITAL if len(text.strip()) > DIGITAL_TEXT_THRESHOLD else SourceType.SCANNED


def preprocess_image(img: Image.Image) -> Image.Image:
    """Denoise + auto-contrast + convert to grayscale for better OCR."""
    img = img.convert("L")
    img = ImageOps.autocontrast(img)
    img = img.filter(ImageFilter.MedianFilter(size=3))
    return img


def ocr_image(img: Image.Image) -> tuple[str, float]:
    """Run Tesseract, return (text, confidence 0-1)."""
    if not TESSERACT_AVAILABLE:
        return "", 0.0
    try:
        lang = TESSERACT_LANG
        try:
            avail = pytesseract.get_languages()
            if "guj" not in avail and "eng" in avail:
                lang = "eng"
        except Exception:
            pass

        data = pytesseract.image_to_data(
            img, lang=lang, output_type=pytesseract.Output.DICT
        )
        texts, confs = [], []
        for i, word in enumerate(data.get("text", [])):
            c = float(data.get("conf", [0])[i])
            if c > 0 and word.strip():
                texts.append(word)
                confs.append(c / 100.0)
        confidence = sum(confs) / len(confs) if confs else 0.0
        return " ".join(texts), confidence
    except Exception as e:
        logger.warning(f"OCR failed for image: {e}")
        return "", 0.0


def ocr_page(fitz_page: fitz.Page, page_number: int) -> tuple[str, float, list[TextBlock]]:
    """OCR a fitz page; return (full_text, confidence, blocks)."""
    mat = fitz.Matrix(2, 2)          # 2x scale for better OCR
    pix = fitz_page.get_pixmap(matrix=mat)
    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    img = preprocess_image(img)
    text, conf = ocr_image(img)

    # Build a single block (bounding-box for whole page)
    block = TextBlock(
        block_id=f"p{page_number}_b0",
        text=text,
        text_clean=normalise_gujarati_digits(text),
        bbox=BoundingBox(x0=0, y0=0, x1=pix.width / 2, y1=pix.height / 2, page=page_number),
        ocr_confidence=conf,
    )
    return text, conf, [block]


def extract_digital_page(fitz_page: fitz.Page, page_number: int) -> tuple[str, list[TextBlock]]:
    """Extract text and bounding boxes from a digital PDF page."""
    blocks = []
    full_text_parts = []
    for block in fitz_page.get_text("dict")["blocks"]:
        if block["type"] != 0:   # 0 = text block
            continue
        lines = []
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                lines.append(span["text"])
        block_text = " ".join(lines).strip()
        if not block_text:
            continue
        full_text_parts.append(block_text)
        bbox_raw = block["bbox"]  # (x0, y0, x1, y1)
        tb = TextBlock(
            block_id=f"p{page_number}_b{len(blocks)}",
            text=block_text,
            text_clean=normalise_gujarati_digits(block_text),
            bbox=BoundingBox(
                x0=bbox_raw[0], y0=bbox_raw[1],
                x1=bbox_raw[2], y1=bbox_raw[3],
                page=page_number,
            ),
        )
        blocks.append(tb)
    return "\n".join(full_text_parts), blocks


# ──────────────────────────────────────────────
# Metadata extraction
# ──────────────────────────────────────────────

def extract_gr_number(text: str) -> tuple[str, float]:
    for pat in GR_NUMBER_PATTERNS:
        m = re.search(pat, text)
        if m:
            return m.group(1).strip(), 0.9
    norm_text = normalise_gujarati_digits(text)
    for pat in GR_NUMBER_PATTERNS:
        m = re.search(pat, norm_text)
        if m:
            return m.group(1).strip(), 0.8
    return "UNKNOWN", 0.3


def extract_date(text: str) -> Optional[str]:
    """Try to extract the first date and return YYYY-MM-DD."""
    text = normalise_gujarati_digits(text)
    MONTHS = {
        "January": "01", "February": "02", "March": "03", "April": "04",
        "May": "05", "June": "06", "July": "07", "August": "08",
        "September": "09", "October": "10", "November": "11", "December": "12",
        "જાન્યુઆરી": "01", "ફેબ્રુઆરી": "02", "માર્ચ": "03", "એપ્રિલ": "04",
        "મે": "05", "જૂન": "06", "જુલાઈ": "07", "ઓગસ્ટ": "08",
        "સપ્ટેમ્બર": "09", "ઓક્ટોબર": "10", "નવેમ્બર": "11", "ડિસેમ્બર": "12",
    }
    # DD/MM/YYYY or DD-MM-YYYY
    m = re.search(r"(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})", text)
    if m:
        d, mo, y = m.group(1).zfill(2), m.group(2).zfill(2), m.group(3)
        if 1 <= int(d) <= 31 and 1 <= int(mo) <= 12:
            return f"{y}-{mo}-{d}"
    # DD Month YYYY (English or Gujarati)
    months_pattern = "|".join(MONTHS.keys())
    m = re.search(
        rf"(\d{{1,2}})\s+({months_pattern})\s+(\d{{4}})", text, re.IGNORECASE
    )
    if m:
        d = m.group(1).zfill(2)
        month_name = m.group(2).capitalize() if m.group(2).isascii() else m.group(2)
        mo = MONTHS.get(month_name, "01")
        y = m.group(3)
        return f"{y}-{mo}-{d}"
    return None


def extract_department(text: str) -> str:
    for kw, dept in DEPT_KEYWORDS.items():
        if kw.lower() in text.lower():
            return dept
    return "Unknown Department"


def extract_subject(text: str) -> str:
    """Find the line after 'Subject:' or 'વિષય:'"""
    for pat in [r"Subject\s*[:\-]\s*(.+)", r"વિષય\s*[:\-]\s*(.+)"]:
        m = re.search(pat, text)
        if m:
            return m.group(1).strip()[:200]
    # fallback: first non-empty line after 2 lines
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    return lines[2] if len(lines) > 2 else lines[0] if lines else "Unknown Subject"


def detect_language(text: str) -> Language:
    gu_chars = len(re.findall(r"[\u0A80-\u0AFF]", text))
    en_chars  = len(re.findall(r"[a-zA-Z]", text))
    total = gu_chars + en_chars
    if total == 0:
        return Language.EN
    gu_ratio = gu_chars / total
    if gu_ratio > 0.7:
        return Language.GU
    if gu_ratio < 0.3:
        return Language.EN
    return Language.MIXED


# ──────────────────────────────────────────────
# Structural chunking
# ──────────────────────────────────────────────

CLAUSE_PATTERN = re.compile(
    r"^\s*(\d+\.?\s*\([a-z]\)|\d+\.|[ivxlIVXL]+\.|[a-z]\)|\([a-z]\)|\([ivxl]+\))",
    re.MULTILINE,
)


def chunk_text(gr_id: str, full_text: str, pages: list[PageRecord]) -> list[Chunk]:
    """
    Structural chunking: split by clauses / paragraphs.
    Keeps page attribution and bboxes via block tracking.
    """
    chunks: list[Chunk] = []

    # Build a page→text mapping for bbox lookup
    page_map: dict[int, list[TextBlock]] = {p.page_number: p.blocks for p in pages}

    # Split by blank lines (paragraph level first)
    paragraphs = re.split(r"\n{2,}", full_text)
    chunk_idx = 0

    for para in paragraphs:
        para = para.strip()
        if len(para) < 20:          # skip very short noise
            continue

        # Determine which page(s) this paragraph sits on
        para_pages: list[int] = []
        para_bboxes: list[BoundingBox] = []
        for pg in pages:
            for blk in pg.blocks:
                if blk.text.strip() and blk.text.strip() in para:
                    if pg.page_number not in para_pages:
                        para_pages.append(pg.page_number)
                    para_bboxes.append(blk.bbox)

        if not para_pages:
            para_pages = [pages[0].page_number] if pages else [1]

        # Try sub-splitting by clause markers
        sub_splits = CLAUSE_PATTERN.split(para)
        if len(sub_splits) > 1:
            # clause-level chunks
            i = 0
            while i < len(sub_splits):
                marker = sub_splits[i].strip() if i % 2 == 1 else ""
                content = sub_splits[i].strip() if i % 2 == 0 else ""
                if i + 1 < len(sub_splits) and i % 2 == 1:
                    content = sub_splits[i + 1].strip()
                    i += 2
                else:
                    i += 1
                if not content:
                    continue
                cid = f"{gr_id}_p{para_pages[0]}_c{chunk_idx:03d}"
                chunks.append(Chunk(
                    chunk_id=cid,
                    gr_id=gr_id,
                    text=content,
                    text_clean=normalise_gujarati_digits(content),
                    pages=para_pages,
                    bboxes=para_bboxes[:1],
                    chunk_type="clause",
                    section_ref=marker or None,
                    clause_status=ClauseStatus.UNKNOWN,
                ))
                chunk_idx += 1
        else:
            # paragraph-level chunk
            cid = f"{gr_id}_p{para_pages[0]}_c{chunk_idx:03d}"
            chunks.append(Chunk(
                chunk_id=cid,
                gr_id=gr_id,
                text=para,
                text_clean=normalise_gujarati_digits(para),
                pages=para_pages,
                bboxes=para_bboxes[:1],
                chunk_type="paragraph",
                clause_status=ClauseStatus.UNKNOWN,
            ))
            chunk_idx += 1

    return chunks


# ──────────────────────────────────────────────
# Main ingestion function
# ──────────────────────────────────────────────

def ingest_pdf(
    pdf_path: str,
    gr_id: Optional[str] = None,
    processed_dir: str = "./data/processed",
) -> GRRecord:
    """
    Full ingestion pipeline for one PDF.
    Returns a GRRecord and saves it to processed_dir.
    """
    pdf_path = str(Path(pdf_path).resolve())
    logger.info(f"Ingesting: {pdf_path}")

    doc = fitz.open(pdf_path)
    all_pages: list[PageRecord] = []
    full_text_parts: list[str] = []
    scanned_count = 0

    for page_num in range(len(doc)):
        fitz_page = doc[page_num]
        pg_type = detect_page_type(fitz_page)

        if pg_type == SourceType.DIGITAL:
            page_text, blocks = extract_digital_page(fitz_page, page_num + 1)
            page_rec = PageRecord(
                page_number=page_num + 1,
                source_type=SourceType.DIGITAL,
                width=fitz_page.rect.width,
                height=fitz_page.rect.height,
                blocks=blocks,
            )
        else:
            scanned_count += 1
            page_text, conf, blocks = ocr_page(fitz_page, page_num + 1)
            page_rec = PageRecord(
                page_number=page_num + 1,
                source_type=SourceType.SCANNED,
                ocr_confidence=conf,
                width=fitz_page.rect.width,
                height=fitz_page.rect.height,
                blocks=blocks,
            )

        all_pages.append(page_rec)
        full_text_parts.append(page_text)

    doc.close()

    full_text = "\n\n".join(full_text_parts)
    majority_type = SourceType.SCANNED if scanned_count > len(all_pages) / 2 else SourceType.DIGITAL

    # --- Metadata extraction (from first 3 pages) ---
    header_text = "\n".join(full_text_parts[:3])
    gr_number, meta_conf = extract_gr_number(header_text)
    issue_date  = extract_date(header_text)
    department  = extract_department(header_text)
    subject     = extract_subject(header_text)
    language    = detect_language(full_text)

    # --- Auto-generate gr_id if not provided ---
    if not gr_id:
        dept_prefix = "".join(w[0] for w in department.split()[:3]).upper()
        year = issue_date[:4] if issue_date else "0000"
        fhash = file_hash(pdf_path)[:6]
        gr_id = f"{dept_prefix}-{year}-{fhash}"

    # --- Chunking ---
    chunks = chunk_text(gr_id, full_text, all_pages)

    record = GRRecord(
        gr_id=gr_id,
        gr_number=gr_number,
        department=department,
        issue_date=issue_date,
        subject=subject,
        language=language,
        source_type=majority_type,
        file_path=pdf_path,
        pages=all_pages,
        chunks=chunks,
        metadata_confidence=meta_conf,
        raw_text=full_text,
    )

    # --- Save ---
    out_path = Path(processed_dir) / f"{gr_id}.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(record.model_dump_json(indent=2))
    logger.success(f"Saved {gr_id} → {out_path}")

    return record


def ingest_directory(
    pdf_dir: str = "./data/grs",
    processed_dir: str = "./data/processed",
    skip_existing: bool = True,
) -> list[GRRecord]:
    """
    Ingest all PDFs in a directory and any subdirectories recursively.
    Handles nested folders (e.g. GAD/2021/, Finance/Leave/).
    """
    records: list[GRRecord] = []
    seen_hashes: set[str] = set()

    processed_path = Path(processed_dir)
    existing_ids = {p.stem for p in processed_path.glob("*.json")} if skip_existing else set()

    # Recursively find all .pdf and .PDF files in subdirectories
    all_pdf_files = sorted(
        [p for p in Path(pdf_dir).rglob("*") if p.is_file() and p.suffix.lower() == ".pdf"]
    )
    logger.info(f"Found {len(all_pdf_files)} PDF files in {pdf_dir} (including subdirectories).")

    for pdf_file in all_pdf_files:
        fh = file_hash(str(pdf_file))
        if fh in seen_hashes:
            logger.warning(f"Duplicate file skipped: {pdf_file.name}")
            continue
        seen_hashes.add(fh)

        # Skip already-processed (by filename stem)
        stem = pdf_file.stem
        if skip_existing and stem in existing_ids:
            logger.info(f"Already processed: {stem}, loading from cache.")
            with open(processed_path / f"{stem}.json", encoding="utf-8") as f:
                records.append(GRRecord.model_validate_json(f.read()))
            continue

        try:
            rec = ingest_pdf(str(pdf_file), processed_dir=processed_dir)
            records.append(rec)
        except Exception as e:
            logger.error(f"Failed to ingest {pdf_file.name}: {e}")

    return records


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        ingest_pdf(sys.argv[1])
    else:
        ingest_directory()
