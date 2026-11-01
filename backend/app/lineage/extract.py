"""Steps 2-3: split a GR into sections, find relationship sentences, pull out the target reference."""
import re
from dataclasses import dataclass, field
from datetime import date

from ..schemas import GRRecord, RelType
from .normalize import find_dates, gr_key, join_lines, normalize_text
from .patterns import BLANKET, NOW_THEREFORE, SECTION_MARKER, match_relation, section_for_marker
from .scope import parse_scope
from ..schemas import Scope

# [Guessing] Printed GR-number formats vary by department and year; this is a generic shape
# (letters, then separator-joined parts, at least one digit). Rebuild it from ~20 real numbers.
_NUMBER = re.compile(r"(?<![\w/])([A-Zઅ-હ][A-Z઀-૿0-9]*(?:[-/][A-Z઀-૿0-9()]+)+)")
_GR_NOUN = re.compile(r"\b(?:GRs?|G\.R\.|resolutions?|orders?|circulars?|notifications?|instructions?)\b|ઠરાવ|પરિપત્ર|આદેશ|હુકમ|સૂચના", re.I)
_WEF = re.compile(r"(?:w\.?\s*e\.?\s*f\.?|with\s+effect\s+from|effective\s+from)\s*[:\-]?\s*$", re.I)
_POINTERS = [
    re.compile(r"\bread\s+(?:at\s+)?(?:(?:sr\.?\s*)?no\.?\s*)?\(\s*(\d{1,2})\s*\)", re.I),
    re.compile(r"\bread\s+at\s+(?:sr\.?\s*)?(?:no\.?\s*)?(\d{1,2})\b", re.I),
    re.compile(r"વંચાણે\s+લીધેલ\s*\(?\s*(\d{1,2})\s*\)?"),
]
_ITEM = re.compile(r"^\s*\(?(\d{1,2})[\).:]\s*(.*)$")
_ABBREV = re.compile(r"\b(No|Nos|Rs|Dr|Sr|Shri|Smt|Dept|Govt|Dt|dt|Sec|Ref|Vide|Mr|Mrs|Ms|Co|Ltd|St|etc|viz)\.")
_SPLIT = re.compile(r"(?<=[.!?।])\s+(?=[A-Zઅ-હ\"'“‘])|(?<=[:;])\s+")


@dataclass
class Refs:
    numbers: list[str] = field(default_factory=list)
    number_years: dict[str, int] = field(default_factory=dict)  # "KP/51" -> 2014 when the text says "KP/51 of 2014"
    dates: list[date] = field(default_factory=list)
    pointers: list[int] = field(default_factory=list)
    dept_hints: list[str] = field(default_factory=list)
    blanket: bool = False
    eff_date: date | None = None
    titles: list[str] = field(default_factory=list)  # gr_ids of instruments named by title ("... Rules, 1967")

    def has_target(self) -> bool:
        return bool(self.numbers or self.dates or self.pointers or self.blanket or self.titles)


@dataclass
class Candidate:
    source_gr: str
    chunk_id: str
    rel: RelType | None  # None = reference with no phrase match (LLM fallback / manual review)
    phrase: str | None
    lang: str | None
    sentence: str  # evidence text (may include the previous sentence)
    refs: Refs
    scope: Scope = Scope.UNKNOWN
    clauses: list[str] = field(default_factory=list)
    before: str = ""
    after: str = ""


@dataclass
class ReadItem:
    number: int
    text: str
    chunk_id: str


@dataclass
class Segment:
    section: str
    lines: list[str]
    chunk_id: str


@dataclass
class Extraction:
    candidates: list[Candidate] = field(default_factory=list)
    read_items: list[ReadItem] = field(default_factory=list)
    review: list[dict] = field(default_factory=list)


def split_sentences(text: str) -> list[str]:
    text = _ABBREV.sub(lambda m: m.group(0)[:-1] + "\u0001", text)
    return [s.replace("\u0001", ".").strip() for s in _SPLIT.split(text) if s.strip()]


def _is_heading(m: re.Match) -> bool:
    """'Read:' / 'Resolution' alone on a line is a heading; 'Order issued today' is not."""
    sep = m.group("sep") or ""
    return ":" in sep or "ઃ" in sep or not m.group("rest").strip()


def split_segments(gr: GRRecord) -> list[Segment]:
    """Cut each chunk at Read / Preamble / Resolution headings, carrying the section across chunks."""
    segments: list[Segment] = []
    running = "operative"  # no headings at all -> everything counts as operative
    for chunk in gr.chunks:
        state = chunk.section if chunk.section != "other" else running
        current = Segment(state, [], chunk.chunk_id)
        for line in normalize_text(chunk.text).split("\n"):
            m = SECTION_MARKER.match(line)
            if m and _is_heading(m):
                new_state, rest = section_for_marker(m.group("m")), m.group("rest")
            elif NOW_THEREFORE.match(line):
                new_state, rest = "operative", line
            else:
                new_state, rest = state, line
            if new_state != state:
                if current.lines:
                    segments.append(current)
                state = new_state
                current = Segment(state, [], chunk.chunk_id)
            if rest.strip():
                current.lines.append(rest)
        if current.lines:
            segments.append(current)
        running = state
    return segments


