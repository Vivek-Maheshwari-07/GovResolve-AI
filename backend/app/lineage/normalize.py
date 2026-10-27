"""Step 1: normalisation. Original text is never changed; matching runs on a normalised copy."""
import re
import unicodedata
from dataclasses import dataclass
from datetime import date

_ZERO_WIDTH = dict.fromkeys(map(ord, "​‌‍﻿"), None)
_GU_DIGITS = {ord(c): str(i) for i, c in enumerate("૦૧૨૩૪૫૬૭૮૯")}
_DASHES = dict.fromkeys(map(ord, "‐‑‒–—−"), "-")

MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "jun": 6, "jul": 7, "aug": 8, "sep": 9, "sept": 9,
    "oct": 10, "nov": 11, "dec": 12,
    "જાન્યુઆરી": 1, "ફેબ્રુઆરી": 2, "માર્ચ": 3, "એપ્રિલ": 4, "મે": 5, "જૂન": 6, "જુલાઈ": 7, "ઓગસ્ટ": 8,
    "સપ્ટેમ્બર": 9, "ઓક્ટોબર": 10, "નવેમ્બર": 11, "ડિસેમ્બર": 12,
}
_MON = "|".join(sorted(map(re.escape, MONTHS), key=len, reverse=True))

_NUMERIC = re.compile(r"(?<![\d/\-.])(\d{1,2})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{4}|\d{2})(?![\d/\-])")
_ISO = re.compile(r"(?<![\d/\-])(\d{4})-(\d{2})-(\d{2})(?!\d)")
_DMY_NAME = re.compile(rf"(?<!\d)(\d{{1,2}})(?:st|nd|rd|th)?[\s\-,.]*(?:of\s+)?({_MON})[a-z]*\.?[\s\-,.]*(\d{{4}})(?!\d)", re.I)
_MDY_NAME = re.compile(rf"\b({_MON})[a-z]*\.?[\s\-]*(\d{{1,2}})(?:st|nd|rd|th)?[\s,\-]+(\d{{4}})(?!\d)", re.I)

_SEPARATORS = re.compile(r"[\s\-_/.,:;()\[\]\\|]")


def clean(s: str) -> str:
    return unicodedata.normalize("NFC", s).translate(_ZERO_WIDTH)


def gu_to_ascii_digits(s: str) -> str:
    return s.translate(_GU_DIGITS)


def normalize_text(s: str) -> str:
    """NFC, no zero-width chars, ASCII digits, plain dashes, collapsed spaces. Newlines are kept."""
    s = gu_to_ascii_digits(clean(s)).translate(_DASHES).replace("\r", "")
    s = re.sub(r"[ \t ]+", " ", s)
    return re.sub(r" *\n *", "\n", s)


def join_lines(s: str) -> str:
    """OCR line breaks inside a phrase must not break matching."""
    return re.sub(r"\s*\n\s*", " ", s).strip()


@dataclass(frozen=True)
class DateHit:
    value: date
    start: int
    end: int
    text: str


def _mk(y: int, m: int, d: int) -> date | None:
    if y < 100:
        y += 1900 if y >= 50 else 2000
    try:
        return date(y, m, d)
    except ValueError:
        return None


def find_dates(text: str) -> list[DateHit]:
    """Every date in the text, in order. Expects normalised text (ASCII digits)."""
    hits: list[DateHit] = []

    def add(m: re.Match, value: date | None) -> None:
        if value:
            hits.append(DateHit(value, m.start(), m.end(), m.group(0)))

    for m in _ISO.finditer(text):
        add(m, _mk(int(m[1]), int(m[2]), int(m[3])))
    for m in _NUMERIC.finditer(text):
        add(m, _mk(int(m[3]), int(m[2]), int(m[1])))
    for m in _DMY_NAME.finditer(text):
        add(m, _mk(int(m[3]), MONTHS[m[2].lower()], int(m[1])))
    for m in _MDY_NAME.finditer(text):
        add(m, _mk(int(m[3]), MONTHS[m[1].lower()], int(m[2])))
    hits.sort(key=lambda h: (h.start, -(h.end - h.start)))
    out: list[DateHit] = []
    for h in hits:  # drop overlaps, keep the longest at each position
        if not out or h.start >= out[-1].end:
            out.append(h)
    return out


def parse_date(text: str) -> date | None:
    hits = find_dates(normalize_text(text))
    return hits[0].value if hits else None


def normalize_gr_number(s: str) -> str:
    """ASCII digits, no spaces, uppercase Latin; Gujarati letters are kept."""
    return re.sub(r"\s+", "", normalize_text(s)).upper()


def gr_key(s: str) -> str:
    """Separator-free key so GAD/2014/07, GAD-2014-07 and 'gad 2014 07' compare equal."""
    return _SEPARATORS.sub("", normalize_text(s)).upper()
