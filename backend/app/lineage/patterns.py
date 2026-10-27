"""Step 2: relationship phrases, English and Gujarati.

[Guessing] Every Gujarati phrase is unconfirmed until it is seen in at least two real GAD GRs.
When you confirm one, add the GR ids to `confirmed_in`; phrases with an empty list are still unverified.
Matching runs on normalised, line-joined text, so every phrase allows any whitespace between words.
"""
import re
from dataclasses import dataclass, field

from ..schemas import RelType


@dataclass(frozen=True)
class Phrase:
    lang: str
    regex: re.Pattern
    confirmed_in: list[str] = field(default_factory=list)


def _p(lang: str, *patterns: str) -> list[Phrase]:
    return [Phrase(lang, re.compile(p.replace(" ", r"\s+"), re.I)) for p in patterns]


PATTERNS: dict[RelType, list[Phrase]] = {
    RelType.SUPERSEDES: _p("en", r"in supersession of", r"\bsupersedes?\b", r"stands? superseded",
                           r"hereby supersed(?:es|ed)", r"\bsuperseding\b")
    + _p("gu", "અધિક્રમણ કરીને", "ના અધિક્રમણમાં", "અધિક્રમિત"),
    RelType.CANCELS: _p("en", r"stands? cancell?ed", r"(?:is|are) hereby (?:withdrawn|cancell?ed|rescinded)",
                        r"\brescinded\b", r"ceases? to operate", r"hereby repealed")
    + _p("gu", "રદ કરવામાં આવે છે", "રદ ગણવો", "રદ ગણવા", "પરત ખેંચવામાં આવે છે", "રદબાતલ"),
    RelType.SUBSTITUTES: _p("en", r"shall be substituted", r"substituted by", r"for the words\b.{0,200}?\bread\b",
                            r"in place of")
    + _p("gu", "ને બદલે", "ના સ્થાને", "વાંચવું", "વાંચવા"),
    RelType.AMENDS: _p("en", r"(?:is|are|shall be) (?:hereby )?amended", r"amended as (?:under|follows|below)",
                       r"following amendment", r"hereby amend", r"(?:is|are) (?:hereby )?modified")
    + _p("gu", "સુધારો કરવામાં આવે છે", "નીચે મુજબ સુધારો", "સુધારો કરવામાં આવ્યો"),
    RelType.RESTORES: _p("en", r"(?:is|are) hereby restored", r"\brevived\b", r"\brestored\b")
    + _p("gu", r"પુન[ઃ:]?સ્થાપિત"),
    RelType.CLARIFIES: _p("en", r"it is (?:hereby )?clarified", r"\bclarification\b")
    + _p("gu", "સ્પષ્ટતા કરવામાં આવે છે", "સ્પષ્ટતા"),
    RelType.REFERS: _p("en", r"read with", r"with reference to", r"\bvide\b")
    + _p("gu", "સંદર્ભ", "વંચાણે લીધા"),
}

# One relationship per sentence: the first type in this order wins.
PRIORITY = [RelType.SUPERSEDES, RelType.CANCELS, RelType.SUBSTITUTES, RelType.AMENDS,
            RelType.RESTORES, RelType.CLARIFIES, RelType.REFERS]

CHANGING = {RelType.SUPERSEDES, RelType.AMENDS, RelType.SUBSTITUTES, RelType.CANCELS, RelType.RESTORES}

BLANKET = re.compile(
    r"all\s+(?:the\s+)?(?:earlier|previous|prior|existing|preceding)\s+(?:\w+\s+){0,3}?"
    r"(?:orders?|instructions?|resolutions?|circulars?|GRs?|notifications?)"
    r"|(?:અગાઉના|પૂર્વેના|ગત)\s+(?:\S+\s+){0,3}?(?:ઠરાવો|આદેશો|સૂચનાઓ|પરિપત્રો|હુકમો)",
    re.I,
)

# Section headings of a Gujarat GR: Read list -> preamble -> operative resolution.
SECTION_MARKER = re.compile(
    r"^\s*(?P<m>read|references?|reference\s+list|વંચાણે\s+લીધ\S*(?:\s+\S+){0,2}?|preamble|introduction|preface|"
    r"પ્રસ્તાવના|resolution|government\s+resolution|order|resolved|ઠરાવ|હુકમ|સરકારશ્રીનો\s+ઠરાવ)"
    r"\s*(?P<sep>[:ઃ][-–—]*|[-–—]+)?\s*(?P<rest>.*)$",
    re.I,
)
SECTION_OF = {"read": "read", "reference": "read", "references": "read", "reference list": "read",
              "preamble": "preamble", "introduction": "preamble", "preface": "preamble", "પ્રસ્તાવના": "preamble"}
NOW_THEREFORE = re.compile(r"^\s*now,?\s+therefore\b", re.I)


def section_for_marker(marker: str) -> str:
    m = re.sub(r"\s+", " ", marker.lower().strip())
    if m.startswith("વંચાણે"):
        return "read"
    return SECTION_OF.get(m, "operative")


def match_relation(sentence: str) -> tuple[RelType, str, str] | None:
    """(type, matched text, language) for the highest-priority phrase in the sentence, else None."""
    for rel in PRIORITY:
        for ph in PATTERNS[rel]:
            m = ph.regex.search(sentence)
            if m:
                return rel, m.group(0), ph.lang
    return None
