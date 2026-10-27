"""Detect explicit amendment / supersession references in page text.

Direction convention: every non-``refers_to`` hit means *the document being
scanned* acts on the referenced (older) document. Passive wording such as
"GR X as amended by GR Y" describes a third-party relation and is reported
as ``refers_to`` only.

Gujarati trigger words below are drafted from typical GR wording and have
NOT yet been validated against real scanned GRs; tune them on Squad 1's seed set.
"""
from __future__ import annotations

import re
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date

from .normalize import find_dates, to_ascii_digits
from .schemas import PageText, Relation

_TOKEN = r"[A-Za-z0-9઀-૿]"
_GR_NO = re.compile(
    r"(?:\bNos?\b\.?|\bNumber\b|ક્રમાંક|નંબર|નં\.?)\s*[:\-–]?\s*"
    rf"(?P<num>(?=[^\s,;()]*\d){_TOKEN}(?:{_TOKEN}|[/\-.])*{_TOKEN})",
    re.IGNORECASE,
)
_DATE_PREFIX = re.compile(r"(?:dated|dt\.?|તા\.?)\s*$", re.IGNORECASE)

# Highest priority first; overlapping lower-priority matches are dropped.
_TRIGGERS: list[tuple[Relation, re.Pattern[str]]] = [
    (
        Relation.CANCELS,
        re.compile(
            r"\b(?:cancel(?:led|s|l?ing)?|rescind(?:ed|s|ing)?|repeal(?:ed|s|ing)?"
            r"|revok(?:ed|es?|ing)|withdr(?:awn|aws?|ew))\b"
            r"|રદબાતલ|રદ\s*(?:કર|ગણ|થ)|પાછ[ોા]?\s*ખેંચ",
            re.IGNORECASE,
        ),
    ),
    (
        Relation.SUPERSEDES,
        re.compile(r"\bsupersed(?:es|ed|e|ing|ession)\b|અધિક્રમિત|અધિક્રમણ", re.IGNORECASE),
    ),
    (
        Relation.REPLACES,
        re.compile(
            r"\b(?:replac(?:es|ed|ing|e)|in\s+place\s+of|in\s+lieu\s+of)\b"
            r"|જગ્યાએ|સ્થાને|બદલે",
            re.IGNORECASE,
        ),
    ),
    (
        Relation.AMENDS,
        re.compile(
            r"\b(?:amend(?:s|ed|ing|ment|ments)?|modif(?:y|ies|ied|ication|ications)"
            r"|substitut(?:e|es|ed|ing)|corrigendum|addendum)\b"
            r"|સુધાર|ફેરફાર|આંશિક",
            re.IGNORECASE,
        ),
    ),
]

# "was amended by GR Y" (third-party) vs "is superseded by this GR" (active).
_PASSIVE_BY = re.compile(
    r"\s*(?:vide|by|through|with)\b(?!\s+(?:this|the\s+present|the\s+following|the\s+instant))",
    re.IGNORECASE,
)
_PASSIVE_WORDS = re.compile(
    r"(?:amended|modified|superseded|replaced|cancelled|rescinded|substituted)$",
    re.IGNORECASE,
)
_GENERIC_AMEND = re.compile(r"\s*from\s+time\s+to\s+time", re.IGNORECASE)

_ABBREVIATIONS = {
    "no", "nos", "dt", "dr", "sr", "shri", "smt", "govt", "gr", "vide", "etc",
    "rs", "ref", "art", "sec", "cl", "para", "નં", "તા", "શ્રી", "કુ", "ડૉ",
}
_BOUNDARY = re.compile(r"।|\n\s*\n|;|\.(?=\s+[A-Zઅ-હ])")

MAX_QUOTE_CHARS = 600
_PAIR_DISTANCE = 120


@dataclass(frozen=True)
class Reference:
    gr_number: str | None
    issue_date: date | None
    start: int
    end: int


@dataclass(frozen=True)
class Hit:
    relation: Relation
    reference: Reference | None
    page: int
    quote: str
    trigger: str | None


@dataclass(frozen=True)
class _Trigger:
    relation: Relation
    start: int
    end: int
    text: str
    passive: bool


def detect(pages: Iterable[PageText]) -> list[Hit]:
    hits: list[Hit] = []
    for page in pages:
        hits.extend(_detect_page(page.page, page.text))
    return _dedupe(hits)


