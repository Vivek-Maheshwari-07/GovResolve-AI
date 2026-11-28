"""Shared clean metadata extraction, ligature normalization, and complete structural chunking."""
from __future__ import annotations

import re
from datetime import date
from pathlib import Path
from typing import Optional

from backend.models import BoundingBox, Chunk, ClauseStatus, PageRecord

_GU_DIGITS = str.maketrans("૦૧૨૩૪૫૬૭૮૯", "0123456789")

_MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
    "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "jun": 6, "jul": 7, "aug": 8,
    "sep": 9, "sept": 9, "oct": 10, "nov": 11, "dec": 12,
    "જાન્યુઆરી": 1, "ફેબ્રુઆરી": 2, "માર્ચ": 3, "એપ્રિલ": 4, "મે": 5, "જૂન": 6,
    "જુલાઈ": 7, "જુલાઇ": 7, "ઓગસ્ટ": 8, "ઑગસ્ટ": 8, "સપ્ટેમ્બર": 9,
    "ઓક્ટોબર": 10, "ઑક્ટોબર": 10, "ઓકટોબર": 10, "નવેમ્બર": 11, "ડિસેમ્બર": 12,
}

_BEFORE_READ_RE = re.compile(
    r"(?:વ[ંા][ચર્][ંા][ણળ](?:ે|માં)?\s*લી[ધઘ][ાાં]*|સંદર્ભ\s*[:ઃ\-]|^Read\s*[:\-]|^\s*PREAMBLE\b|^\s*આમુખ\s*[:ઃ\-]|In\s+exercise\s+of\s+the\s+powers|\bWHEREAS\b)",
    re.I | re.M,
)

# Check specific departments (especially PRHRDD) before general Finance Department references in body clauses
ORDERED_DEPT_KEYWORDS = [
    ("panchayat, rural housing", "Panchayat, Rural Housing and Rural Development Department"),
    ("panchayats, rural housing", "Panchayat, Rural Housing and Rural Development Department"),
    ("prhrdd", "Panchayat, Rural Housing and Rural Development Department"),
    ("commissioner of rural development", "Panchayat, Rural Housing and Rural Development Department"),
    ("પંચાયત, ગ્રામ ગૃહ", "Panchayat, Rural Housing and Rural Development Department"),
    ("પંચાયત", "Panchayat, Rural Housing and Rural Development Department"),
    ("ગ્રામ વિકાસ", "Panchayat, Rural Housing and Rural Development Department"),
    ("સામાન્ય વહીવટ", "General Administration Department"),
    ("general administration", "General Administration Department"),
    ("સા.વ.વિ.", "General Administration Department"),
    ("gad", "General Administration Department"),
    ("મહેસૂલ", "Revenue Department"),
    ("revenue department", "Revenue Department"),
    ("નાણા વિભાગ", "Finance Department"),
    ("finance department", "Finance Department"),
    ("શિક્ષણ", "Education Department"),
    ("education department", "Education Department"),
    ("આરોગ્ય અને પરિવાર કલ્યાણ", "Health and Family Welfare Department"),
    ("આરોગ્ય", "Health and Family Welfare Department"),
    ("health and family welfare", "Health and Family Welfare Department"),
    ("ગૃહ વિભાગ", "Home Department"),
    ("home department", "Home Department"),
    ("શહેરી વિકાસ", "Urban Development and Urban Housing Department"),
    ("urban development", "Urban Development and Urban Housing Department"),
    ("માર્ગ અને મકાન", "Roads and Buildings Department"),
    ("roads and buildings", "Roads and Buildings Department"),
    ("સામાજિક ન્યાય", "Social Justice and Empowerment Department"),
    ("social justice", "Social Justice and Empowerment Department"),
    ("કાયદા વિભાગ", "Legal Department"),
    ("legal department", "Legal Department"),
]


def clean_ligatures(text: str) -> str:
    """Fix common PDF ligatures and zero-width joiner noise cleanly."""
    if not text:
        return ""
    return (
        text.replace("\ufb01", "fi")
        .replace("\ufb02", "fl")
        .replace("\u200c", "")
        .replace("\u200d", "")
    )


def normalize_digits(text: str) -> str:
    return clean_ligatures(text).translate(_GU_DIGITS)


