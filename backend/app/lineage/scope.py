"""Step 5: how much of the target GR does the change cover?"""
import re

from ..schemas import RelType, Scope

_NUM = r"\d+(?:\s*\(\s*[a-z0-9]{1,4}\s*\))*"
_LIST = rf"({_NUM}(?:\s*(?:,|and|&|અને)\s*{_NUM})*)"
_SUBPARA = re.compile(r"sub-?\s*(?:para(?:graph)?|clause)\s*\(\s*([a-z0-9]+)\s*\)\s*of\s*(?:para(?:graph)?|clause)\s*(\d+)", re.I)
_PARA = re.compile(rf"\b(?:para(?:graph)?s?|clauses?|sub-?clauses?)\s*(?:no\.?\s*)?{_LIST}|(?:ફકરા|ફકરો|કલમ|પેરા)\s*(?:નં\.?\s*)?{_LIST}", re.I)
_ANNEX = re.compile(r"\b(annexure|schedule|appendix)[\s\-]*([A-Z0-9]{1,3})\b|(પરિશિષ્ટ)[\s\-]*([A-Z0-9]{1,3})", re.I)
_TOKEN = re.compile(_NUM)

WHOLE_BY_DEFAULT = {RelType.SUPERSEDES, RelType.CANCELS, RelType.RESTORES, RelType.REFERS}


def norm_label(s: str) -> str:
    return re.sub(r"\s+", "", s).lower()


def label_matches(chunk_label: str | None, targets: list[str]) -> bool:
    """Target '4' covers chunk labels 4, 4(a), 4.1; target '4(a)' covers 4(a) and 4(a)(i), but not 4."""
    if not chunk_label:
        return False
    lab = norm_label(chunk_label)
    for t in map(norm_label, targets):
        if lab == t or lab.startswith(t + "(") or lab.startswith(t + "."):
            return True
    return False


def parse_scope(sentence: str, rel: RelType) -> tuple[Scope, list[str]]:
    labels: list[str] = []
    text = sentence
    for m in _SUBPARA.finditer(sentence):
        labels.append(norm_label(f"{m[2]}({m[1]})"))
    text = _SUBPARA.sub(" ", text)
    for m in _ANNEX.finditer(text):
        name, ident = (m[1], m[2]) if m[1] else ("Annexure", m[4])
        labels.append(norm_label(f"{name.title()}-{ident}"))
    text = _ANNEX.sub(" ", text)
    para_labels: list[str] = []
    for m in _PARA.finditer(text):
        para_labels += [norm_label(t) for t in _TOKEN.findall(m.group(1) or m.group(2))]
    labels += para_labels
    labels = list(dict.fromkeys(labels))
    if labels:
        return (Scope.PARAGRAPH if all(re.fullmatch(r"\d+", x) for x in labels) else Scope.CLAUSE), labels
    return (Scope.WHOLE if rel in WHOLE_BY_DEFAULT else Scope.UNKNOWN), []
