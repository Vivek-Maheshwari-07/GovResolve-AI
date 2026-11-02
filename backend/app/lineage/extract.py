"""Steps 2-3: split a GR into sections, find relationship sentences, pull out the target reference."""
import re
from dataclasses import dataclass, field
from datetime import date

from ..schemas import GRRecord, RelType
from .normalize import find_dates, gr_key, join_lines, normalize_text
from .patterns import BLANKET, CHANGING, NOW_THEREFORE, SECTION_MARKER, match_relation, section_for_marker
from .scope import parse_scope
from ..schemas import Scope

# [Guessing] Printed GR-number formats vary by department and year; this is a generic shape
# (letters, then separator-joined parts, at least one digit). Rebuild it from ~20 real numbers.
_NUMBER = re.compile(r"(?<![\w/])([A-Zઅ-હ][A-Z઀-૿0-9]*(?:[-/][A-Z઀-૿0-9()]+)+)")
_GR_NOUN = re.compile(r"\b(?:GRs?|G\.R\.|resolutions?|orders?|circulars?|notifications?|instructions?)\b|ઠરાવ|પરિપત્ર|આદેશ|હુકમ|સૂચના|પત્ર|પત્રાંક", re.I)
_WEF = re.compile(r"(?:w\.?\s*e\.?\s*f\.?|with\s+effect\s+from|effective\s+from)\s*[:\-]?\s*$", re.I)
_POINTERS = [
    re.compile(r"\bread\s+(?:at\s+)?(?:(?:sr\.?\s*)?no\.?\s*)?\(\s*(\d{1,2})\s*\)", re.I),
    re.compile(r"\bread\s+at\s+(?:sr\.?\s*)?(?:no\.?\s*)?(\d{1,2})\b", re.I),
    re.compile(r"વંચાણે\s+લીધેલ\s*\(?\s*(\d{1,2})\s*\)?"),
]
_ITEM = re.compile(r"^\s*\(?([0-9]{1,2}|[૧-૯૦-૯]|ર|પ)[\).:]\s*(.*)$")
_ABBREV = re.compile(r"\b(No|Nos|Rs|Dr|Sr|Shri|Smt|Dept|Govt|Dt|dt|Sec|Ref|Vide|Mr|Mrs|Ms|Co|Ltd|St|etc|viz|તા|નં|ક્ર)\.")
_SPLIT = re.compile(r"(?<=[.!?।])\s+(?=[A-Zઅ-હ\"'“‘])|(?<=[:;])\s+")

_GU_DIGIT_MAP = {"૦": 0, "૧": 1, "૨": 2, "૩": 3, "૪": 4, "૫": 5, "૬": 6, "૭": 7, "૮": 8, "૯": 9, "ર": 2, "પ": 5}


def _parse_gu_item_num(s: str) -> int:
    s = s.strip()
    if s.isdigit():
        return int(s)
    val = 0
    for ch in s:
        if ch in _GU_DIGIT_MAP:
            val = val * 10 + _GU_DIGIT_MAP[ch]
        elif ch.isdigit():
            val = val * 10 + int(ch)
        else:
            return 0
    return val


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
    all_read_items: bool = False

    def has_target(self) -> bool:
        return bool(self.numbers or self.dates or self.pointers or self.blanket or self.titles or self.all_read_items)


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
    return ":" in sep or "ઃ" in sep or "-" in sep or not m.group("rest").strip()


_INLINE_HEADING = re.compile(
    r"(?<=\S)\s+(?=(?:વંચાણે|વંચાણમાં)\s+લીધ|(?:આમુખ|પ્રસ્તાવના)\s*[:ઃ\-–—.]|(?:ઠરાવ|હુકમ|સરકારશ્રીનો\s+ઠરાવ|પરિપત્ર)\s*[:ઃ\-–—.])",
    re.I,
)
_INLINE_ITEM = re.compile(
    r"(?<=\S)\s+(?=\((?:[0-9]{1,2}|[૧-૯૦-૯]|ર|પ)\)[\s.:\-–—]|\b(?:[0-9]{1,2}|[૧-૯૦-૯])\s*[\).:])"
)


def split_segments(gr: GRRecord) -> list[Segment]:
    """Cut each chunk at Read / Preamble / Resolution headings, carrying the section across chunks."""
    segments: list[Segment] = []
    running = "operative"  # no headings at all -> everything counts as operative
    for chunk in gr.chunks:
        raw = normalize_text(chunk.text)
        raw = _INLINE_HEADING.sub("\n", raw)
        raw = re.sub(r"\(\s*ર\s*\)", "(2)", raw)
        raw = re.sub(r"\(\s*પ\s*\)", "(5)", raw)
        raw = _INLINE_ITEM.sub("\n", raw)
        state = chunk.section if chunk.section != "other" else running
        current = Segment(state, [], chunk.chunk_id)
        for line in raw.split("\n"):
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
                num = _parse_gu_item_num(m.group(1)) or (len(items) + 1)
                cur = ReadItem(num, m.group(2).strip(), seg.chunk_id)
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


_ALL_READ_ITEMS = re.compile(
    r"(?:ઉપર\s+)?વંચાણે\s+લીધેલ\s+તમામ|વંચાણે\s+લીધેલ\s+બધા|તમામ\s+(?:ઉક્ત\s+)?(?:ઠરાવો|પરિપત્રો|પત્રો)",
    re.I,
)


