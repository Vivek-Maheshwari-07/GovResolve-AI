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
import re
import sys
from pathlib import Path
from typing import Optional

import pymupdf as fitz       # PyMuPDF (modern import)
from PIL import Image
from loguru import logger

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))
from backend.models import (
    BoundingBox, Chunk, ClauseStatus, GRRecord, Language,
    PageRecord, SourceType, TextBlock,
)
from backend.ingestion.metadata import (
    build_complete_chunks,
    clean_ligatures,
    extract_department as _shared_extract_department,
    extract_gr_number as _shared_extract_gr_number,
    extract_issue_date as _shared_extract_issue_date,
    extract_subject as _shared_extract_subject,
    has_garbled_font_stream,
)

from backend.ingestion import ocr as _ocr

TESSERACT_AVAILABLE = _ocr.PYTESSERACT and _ocr.configure()

# ── Config ────────────────────────────────────
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

DEPT_KEYWORDS = {
    "General Administration": "General Administration Department",
    "GAD": "General Administration Department",
    "Finance": "Finance Department",
    "Revenue": "Revenue Department",
    "Education": "Education Department",
    "Health and Family Welfare": "Health and Family Welfare Department",
    "Health": "Health and Family Welfare Department",
    "Home": "Home Department",
    "Panchayat": "Panchayat, Rural Housing and Rural Development Department",
    "PRHRDD": "Panchayat, Rural Housing and Rural Development Department",
    "Agriculture": "Agriculture, Farmers Welfare and Co-operation Department",
    "Roads and Buildings": "Roads and Buildings Department",
    "PWD": "Roads and Buildings Department",
    "Urban Development": "Urban Development and Urban Housing Department",
    "Social Justice": "Social Justice and Empowerment Department",
    "Tribal Development": "Tribal Development Department",
    "Women and Child": "Women and Child Development Department",
    "Labour": "Labour, Skill Development and Employment Department",
    "Food, Civil Supplies": "Food, Civil Supplies and Consumer Affairs Department",
    "Water Resources": "Water Resources and Water Supply Department",
    "Forest and Environment": "Forest and Environment Department",
    "Forest": "Forest and Environment Department",
    "Energy and Petrochemicals": "Energy and Petrochemicals Department",
    "Industries and Mines": "Industries and Mines Department",
    "Ports and Transport": "Ports and Transport Department",
    "Science and Technology": "Science and Technology Department",
    "Legal": "Legal Department",
    "Legislative and Parliamentary": "Legislative and Parliamentary Affairs Department",
    "Information and Broadcasting": "Information and Broadcasting Department",
    "Tourism": "Tourism, Civil Aviation and Pilgrimage Department",
    "Sports, Youth": "Sports, Youth and Cultural Activities Department",
    # Gujarati names
    "સામાન્ય વહીવટ": "General Administration Department",
    "નાણા": "Finance Department",
    "મહેસૂલ": "Revenue Department",
    "ગૃહ": "Home Department",
    "શિક્ષણ": "Education Department",
    "આરોગ્ય": "Health and Family Welfare Department",
    "પંચાયત": "Panchayat, Rural Housing and Rural Development Department",
    "કૃષિ": "Agriculture, Farmers Welfare and Co-operation Department",
    "માર્ગ અને મકાન": "Roads and Buildings Department",
    "શહેરી વિકાસ": "Urban Development and Urban Housing Department",
    "સામાજિક ન્યાય": "Social Justice and Empowerment Department",
    "આદિજાતિ": "Tribal Development Department",
    "મહિલા અને બાળ": "Women and Child Development Department",
    "શ્રમ અને રોજગાર": "Labour, Skill Development and Employment Department",
    "અન્ન અને નાગરિક પુરવઠા": "Food, Civil Supplies and Consumer Affairs Department",
    "જળસંપત્તિ": "Water Resources and Water Supply Department",
    "વન અને પર્યાવરણ": "Forest and Environment Department",
    "ઊર્જા": "Energy and Petrochemicals Department",
    "ઉદ્યોગ": "Industries and Mines Department",
    "બંદરો અને વાહનવ્યવહાર": "Ports and Transport Department",
    "વિજ્ઞાન અને પ્રૌદ્યોગિકી": "Science and Technology Department",
    "કાયદા": "Legal Department",
    "રમતગમત": "Sports, Youth and Cultural Activities Department",
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
    """Digital only when extractable text is substantial and free of broken non-Unicode font bytes."""
    text = page.get_text("text")
    if len(text.strip()) <= DIGITAL_TEXT_THRESHOLD or has_garbled_font_stream(text):
        return SourceType.SCANNED
    return SourceType.DIGITAL


def ocr_image(img: Image.Image) -> tuple[str, float]:
    """OCR one image: (text, mean word confidence 0-1). The language is chosen per page (see ingestion/ocr.py)."""
    if not TESSERACT_AVAILABLE:
        return "", 0.0
    try:
        page = _ocr.ocr_image(img.convert("L"), dpi=_ocr.DEFAULT_DPI)
        return page.text, page.confidence
    except Exception as e:
        logger.warning(f"OCR failed for image: {e}")
        return "", 0.0


def ocr_page(fitz_page: fitz.Page, page_number: int) -> tuple[str, float, list[TextBlock]]:
    """OCR a fitz page at 300 DPI; return (full_text, confidence, blocks)."""
    if not TESSERACT_AVAILABLE:
        return "", 0.0, []
    try:
        page = _ocr.ocr_pdf_page(fitz_page)
    except Exception as e:
        logger.warning(f"OCR failed for page {page_number}: {e}")
        return "", 0.0, []

    blocks: list[TextBlock] = []
    for para in page.paragraphs:
        x0, y0, x1, y1 = para.bbox
        blocks.append(TextBlock(
            block_id=f"p{page_number}_b{len(blocks)}",
            text=para.text,
            text_clean=normalise_gujarati_digits(para.text),
            bbox=BoundingBox(x0=x0, y0=y0, x1=x1, y1=y1, page=page_number),
            ocr_confidence=para.confidence,
        ))
    return page.text, page.confidence, blocks


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
        block_text = clean_ligatures(" ".join(lines).strip())
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
    return _shared_extract_gr_number(text)


def extract_date(text: str, filename: str = "") -> Optional[str]:
    return _shared_extract_issue_date(text, filename=filename)


def extract_department(text: str) -> str:
    return _shared_extract_department(text)


def extract_subject(text: str) -> str:
    return _shared_extract_subject(text)


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

    # --- Metadata extraction (across header + signature footer) ---
    gr_number, meta_conf = extract_gr_number(full_text)
    issue_date  = extract_date(full_text, filename=pdf_path)
    department  = extract_department(full_text)
    subject     = extract_subject(full_text)
    language    = detect_language(full_text)

    # --- Auto-generate gr_id if not provided ---
    if not gr_id:
        dept_prefix = "".join(w[0] for w in department.split()[:3]).upper()
        year = issue_date[:4] if issue_date else "0000"
        fhash = file_hash(pdf_path)[:6]
        gr_id = f"{dept_prefix}-{year}-{fhash}"

    # --- Complete structural chunking (retains Read/Preamble, Clauses, and Footer) ---
    chunks = build_complete_chunks(
        gr_id,
        all_pages,
        subject=subject,
        department=department,
        gr_number=gr_number,
        issue_date=issue_date,
    )

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