_OCR_CORRUPTION_RE = re.compile(
    r"ાાં|ક્રમાાંક|૫રર૫ત્ર|નવભાગ|નવકાસ|િહીિટ|ધિભાગ|િાંિાણે|ગાાંિી|ગાાંઘી|પાાંર્ાયત|નાણાંકીય|રરપોટચ|નિમાચણ|વયકાય|તાયીખ|મલબાગ|ક્રભાાંક|ચનયમ|વવભાગ|અચધચનયમ|ચવભાગ|ચનણણય"
)
_INVERTED_IMATRA_RE = re.compile(r"(?:^|\s|[^\u0a95-\u0ab9\u0adf])\u0abf[\u0a95-\u0ab9]")
_SHRUTI_PUNCT_RE = re.compile(r"[\u0a80-\u0aff][&*@<>?^]|[&*@<>?^][\u0a80-\u0aff]")
_EXT_MOJIBAKE_RE = re.compile(r"[\u0100-\u02ff\ufffd]")


def has_garbled_font_stream(text: str) -> bool:
    """True when PDF text contains Shruti/legacy control bytes, inverted i-matras, or severe Gujarati OCR noise."""
    if not text:
        return False
    ctrl = len(re.findall(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f\ufff0-\uffff]", text))
    mid_cr = len(re.findall(r"[\u0a80-\u0aff]\r|\r[\u0a80-\u0aff]", text))
    imat = len(_INVERTED_IMATRA_RE.findall(text))
    sym = len(_SHRUTI_PUNCT_RE.findall(text))
    ocr_err = len(_OCR_CORRUPTION_RE.findall(text))
    ext_m = len(_EXT_MOJIBAKE_RE.findall(text))
    return ctrl >= 1 or mid_cr >= 1 or imat >= 3 or sym >= 3 or ocr_err >= 2 or ext_m >= 3


def _valid_date(y: int, m: int, d: int) -> Optional[str]:
    if not (1950 <= y <= 2030 and 1 <= m <= 12 and 1 <= d <= 31):
        return None
    try:
        return date(y, m, d).isoformat()
    except ValueError:
        return None


def _parse_dates_in_snippet(snippet: str) -> list[str]:
    """Extract plausible YYYY-MM-DD dates from a header/footer snippet."""
    s = normalize_digits(snippet)
    # Fix isolated OCR lookalike 'ર' ('ra') inside 4-digit years like '૨૦૧ર' or 'ર૦૧૯'
    s = re.sub(r"(?<=[\d/\-.])ર(?=[\d/\-.])|ર(?=\d{3}\b)", "2", s)
    found: list[str] = []

    # 1. Explicit Month DD, YYYY (English Gazette headers: 'OCTOBER 29, 2024', 'JULY 1, 2024')
    mon_pat = "|".join(sorted(_MONTHS, key=len, reverse=True))
    for m in re.finditer(rf"\b({mon_pat})\s+(\d{{1,2}})(?:st|nd|rd|th)?\s*,?\s*(\d{{4}})\b", s, re.I):
        mo = _MONTHS.get(m.group(1).lower())
        iso = _valid_date(int(m.group(3)), mo, int(m.group(2))) if mo else None
        if iso:
            found.append(iso)

    # 2. DD Month YYYY or DD-Mon-YYYY (English or Gujarati)
    for m in re.finditer(rf"\b(\d{{1,2}})(?:st|nd|rd|th)?[\s\-]+({mon_pat})\.?[\s,\-]+(\d{{4}})\b", s, re.I):
        mo = _MONTHS.get(m.group(2).lower())
        iso = _valid_date(int(m.group(3)), mo, int(m.group(1))) if mo else None
        if iso:
            found.append(iso)

    # 3. ISO YYYY.MM.DD or YYYY-MM-DD (e-sign timestamps: 'Date: 2023.08.18 12:33:26')
    for m in re.finditer(r"(?<!\d)(\d{4})[./\-](\d{1,2})[./\-](\d{1,2})(?!\d)", s):
        iso = _valid_date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        if iso:
            found.append(iso)

    # 4. Day-first DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    for m in re.finditer(r"(?<!\d)(\d{1,2})\s*[./\-]\s*(\d{1,2})\s*[./\-]\s*(\d{4})(?!\d)", s):
        iso = _valid_date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        if iso:
            found.append(iso)

    return found


def extract_issue_date(full_text: str, filename: str = "") -> Optional[str]:
    """
    Extract the GR's own issue/publication date cleanly without stealing dates from 'વંચાણે લીધા' references.
    Priority: header block (before Read/Preamble) -> digital-signature footer -> filename date.
    """
    cleaned = clean_ligatures(full_text or "")
    split = _BEFORE_READ_RE.search(cleaned)
    header = cleaned[:split.start()] if split else cleaned[:1600]

    # Header Gazette weekday banner or labelled 'તા. / તારીખ / Dated' lines
    for line_pat in [
        r"(?:MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)\s*,?\s*([^\n\r]{6,60})",
        r"(?:તારીખ|તા\.?|Dated?|Dt\.?)\s*[:\-ઃ]?\s*([^\n\r]{6,50})",
    ]:
        for m in re.finditer(line_pat, header, re.I):
            if "ઈ-સાઈન" in m.group(0) or "e-sign" in m.group(0).lower():
                continue
            dates = _parse_dates_in_snippet(m.group(0))
            if dates:
                return dates[0]

    header_dates = _parse_dates_in_snippet(header)
    if header_dates:
        return header_dates[0]

    # E-signature / Letter footer near the end of the document
    tail = cleaned[-1800:] if len(cleaned) > 1800 else cleaned
    for pat in [
        r"(?:Approved\s+Date|Dt\.?|Date)\s*[:\-]\s*([^\n\r]{8,40})",
        r"Signed\s+by[^\n\r]*\n[^\n\r]*(?:Date|Dt)[^\n\r]*",
    ]:
        for m in re.finditer(pat, tail, re.I):
            dates = _parse_dates_in_snippet(m.group(0))
            if dates:
                return dates[0]

    # Safe filename fallback (only explicit 4-digit year dates)
    if filename:
        fname = Path(filename.replace("\\", "/")).name
        m_fn = re.search(r"(?<!\d)(\d{1,2})[-_](\d{1,2})[-_](19\d{2}|20[0-2]\d)(?!\d)", fname)
        if m_fn:
            iso = _valid_date(int(m_fn.group(3)), int(m_fn.group(2)), int(m_fn.group(1)))
            if iso:
                return iso
        m_compact = re.search(r"(?<!\d)(\d{2})(\d{2})(19\d{2}|20[0-2]\d)(?!\d)", fname)
        if m_compact:
            iso = _valid_date(int(m_compact.group(3)), int(m_compact.group(2)), int(m_compact.group(1)))
            if iso:
                return iso

    return None


def _clean_gr_token(raw: str) -> Optional[str]:
    val = clean_ligatures(raw or "").strip()
    val = " ".join(val.split())
    val = re.sub(r"^[\s:;.,\-–—ઃ'\"]+", "", val)
    val = re.sub(r"[\s,/\-–]+(?:સચિવાલય|સિચવાલય|ચિવાલય|ગાંધીનગર|તા\.|તારીખ|Dated?|In exercise|Approved).*$", "", val, flags=re.I)
    val = re.sub(r"\s*[:\-]+\s*$", "", val)
    val = val.strip(" ,.;'\"`")
    if len(val) < 4 or len(val) > 90:
        return None
    if re.search(r"In\s+exercise\s+of|Government\s+hereby", val, re.I):
        return None
    if not re.search(r"[0-9૦-૯]", val):
        return None
    return val


def extract_gr_number(full_text: str) -> tuple[str, float]:
    """Extract canonical GR / Circular / Notification / e-file number from header or e-sign footer."""
    cleaned = clean_ligatures(full_text or "")
    split = _BEFORE_READ_RE.search(cleaned)
    header = cleaned[:split.start()] if split else cleaned[:2200]

    patterns = [
        r"(?:ઠરાવ\s*(?:ક્રમાંક|કમાંક|નં\.?)|પરિપત્ર\s*(?:ક્રમાંક|કમાંક|નં\.?)|જાહેરનામ[ાુું]\s*(?:ક્રમાંક|કમાંક|નં\.?)|હુકમ\s*(?:ક્રમાંક|કમાંક)|ક્રમાંક|કમાંક)\s*[:\-ઃ.\s]*([^\n\r]{5,90})",
        r"(?:G\.?R\.?|Resolution|Circular|Notification|Order)\s*No\.?\s*[:\-]?\s*([^\n\r]{5,90})",
        r"\bNo\.?\s*[:\-]?\s*([A-Z]{2,10}[/\-\s]+(?:\d+\s+of\s+)?\d{4}[/\-][A-Za-z0-9/\-().\s]{2,70})",
        r"\b((?:PRHRDD|GAD|FD|CRD|RD|HD|GHM|KP|GS|CRR|SLT|VNM)[/\-][A-Za-z0-9/\-().]{4,80})",
    ]
    for pat in patterns:
        for m in re.finditer(pat, header, re.I):
            tok = _clean_gr_token(m.group(1))
            if tok:
                return tok, 0.92

    # Check Letter No / File No in footer if header had no numbered identifier
    tail = cleaned[-1800:] if len(cleaned) > 1800 else cleaned
    for pat in [
        r"File\s*No\s*[:\-]\s*([^\n\r]{6,85})",
        r"Letter\s*No\s*[:\-]\s*([^\n\r]{6,85})",
        r"\b((?:PRHRDD|GAD|FD|CRD|GHM|KP|GS)[/\-][A-Za-z0-9/\-().\s]{5,80})",
    ]:
        for m in re.finditer(pat, tail, re.I):
            tok = _clean_gr_token(m.group(1))
            if tok:
                return tok, 0.85

    return "UNKNOWN", 0.3


def extract_department(full_text: str, current_dept: Optional[str] = None) -> str:
    """Determine owning department from header and signature blocks before falling back to body."""
    cleaned = clean_ligatures(full_text or "")
    split = _BEFORE_READ_RE.search(cleaned)
    header = cleaned[:split.start()] if split else cleaned[:1500]
    tail = cleaned[-1400:] if len(cleaned) > 1400 else ""

    for zone in (header.lower(), tail.lower(), cleaned[:3000].lower()):
        for kw, dept in ORDERED_DEPT_KEYWORDS:
            if kw in zone:
                return dept
    if current_dept and current_dept != "Unknown Department":
        return current_dept
    return "General Administration Department"


def extract_subject(full_text: str) -> str:
    """Extract untruncated GR subject line or Notification title."""
    cleaned = clean_ligatures(full_text or "")
    for pat in [r"(?:Subject|વિષય)\s*[:\-ઃ]\s*([^\n]+(?:\n[^\n]{10,160})?)"]:
        m = re.search(pat, cleaned[:1800], re.I)
        if m:
            s = " ".join(m.group(1).split())
            if len(s) >= 12:
                return s[:350]

    # Gujarati top-header subject ending in બાબત. / અંગે.
    top = cleaned[:1400]
    m_gu = re.search(r"^\s*(.{15,450}?(?:બાબત|અંગે)\.?)(?:\s*\n|\s+ગુજરાત\s+સરકાર)", top, re.S)
    if m_gu:
        s = " ".join(m_gu.group(1).split())
        # Strip Gazette/header prefixes if caught accidentally
        s = re.sub(r"^(?:પ્રતિ|નં\.|\d+\s+)", "", s).strip()
        if len(s) >= 12:
            return s[:350]

    # English rules/notification title before Notification text
    split = _BEFORE_READ_RE.search(cleaned)
    hdr = cleaned[:split.start()] if split else cleaned[:1200]
    cands = []
    for ln in hdr.splitlines():
        ln_s = " ".join(ln.split())
        if len(ln_s) < 15:
            continue
        if re.search(r"^(?:Extra\s+No|©|The Gujarat Government Gazette|EXTRAORDINARY|PUBLISHED BY|Vol\.|MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY|Separate paging|PART\s+I|CENTRAL SECTION|Orders and Notifications|ગુજરાત સરકાર|સચિવાલય|ગાંધીનગર|ઠરાવ|પરિપત્ર|તા\.|તારીખ)", ln_s, re.I):
            continue
        cands.append(ln_s)
    if cands:
        return " ".join(cands[:3])[:350]

    lines = [" ".join(l.split()) for l in cleaned.splitlines() if len(l.strip()) >= 15]
    return lines[0][:350] if lines else "Unknown Subject"


_SPLIT_MARKERS = re.compile(
    r"(?=(?:^|\n)\s*(?:વંચાણ(?:ે|માં)\s*લીધ|આમુખ\s*[:ઃ\-]|ઠરાવ\s*[:ઃ\-]|સંદર્ભ\s*[:ઃ\-]|PREAMBLE\s*[:ઃ\-]|READ\s*[:ઃ\-]|ORDER\s*[:ઃ\-]))"
    r"|(?=(?:^|\n)\s*\(?(?:[0-9]{1,2}|[૧-૯૦-૯]{1,2})[\).]\s+)"
    r"|\n{2,}",
    re.I,
)
_SENT_BREAK = re.compile(r"(?<=[.!?।])\s+")


def _split_long_segment(text: str, max_chars: int = 1200) -> list[str]:
    text = text.strip()
    if len(text) <= max_chars:
        return [text] if text else []
    out: list[str] = []
    sents = _SENT_BREAK.split(text)
    if len(sents) == 1:
        # Line-based split fallback for dense tables / schedules
        sents = [ln.strip() for ln in text.splitlines() if ln.strip()]
    cur = ""
    for s in sents:
        s = s.strip()
        if not s:
            continue
        if cur and len(cur) + 1 + len(s) > max_chars:
            out.append(cur)
            cur = s
        else:
            cur = f"{cur} {s}".strip() if cur else s
    if cur:
        out.append(cur)
    # Hard word-wrap safety for single oversized tokens/lines
    final: list[str] = []
    for piece in out:
        if len(piece) <= max_chars:
            final.append(piece)
        else:
            words = piece.split()
            buf = ""
            for w in words:
                if buf and len(buf) + 1 + len(w) > max_chars:
                    final.append(buf)
                    buf = w
                else:
                    buf = f"{buf} {w}".strip() if buf else w
            if buf:
                final.append(buf)
    return final


def build_complete_chunks(
    gr_id: str,
    pages: list[PageRecord],
    *,
    subject: str,
    department: str,
    gr_number: str,
    issue_date: Optional[str],
    clause_status: ClauseStatus = ClauseStatus.UNKNOWN,
) -> list[Chunk]:
    """
    Chunk ALL page content faithfully (metadata preamble + 'વંચાણે લીધા' + 'આમુખ' + clauses + signature footers)
    without discarding preambles, tables, or trailing signature dates.
    """
    chunks: list[Chunk] = []
    chunk_idx = 0

    meta_lines = [
        f"વિષય / Subject: {subject}",
        f"વિભાગ / Department: {department}",
        f"ઠરાવ ક્રમાંક / GR No.: {gr_number}",
        f"તારીખ / Date: {issue_date or 'Unknown'}",
    ]
    meta_text = "\n".join(meta_lines)
    chunks.append(Chunk(
        chunk_id=f"{gr_id}_p1_c{chunk_idx:03d}",
        gr_id=gr_id,
        text=meta_text,
        text_clean=normalize_digits(meta_text),
        pages=[1],
        bboxes=[BoundingBox(x0=0, y0=0, x1=595, y1=200, page=1)],
        chunk_type="preamble",
        clause_status=clause_status,
    ))
    chunk_idx += 1

    for pg in pages:
        page_num = pg.page_number
        blocks = pg.blocks or []
        for blk in blocks:
            raw = clean_ligatures(blk.text or "").strip()
            if not raw:
                continue
            raw_parts = [p.strip() for p in _SPLIT_MARKERS.split(raw) if p and p.strip()]
            # Coalesce tiny headings/labels with the following segment so we don't drop or bloat short fragments
            merged: list[str] = []
            carry = ""
            for part in raw_parts:
                if carry:
                    part = f"{carry}\n{part}".strip()
                    carry = ""
                if len(part) < 90:
                    carry = part
                else:
                    merged.append(part)
            if carry:
                if merged:
                    merged[-1] = f"{merged[-1]}\n{carry}".strip()
                else:
                    merged.append(carry)

            box = blk.bbox or BoundingBox(x0=0, y0=0, x1=pg.width or 595, y1=pg.height or 842, page=page_num)
            for seg in merged:
                for piece in _split_long_segment(seg, max_chars=1250):
                    if not piece.strip():
                        continue
                    is_pre = bool(re.search(r"વંચાણ|આમુખ|\bRead\s*:|Preamble", piece[:120], re.I))
                    chunks.append(Chunk(
                        chunk_id=f"{gr_id}_p{page_num}_c{chunk_idx:03d}",
                        gr_id=gr_id,
                        text=piece,
                        text_clean=normalize_digits(piece),
                        pages=[page_num],
                        bboxes=[box],
                        chunk_type="preamble" if is_pre else "clause",
                        clause_status=clause_status,
                        ocr_confidence=blk.ocr_confidence,
                    ))
                    chunk_idx += 1

    return chunks