def _extract_gujarati_pointers(text: str) -> tuple[list[int], bool]:
    pointers: list[int] = []
    all_items = bool(_ALL_READ_ITEMS.search(text))
    # 1. Range: ક્રમાંક (૧) થી (૩) or સંદર્ભ ૧ થી ૩
    for m in re.finditer(r"(?:ક્રમાંક|ક્રમ|સંદર્ભ)\s*\(?\s*([0-9૧-૯રપ]{1,2})\s*\)?\s*થી\s*\(?\s*([0-9૧-૯રપ]{1,2})\s*\)?", text):
        a = _parse_gu_item_num(m.group(1))
        b = _parse_gu_item_num(m.group(2))
        if a and b and 1 <= a <= b <= 30:
            pointers.extend(range(a, b + 1))

    # 2. Lists and individual pointers: સંદર્ભ (૧), (૨), અને (૬) or ક્રમ-૩ અને ૪ or સંદર્ભ (૨)
    for m in re.finditer(r"(?:સંદર્ભ|ક્રમાંક|ક્રમ|વંચાણે\s+લીધ\S*)\s*[:\-–]?\s*((?:\(?[0-9૧-૯રપ]{1,2}\)?[\s,/-]*(?:અને|તથા)?\s*)+)", text):
        for num_match in re.finditer(r"\(?\s*([0-9૧-૯રપ]{1,2})\s*\)?", m.group(1)):
            n = _parse_gu_item_num(num_match.group(1))
            if n and 1 <= n <= 30 and n not in pointers:
                pointers.append(n)
    return pointers, all_items


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
    gu_ptrs, all_items = _extract_gujarati_pointers(text)
    for p in gu_ptrs:
        if p not in refs.pointers:
            refs.pointers.append(p)
    if all_items:
        refs.all_read_items = True
    low = text.lower()
    refs.dept_hints = [d for d in departments if d and d.lower() in low]
    refs.blanket = bool(BLANKET.search(text))
    return refs


_ENACTING = re.compile(r"in\s+exercise\s+of\s+the\s+powers", re.I)
TITLE_REACH = 300  # characters after the relation phrase in which the amended instrument is named


def _after_enacting_words(sentence: str) -> str:
    """A rule-making notification opens '<its own number> :- In exercise of the powers ...'. Whatever precedes
    those words is the document's own number (OCR often breaks it so our own-number check misses), never a target."""
    m = _ENACTING.search(sentence)
    return sentence[m.start():] if m else sentence


_ALL_RULES = re.compile(r"\s*(?:of\s+)?all\s+(?:the\s+)?(?:\w+\s+){0,2}?(?:rules|orders|instructions)\b", re.I)


def _names_no_instrument(sentence: str, phrase: str) -> bool:
    """'in supersession of all the rules made in this behalf' replaces whatever exists; it names nothing to match."""
    at = sentence.lower().find(phrase.lower())
    return at >= 0 and bool(_ALL_RULES.match(sentence[at + len(phrase):]))


def _title_window(sentences: list[str], k: int, phrase: str) -> str:
    """Text in which the instrument acted on is named: the sentence up to the relation phrase ('In the X Rules, 1967,
    ... shall be substituted') plus what follows it ('further to amend the X Rules, 1967'). Not the sentence before:
    that is where unrelated instruments are cited."""
    s = sentences[k]
    at = s.lower().find(phrase.lower())
    at = max(at, 0)
    tail = s[at:]
    for nxt in sentences[k + 1:]:
        if len(tail) >= TITLE_REACH:
            break
        tail += " " + nxt
    lead, j = s[:at], k - 1
    # the sentence splitter also cuts at ':' and ';', which OCR sprinkles into titles: step back over those cuts only
    while j >= 0 and k - j <= 2 and not sentences[j].rstrip().endswith((".", "।", "?", "!")):
        lead = sentences[j] + " " + lead
        j -= 1
    return lead + tail[:TITLE_REACH]


def extract_gr(gr: GRRecord, departments: list[str], match_title=None) -> Extraction:
    """`match_title(sentence)` returns gr_ids of instruments the sentence names by title (Resolver.match_title)."""
    out = Extraction()
    segments = split_segments(gr)
    out.read_items = parse_read_items(segments)
    own = {gr_key(x) for x in (gr.gr_number, gr.gr_number_norm, gr.gr_id) if x}
    for seg in segments:
        if seg.section not in ("operative", "preamble"):
            continue
        sentences = split_sentences(join_lines(" ".join(seg.lines)))
        parsed = [(s, match_relation(s), extract_refs(_after_enacting_words(s), own, gr.issue_date, departments))
                  for s in sentences]
        if match_title:
            for k, (s, rel, refs) in enumerate(parsed):  # "further to amend the X Rules, 1967": a title, no GR number
                if (rel and rel[0] != RelType.REFERS and not refs.has_target()
                        and not _names_no_instrument(s, rel[1])):
                    refs.titles = match_title(_title_window(sentences, k, rel[1]), gr)
        for i, (sent, rel, refs) in enumerate(parsed):
            # In preamble, only explicit changing relations create candidates
            if seg.section == "preamble" and (rel is None or rel[0] not in CHANGING):
                continue
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
