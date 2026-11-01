"""Evidence sheet for checking the gold lineage pairs against the document text.

Usage (from backend/):
    python -m scripts.gold_lineage_review --corpus D:/test/corpus_v1 --gold ../eval/gold_lineage_real.csv \
        --out ../eval/gold_lineage_review.csv

For every gold pair (amending GR -> base GR) it finds the sentence in the amending GR that names the base (the engine's own
evidence if it detected the pair, else the best text match) and writes page, verbatim quote and automatic checks. A person (or a
reviewer reading the quotes) then fills `verdict` / `reviewer`. The sheet is the audit trail; it does not decide anything alone.
"""
import argparse
import csv
import re
import sys
from pathlib import Path

from app.config import Settings
from app.lineage.normalize import normalize_text
from app.state import AppState

AMEND_WORDS = re.compile(r"\b(amend|amendment|substitut|insert|omit|repeal|supersed|in\s+supersession|replace|modif)", re.I)
STOP = set("the of and for to in a an rules rule gujarat civil services state government with by on under act".split())
COLUMNS = ["source_gr", "target_gr", "rel_type", "source_date", "target_date", "target_subject", "detected_by_engine",
           "evidence_page", "evidence_quote", "has_amend_wording", "names_base", "verdict", "reviewer", "note"]


def title_words(subject: str | None) -> list[str]:
    return [w for w in re.findall(r"[a-z]{4,}", (subject or "").lower()) if w not in STOP]


def names_base(text: str, subject: str | None, number: str | None) -> bool:
    """The quote mentions the base: its number, or at least 60% of the distinctive words of its title (OCR slips tolerated)."""
    norm = re.sub(r"[^0-9a-z]", "", normalize_text(text).lower())
    if number and len(re.sub(r"[^0-9a-z]", "", number.lower())) >= 6 and re.sub(r"[^0-9a-z]", "", number.lower()) in norm:
        return True
    words = title_words(subject)
    if not words:
        return False
    low = text.lower()
    return sum(w in low for w in words) / len(words) >= 0.6


def best_chunk(chunks, subject, number):
    """Chunk of the amending GR that best matches the base: names the base, mentions amending wording, earliest page."""
    scored = []
    for c in chunks:
        ok_base = names_base(c.text, subject, number)
        scored.append((ok_base, bool(AMEND_WORDS.search(c.text)), -c.page, c))
    scored.sort(key=lambda t: (t[0], t[1], t[2]), reverse=True)
    return scored[0][3] if scored and scored[0][0] else None


def quote_around(text: str, subject: str | None, limit: int = 420) -> str:
    """A verbatim window of the chunk centred on the amending wording, at most `limit` characters."""
    text = re.sub(r"\s+", " ", text).strip()
    m = AMEND_WORDS.search(text)
    start = max(0, (m.start() if m else 0) - 160)
    return text[start:start + limit]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus", type=Path, required=True)
    ap.add_argument("--gold", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    st = AppState.create(Settings(corpus_dir=args.corpus, embed_model="hash"), persist_vectors=False)
    edges = {}
    for e in st.lineage.edges():
        if e.target_gr and e.rel_type.value != "REFERS":
            edges.setdefault((e.source_gr, e.target_gr), e)
    rows = []
    with open(args.gold, encoding="utf-8", newline="") as f:
        for g in csv.DictReader(f):
            src, tgt = st.corpus.grs.get(g["source_gr"]), st.corpus.grs.get(g["target_gr"])
            row = {c: "" for c in COLUMNS}
            row.update(source_gr=g["source_gr"], target_gr=g["target_gr"], rel_type=g["rel_type"])
            if not src or not tgt:
                row["note"] = "document missing from corpus"
                rows.append(row)
                continue
            e = edges.get((src.gr_id, tgt.gr_id))
            chunk = st.corpus.chunk(e.evidence_chunk_id) if e and e.evidence_chunk_id else None
            chunk = chunk or best_chunk(src.chunks, tgt.subject, tgt.gr_number)
            row.update(source_date=src.issue_date, target_date=tgt.issue_date, target_subject=(tgt.subject or "")[:140],
                       detected_by_engine="yes" if e else "no")
            if chunk:
                row.update(evidence_page=chunk.page, evidence_quote=quote_around(chunk.text, tgt.subject),
                           has_amend_wording="yes" if AMEND_WORDS.search(chunk.text) else "no",
                           names_base="yes" if names_base(chunk.text, tgt.subject, tgt.gr_number) else "no")
            else:
                row["note"] = "no passage in the amending GR names the base"
            rows.append(row)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with open(args.out, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        w.writeheader()
        w.writerows(rows)
    n = len(rows)
    print(f"{n} pairs -> {args.out}")
    print("detected by engine:", sum(r["detected_by_engine"] == "yes" for r in rows),
          "| amend wording:", sum(r["has_amend_wording"] == "yes" for r in rows),
          "| names base:", sum(r["names_base"] == "yes" for r in rows),
          "| all three:", sum(r["detected_by_engine"] == "yes" and r["has_amend_wording"] == "yes" and r["names_base"] == "yes" for r in rows))
    return 0


if __name__ == "__main__":
    sys.exit(main())
