"""Corpus builder helpers: Gujarati text-quality score, portal listing parse, metadata override."""
from scripts.build_corpus import apply_listing, gujarati_score, parse_listing


def test_clean_gujarati_scores_higher_than_a_remapped_text_layer():
    clean = "શિસ્ત વિષયક કાર્યવાહી અંગે સામાન્ય વહીવટ વિભાગ ઠરાવ અને પરિપત્ર"
    garbled = "શળસ્ત શલ઴મક કામયલાશીના વંદબયભાં વાભાન્મ લશીલટ શલબાગ"
    assert gujarati_score(clean) > 0.3 > gujarati_score(garbled) == 0.0
    assert gujarati_score("English only") == 0.0


def test_listing_rows_are_keyed_by_decoded_url_basename(tmp_path):
    src = tmp_path / "SOURCES.txt"
    src.write_text(
        "FILE:    GAD\\circulars\\1963\\a b.pdf\n"
        "URL:     https://x/Document/A%20B.pdf\n"
        "ROW:     714 | G2 Branch | 06/02/1963 | CON1062/2961-C | To consult the Commission. | (275 KB)\n\n"
        "URL:     https://x/Document/bad.pdf\n"
        "ROW:     1 | G2 | 31/02/1963 |  | Endorsement | (1 KB)\n",
        encoding="utf-8")
    rows = parse_listing(src)
    assert rows["a b.pdf"] == {"date": "1963-02-06", "number": "CON1062/2961-C", "subject": "To consult the Commission"}
    assert rows["bad.pdf"] == {"date": None, "number": None, "subject": "Endorsement"}


def test_listing_overrides_only_fields_it_has():
    rec = {"issue_date": "1999-01-01", "gr_number": "No. X/1", "gr_number_norm": "X/1", "subject": None,
           "field_confidence": {"issue_date": 0.6, "gr_number": 0.5, "subject": 0.0}}
    assert apply_listing(rec, {"date": None, "number": "MLS/1363 /5421-C", "subject": "Endorsement"}) == "portal_listing"
    assert (rec["issue_date"], rec["gr_number_norm"], rec["subject"]) == ("1999-01-01", "MLS/1363/5421-C", "Endorsement")
    assert rec["field_confidence"] == {"issue_date": 0.6, "gr_number": 0.9, "subject": 0.95}
    assert apply_listing(rec, None) == "extracted"
