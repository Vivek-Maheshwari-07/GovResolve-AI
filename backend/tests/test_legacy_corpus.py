"""data/processed holds records in the ingestion format; the corpus loader must read them."""
from pathlib import Path

from app.store.corpus import Corpus, from_legacy

ROOT = Path(__file__).resolve().parents[2]


def legacy(**kw):
    rec = {"gr_id": "X-1", "gr_number": "UNKNOWN", "department": "D", "issue_date": "2020-01-02", "language": "gu",
           "file_path": "C:/Users/a/b/file.pdf", "metadata_confidence": 0.9,
           "pages": [{"page_number": 1, "source_type": "scanned", "ocr_confidence": 0.8}, {"page_number": 2, "source_type": "digital"}],
           "chunks": [{"chunk_id": "X-1_p2_c0", "text": "t", "pages": [2], "bboxes": [{"x0": 1, "y0": 2, "x1": 3, "y1": 4, "page": 2}],
                       "section_ref": "3"}]}
    rec.update(kw)
    return rec


def test_legacy_record_is_converted():
    out = from_legacy(legacy())
    assert out["gr_number"] is None and out["source_pdf"] == "file.pdf" and out["page_count"] == 2
    assert out["chunks"][0]["page"] == 2 and out["chunks"][0]["bbox"] == {"x0": 1, "y0": 2, "x1": 3, "y1": 4}
    assert out["field_confidence"]["text"] == 0.8


def test_corpus_format_is_left_alone():
    rec = {"gr_id": "A", "chunks": [{"chunk_id": "A:1", "page": 1, "text": "x"}]}
    assert from_legacy(rec) is rec


def test_every_processed_record_loads():
    corpus = Corpus.load(ROOT / "data" / "processed")
    assert corpus.errors == [] and len(corpus.grs) == len(list((ROOT / "data" / "processed").glob("*.json")))
    assert all(c.page >= 1 for c in corpus.all_chunks())