def _detect_page(page: int, original: str) -> list[Hit]:
    text = to_ascii_digits(original)  # same length as original
    refs = _find_references(text)
    triggers = _find_triggers(text)
    hits: list[Hit] = []
    for start, end in _segments(text):
        seg_triggers = [t for t in triggers if start <= t.start < end]
        seg_refs = [r for r in refs if start <= r.start < end]
        quote = _quote(original, start, end, seg_triggers)
        if not seg_triggers:
            hits.extend(
                Hit(Relation.REFERS_TO, r, page, quote, None)
                for r in seg_refs
                if r.gr_number
            )
            continue
        if any(r.gr_number for r in seg_refs):
            seg_refs = [r for r in seg_refs if r.gr_number]
        used: set[_Trigger] = set()
        for ref in seg_refs:
            trig = min(seg_triggers, key=lambda t: _gap(t.start, t.end, ref.start, ref.end))
            relation = Relation.REFERS_TO if trig.passive else trig.relation
            hits.append(Hit(relation, ref, page, quote, trig.text))
            used.add(trig)
        hits.extend(
            Hit(t.relation, None, page, quote, t.text)
            for t in seg_triggers
            if t not in used and not t.passive
        )
    return hits


def _gap(a_start: int, a_end: int, b_start: int, b_end: int) -> int:
    return max(0, max(a_start, b_start) - min(a_end, b_end))


def _find_triggers(text: str) -> list[_Trigger]:
    accepted: list[_Trigger] = []
    for relation, pattern in _TRIGGERS:
        for m in pattern.finditer(text):
            if any(_gap(m.start(), m.end(), a.start, a.end) == 0 for a in accepted):
                continue
            if relation is Relation.AMENDS and _GENERIC_AMEND.match(text, m.end()):
                continue
            passive = bool(_PASSIVE_WORDS.search(m.group())) and bool(
                _PASSIVE_BY.match(text, m.end())
            )
            accepted.append(_Trigger(relation, m.start(), m.end(), m.group(), passive))
    return sorted(accepted, key=lambda t: t.start)


def _find_references(text: str) -> list[Reference]:
    numbers = [(m.start("num"), m.end("num"), m.group("num")) for m in _GR_NO.finditer(text)]
    dates = find_dates(text)

    pairs = sorted(
        (_gap(ns, ne, ds, de), i, j)
        for i, (ns, ne, _) in enumerate(numbers)
        for j, (ds, de, _) in enumerate(dates)
        if _gap(ns, ne, ds, de) <= _PAIR_DISTANCE
    )
    number_date: dict[int, int] = {}
    claimed: set[int] = set()
    for _, i, j in pairs:
        if i not in number_date and j not in claimed:
            number_date[i] = j
            claimed.add(j)

    refs = [
        Reference(
            gr,
            dates[number_date[i]][2] if i in number_date else None,
            start,
            end,
        )
        for i, (start, end, gr) in enumerate(numbers)
    ]
    for j, (start, end, d) in enumerate(dates):
        if j not in claimed and _DATE_PREFIX.search(text[max(0, start - 12):start]):
            refs.append(Reference(None, d, start, end))
    return sorted(refs, key=lambda r: r.start)


def _segments(text: str) -> list[tuple[int, int]]:
    spans: list[tuple[int, int]] = []
    start = 0
    for m in _BOUNDARY.finditer(text):
        if m.group() == ".":
            words = text[max(0, m.start() - 16):m.start()].split()
            last = words[-1].lstrip("(\"'").casefold() if words else ""
            if last in _ABBREVIATIONS:
                continue
        spans.append((start, m.start()))
        start = m.end()
    spans.append((start, len(text)))
    return [(s, e) for s, e in spans if text[s:e].strip()]


def _quote(original: str, start: int, end: int, triggers: list[_Trigger]) -> str:
    segment = original[start:end]
    if len(segment) <= MAX_QUOTE_CHARS:
        return segment.strip()
    centre = (triggers[0].start - start) if triggers else 0
    lo = max(0, centre - MAX_QUOTE_CHARS // 2)
    hi = min(len(segment), lo + MAX_QUOTE_CHARS)
    while lo > 0 and not segment[lo - 1].isspace():
        lo += 1
    while hi < len(segment) and not segment[hi].isspace():
        hi -= 1
    return segment[lo:hi].strip()


def _dedupe(hits: list[Hit]) -> list[Hit]:
    seen: set[tuple] = set()
    unique: list[Hit] = []
    for h in hits:
        ref = h.reference
        key = (
            h.relation,
            ref.gr_number if ref else None,
            ref.issue_date if ref else None,
            h.page,
            h.quote if ref is None else None,
        )
        if key not in seen:
            seen.add(key)
            unique.append(h)
    return unique
