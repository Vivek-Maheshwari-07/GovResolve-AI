"""Step 4: match a reference to a GR in the corpus, with a confidence level."""
import re
from dataclasses import dataclass
from datetime import date

from ..schemas import Confidence, GRRecord
from ..store.corpus import Corpus
from .extract import ReadItem, Refs, extract_refs
from .normalize import gr_key, normalize_text

_STOP = {"the", "of", "for", "and", "to", "in", "on", "a", "an", "by", "with", "at", "ના", "નો", "ની", "માટે", "અંગે", "અને"}
_TITLE_STOP = {"the", "and", "for", "these", "may", "called"}
TITLE_COVERAGE = 0.85
BLANKET_THRESHOLD = 0.5
BLANKET_LIMIT = 5


@dataclass
class Target:
    gr_id: str | None  # None = broken link
    confidence: Confidence | None
    ref_text: str
    note: str = ""


def tokens(text: str | None) -> set[str]:
    return {t for t in re.findall(r"\w+", (text or "").lower()) if len(t) > 1 and t not in _STOP}


def subject_similarity(a: str | None, b: str | None) -> float:
    ta, tb = tokens(a), tokens(b)
    return len(ta & tb) / len(ta | tb) if ta and tb else 0.0


class Resolver:
    def __init__(self, corpus: Corpus):
        self.corpus = corpus
        self.by_key: dict[str, list[str]] = {}  # one printed number can belong to several years
        self.by_date: dict[date, list[str]] = {}
        # Base instruments by title words. Amendments and updated copies are not targets by title.
        self.titles: dict[str, frozenset[str]] = {}
        for g in corpus.grs.values():
            low = (g.subject or "").lower()
            words = frozenset(w for w in re.findall(r"[a-z]{3,}", low) if w not in _TITLE_STOP)
            if len(words) >= 5 and "amend" not in low and "updated" not in low.replace(" ", "") and "rule-" not in low:
                self.titles[g.gr_id] = words
        for g in corpus.grs.values():
            for k in (g.gr_number, g.gr_number_norm, g.gr_id):
                if k:
                    ids = self.by_key.setdefault(gr_key(k), [])
                    if g.gr_id not in ids:
                        ids.append(g.gr_id)
            if g.issue_date:
                self.by_date.setdefault(g.issue_date, []).append(g.gr_id)

    @property
    def departments(self) -> list[str]:
        return sorted({g.department for g in self.corpus.grs.values() if g.department})

    def match_title(self, sentence: str, source: GRRecord) -> list[str]:
        """Instruments the sentence names by title, e.g. 'further to amend the Gujarat Civil Services ... Rules, 1967'.
        Needs 85% of the title words (OCR drops some) and at least 5; the most specific title wins, earliest GR on a tie."""
        have = set(re.findall(r"[a-z]{3,}", sentence.lower()))
        best: list[tuple[int, date, str]] = []
        for gid, words in self.titles.items():
            g = self.corpus.grs[gid]
            if gid == source.gr_id or (g.issue_date and source.issue_date and g.issue_date >= source.issue_date):
                continue
            if len(words & have) / len(words) >= TITLE_COVERAGE:
                best.append((-len(words), g.issue_date or date.max, gid))
        if not best:
            return []
        best.sort()
        top = best[0][0]
        return [best[0][2]] if sum(1 for b in best if b[0] == top) >= 1 else []

    def _year_ok(self, gr_id: str, year: int | None) -> bool:
        """'KP/51 of 2014' must not resolve to a 'KP/51' issued in 2025. A number may be issued up to a year later."""
        d = self.corpus.grs[gr_id].issue_date
        return year is None or d is None or d.year in (year, year + 1)

    def _by_date(self, d: date, refs: Refs, source: GRRecord) -> Target | None:
        cands = [self.corpus.grs[i] for i in self.by_date.get(d, []) if i != source.gr_id]
        if not cands:
            return None
        hinted = [g for g in cands if g.department and g.department in refs.dept_hints]
        pool = hinted or cands
        if len(hinted) == 1:
            return Target(hinted[0].gr_id, Confidence.EXPLICIT, d.isoformat(), "date+department")
        best = max(pool, key=lambda g: subject_similarity(g.subject, source.subject))
        note = "date only" if len(pool) == 1 else f"date matches {len(pool)} GRs, closest subject"
        return Target(best.gr_id, Confidence.PROBABLE, d.isoformat(), note)

    def resolve(self, refs: Refs, source: GRRecord, read_items: list[ReadItem]) -> list[Target]:
        """Targets for the explicit references of one sentence (numbers, dates, 'Read (n)' pointers)."""
        targets: list[Target] = []
        unresolved: list[str] = []
        for num in refs.numbers:
            year = refs.number_years.get(num)
            gid = next((i for i in self.by_key.get(gr_key(num), []) if self._year_ok(i, year)), None)
            if gid is None:
                unresolved.append(num)
            elif gid != source.gr_id:
                targets.append(Target(gid, Confidence.EXPLICIT, num, "gr number"))
        for n in refs.pointers:
            item = next((i for i in read_items if i.number == n), None)
            if item is None:
                continue
            sub = extract_refs(normalize_text(item.text), set(), source.issue_date, self.departments)
            for t in self.resolve(sub, source, []):
                targets.append(Target(t.gr_id, t.confidence, f"Read ({n}): {t.ref_text}", t.note))
        if not targets and refs.titles:
            return [Target(i, Confidence.PROBABLE, "named instrument", "title match") for i in refs.titles]
        if targets:
            return targets + [Target(None, None, u, "not in corpus") for u in unresolved]
        by_date = [t for d in refs.dates if (t := self._by_date(d, refs, source))]
        if by_date:  # number missing or garbled by OCR: fall back to date (+ subject)
            return by_date
        if unresolved:
            return [Target(None, None, u, "not in corpus") for u in unresolved]
        return [Target(None, None, refs.dates[0].isoformat(), "no GR with this date")] if refs.dates else []

    def blanket(self, source: GRRecord) -> list[Target]:
        """'All earlier orders on this subject': same-department earlier GRs with a similar subject."""
        scored = []
        for g in self.corpus.grs.values():
            if g.gr_id == source.gr_id or (g.issue_date and source.issue_date and g.issue_date >= source.issue_date):
                continue
            if g.department and source.department and g.department != source.department:
                continue
            sim = subject_similarity(g.subject, source.subject)
            if sim >= BLANKET_THRESHOLD:
                scored.append((sim, g))
        scored.sort(key=lambda x: (-x[0], x[1].issue_date or date.min))
        return [Target(g.gr_id, Confidence.PROBABLE, "all earlier orders", f"subject similarity {s:.2f}")
                for s, g in scored[:BLANKET_LIMIT]]
