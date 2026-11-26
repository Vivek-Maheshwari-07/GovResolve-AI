"""Text normalisation: Gujarati digits, GR-number keys, dates, language."""
from __future__ import annotations

import difflib
import re
import unicodedata
from datetime import date

_GUJARATI_DIGITS = "૦૧૨૩૪૫૬૭૮૯"
_DEVANAGARI_DIGITS = "०१२३४५६७८९"
_DIGIT_MAP = str.maketrans(
    {
        **{c: str(i) for i, c in enumerate(_GUJARATI_DIGITS)},
        **{c: str(i) for i, c in enumerate(_DEVANAGARI_DIGITS)},
    }
)

_SEPARATORS = re.compile(r"[\s\-/._,:;()\[\]]+")


def to_ascii_digits(text: str) -> str:
    """Map Gujarati/Devanagari digits to ASCII. Length-preserving."""
    return text.translate(_DIGIT_MAP)


def gr_key(gr_number: str) -> str:
    """Canonical comparison key for a GR number."""
    text = unicodedata.normalize("NFC", to_ascii_digits(gr_number))
    return _SEPARATORS.sub("", text).casefold()


def gr_similarity(a: str, b: str) -> float:
    return difflib.SequenceMatcher(None, gr_key(a), gr_key(b)).ratio()


_MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
    "july": 7, "august": 8, "september": 9, "october": 10, "november": 11,
    "december": 12,
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "jun": 6, "jul": 7, "aug": 8,
    "sep": 9, "sept": 9, "oct": 10, "nov": 11, "dec": 12,
    "જાન્યુઆરી": 1, "ફેબ્રુઆરી": 2, "માર્ચ": 3, "એપ્રિલ": 4, "મે": 5,
    "જૂન": 6, "જુલાઈ": 7, "જુલાઇ": 7, "ઓગસ્ટ": 8, "ઑગસ્ટ": 8,
    "સપ્ટેમ્બર": 9, "ઓક્ટોબર": 10, "ઑક્ટોબર": 10, "નવેમ્બર": 11,
    "ડિસેમ્બર": 12,
}

_NUMERIC_DATE = re.compile(
    r"(?<!\d)(\d{1,2})\s*[/.\-]\s*(\d{1,2})\s*[/.\-]\s*(\d{4})(?!\d)"
)
_TEXT_DATE = re.compile(
    r"(?<!\d)(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z઀-૿]+)\.?,?\s+(\d{4})(?!\d)"
)


def _make_date(y: int, m: int, d: int) -> date | None:
    try:
        return date(y, m, d)
    except ValueError:
        return None


def find_dates(text: str) -> list[tuple[int, int, date]]:
    """Find day-first dates. ``text`` must already have ASCII digits."""
    found: list[tuple[int, int, date]] = []
    for m in _NUMERIC_DATE.finditer(text):
        d = _make_date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        if d:
            found.append((m.start(), m.end(), d))
    for m in _TEXT_DATE.finditer(text):
        month = _MONTHS.get(m.group(2).casefold())
        if month:
            d = _make_date(int(m.group(3)), month, int(m.group(1)))
            if d:
                found.append((m.start(), m.end(), d))
    return sorted(found)


def parse_date(text: str) -> date | None:
    found = find_dates(to_ascii_digits(text))
    return found[0][2] if found else None


_GUJLISH_ADMIN_WORDS = {
    "yojana", "yojna", "panchvati", "panchwati", "tharav", "paripatra", "niyam", "niyamo",
    "karmchari", "karmachari", "karmchario", "adhikari", "adhikario", "sarkar", "rajya",
    "raja", "rajao", "pagar", "bhathu", "bhadu", "ganvesh", "kapad", "nikal", "binjaruri",
    "badli", "badhti", "bharti", "sahay", "updan", "aadesh", "hukam", "arji", "tapas",
    "samiti", "kamgiri", "faraj", "vahan", "vasulat", "spashtata", "jagyae", "vanchvanu",
    "darakhast", "manjuri", "karyavahi", "karyavidhi", "karyapadhati", "aheval", "sarpanch",
    "talati", "pariksha",
}
_GUJLISH_FUNC_WORDS = {
    "su", "shu", "che", "chhe", "nathi", "ketla", "ketli", "ketlu", "kyare", "kone", "kon",
    "kaun", "kevi", "kevo", "kevu", "kem", "mate", "mateni", "matena", "joie", "joye",
    "joyee", "karvu", "karva", "batao", "janavo", "samjavo", "kaho", "aapo", "apo",
    "malse", "malshe", "male", "lagu", "pade", "padse", "hethal", "mujab", "anusar",
    "pachi", "pahela", "sudhi", "vishe", "babat", "babate",
}
_ENGLISH_CUES = {
    "what", "how", "when", "where", "which", "who", "why", "is", "are", "was", "were",
    "the", "a", "an", "for", "under", "does", "do", "did", "can", "could", "should",
    "rules", "rule", "explain", "translate", "list", "show", "give",
}
_REQ_GU = re.compile(
    r"(?:\b(?:in|into|to|explain\s+in|answer\s+in|reply\s+in|speak\s+in|translate\s+(?:this\s+|it\s+)?(?:in|into|to))\s+gujarati\b"
    r"|\bgujarati\s+(?:ma|maa|me|mein|please)\b"
    r"|ગુજરાતી\s*માં|ગુજરાતી\s*ભાષા)",
    re.I,
)
_REQ_EN = re.compile(
    r"(?:\b(?:in|into|to|explain\s+in|answer\s+in|reply\s+in|speak\s+in|translate\s+(?:this\s+|it\s+)?(?:in|into|to))\s+english\b"
    r"|\benglish\s+(?:ma|maa|me|mein|please)\b"
    r"|અંગ્રેજી\s*માં|ઇંગ્લિશ\s*માં)",
    re.I,
)


def detect_requested_language(text: str) -> str | None:
    """Detect an explicit reply-language switch request inside a question or follow-up."""
    if not text:
        return None
    gu_matches = list(_REQ_GU.finditer(text))
    en_matches = list(_REQ_EN.finditer(text))
    if gu_matches and en_matches:
        return "gu" if gu_matches[-1].start() > en_matches[-1].start() else "en"
    if gu_matches:
        return "gu"
    if en_matches:
        return "en"
    return None


def detect_language(text: str) -> str:
    gujarati = sum(1 for c in text if "઀" <= c <= "૿")
    latin = sum(1 for c in text if c.isascii() and c.isalpha())
    total = gujarati + latin
    if not total:
        return "unknown"
    ratio = gujarati / total
    if ratio > 0.9:
        return "gu"
    if ratio >= 0.1:
        return "mixed"
    words = re.findall(r"[a-zA-Z]+", text.lower())
    if words:
        gu_hits = sum(1 for w in words if w in _GUJLISH_ADMIN_WORDS or w in _GUJLISH_FUNC_WORDS)
        en_hits = sum(1 for w in words if w in _ENGLISH_CUES)
        has_gu_func = any(w in _GUJLISH_FUNC_WORDS for w in words)
        if has_gu_func or (gu_hits >= 2 and en_hits == 0) or (gu_hits > en_hits and gu_hits >= 1):
            return "mixed"
    return "en"