def parse_read_items(segments: list[Segment]) -> list[ReadItem]:
    items: list[ReadItem] = []
    plain: list[tuple[str, str]] = []
    for seg in segments:
        if seg.section != "read":
            continue
        cur = None
        for line in seg.lines:
            m = _ITEM.match(line)
            if m:
                cur = ReadItem(int(m.group(1)), m.group(2).strip(), seg.chunk_id)
                items.append(cur)
            elif cur and line.strip():
                cur.text += " " + line.strip()
            elif line.strip():
                plain.append((line.strip(), seg.chunk_id))
    if not items:  # unnumbered list: number the lines in order
        items = [ReadItem(i, t, c) for i, (t, c) in enumerate(plain, 1)]
    return items


_YEAR_AFTER = re.compile(r"\s+of\s+((?:19|20)\d{2})(?!\d)", re.I)


def _is_own(key: str, own_keys: set[str]) -> bool:
    """A printed number is our own when it equals one of ours or is a prefix of / extends one
    (the number pattern stops at lowercase parts such as '/e-file/', so the header number comes out shorter)."""
    return any(key == k or (len(key) >= 8 and len(k) >= 8 and (k.startswith(key) or key.startswith(k)))
               for k in own_keys)


_NO_BEFORE = re.compile(r"\bno['.\s]*$", re.I)
_LEADER = re.compile(r"^[^:]{0,90}:\s*[-–—]")


def _is_header_number(text: str, m: re.Match) -> bool:
    """'No. KP/51 of 2014 ...:- In exercise of ...' opens the notification: it names the document itself,
    even when OCR garbles the rest of the number so it no longer matches ours."""
    return bool(_NO_BEFORE.search(text[max(0, m.start() - 8):m.start()]) and _LEADER.match(text[m.end():])
                and ". " not in text[m.end():][:90].split(":")[0])


def extract_refs(text: str, own_keys: set[str], issue_date: date | None, departments: list[str]) -> Refs:
    """Everything in one sentence that can point at another GR. `text` must be normalised."""
    refs = Refs()
    seen = set()
    for m in _NUMBER.finditer(text):
        num = m.group(1)
        if re.search(r"\d", num) and not _is_own(gr_key(num), own_keys) and not _is_header_number(text, m) and num not in seen:
            seen.add(num)
            refs.numbers.append(num)
            y = _YEAR_AFTER.match(text, m.end())
            if y:
                refs.number_years[num] = int(y.group(1))
    has_noun = bool(_GR_NOUN.search(text))
    for h in find_dates(text):
        if _WEF.search(text[max(0, h.start - 40):h.start]):
            refs.eff_date = refs.eff_date or h.value
        elif has_noun and (issue_date is None or h.value <= issue_date) and h.value not in refs.dates:
            refs.dates.append(h.value)
    for rx in _POINTERS:
        refs.pointers += [int(x) for x in rx.findall(text) if int(x) not in refs.pointers]
    low = text.lower()
    refs.dept_hints = [d for d in departments if d and d.lower() in low]
    refs.blanket = bool(BLANKET.search(text))
    return refs


def extract_gr(gr: GRRecord, departments: list[str], match_title=None) -> Extraction:
    """`match_title(sentence)` returns gr_ids of instruments the sentence names by title (Resolver.match_title)."""
    out = Extraction()
    segments = split_segments(gr)
    out.read_items = parse_read_items(segments)
    own = {gr_key(x) for x in (gr.gr_number, gr.gr_number_norm, gr.gr_id) if x}
    for seg in segments:
        if seg.section != "operative":
            continue
        sentences = split_sentences(join_lines(" ".join(seg.lines)))
        parsed = [(s, match_relation(s), extract_refs(s, own, gr.issue_date, departments)) for s in sentences]
        if match_title:
            for k, (s, rel, refs) in enumerate(parsed):  # "further to amend the X Rules, 1967": a title, no GR number
                if rel and rel[0] != RelType.REFERS and not refs.has_target():
                    # a title can straddle a sentence break (OCR turns "Services :" into a split), so look at the neighbours
                    refs.titles = match_title(" ".join(sentences[max(0, k - 1):k + 2]), gr)
        for i, (sent, rel, refs) in enumerate(parsed):
            before = sentences[i - 1] if i else ""
            after = sentences[i + 1] if i + 1 < len(sentences) else ""
            evidence = sent
            if rel and not refs.has_target() and i and parsed[i - 1][1] is None and parsed[i - 1][2].has_target():
                refs, evidence = parsed[i - 1][2], f"{parsed[i - 1][0]} {sent}"  # split phrasing
                if out.candidates and out.candidates[-1].rel is None and out.candidates[-1].sentence == parsed[i - 1][0]:
                    out.candidates.pop()  # that reference sentence is now explained; do not also send it to the LLM
            if rel is None:
                if refs.has_target() and not refs.blanket:
                    out.candidates.append(Candidate(gr.gr_id, seg.chunk_id, None, None, None, sent, refs,
                                                    before=before, after=after))
                continue
            rtype, phrase, lang = rel
            if not refs.has_target():
                if rtype != RelType.REFERS:
                    out.review.append({"gr_id": gr.gr_id, "chunk_id": seg.chunk_id, "kind": "no_usable_target",
                                       "sentence": sent})
                continue
            scope, clauses = parse_scope(evidence, rtype)
            out.candidates.append(Candidate(gr.gr_id, seg.chunk_id, rtype, phrase, lang, evidence, refs,
                                            scope, clauses, before, after))
    return out
