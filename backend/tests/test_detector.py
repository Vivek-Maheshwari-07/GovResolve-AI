from datetime import date

from app.detector import detect
from app.normalize import gr_key
from app.schemas import PageText, Relation


def run(text: str, page: int = 1):
    return detect([PageText(page=page, text=text)])


def test_supersedes_with_reference_after_trigger():
    hits = run("This Resolution supersedes GR No. GAD/2018/45 dated 20/05/2018.")
    assert len(hits) == 1
    h = hits[0]
    assert h.relation is Relation.SUPERSEDES
    assert gr_key(h.reference.gr_number) == gr_key("GAD/2018/45")
    assert h.reference.issue_date == date(2018, 5, 20)
    assert h.page == 1
    assert "supersedes" in h.quote


def test_partial_modification_is_amends():
    hits = run("In partial modification of GR No. GAD-2014-1 dated 12/03/2014, the following is added.")
    assert [h.relation for h in hits] == [Relation.AMENDS]


def test_cancels_with_reference_before_trigger():
    hits = run("Circular No. REV/77/2010 dated 01/01/2010 is hereby cancelled.")
    assert [h.relation for h in hits] == [Relation.CANCELS]
    assert hits[0].reference.issue_date == date(2010, 1, 1)


def test_replaces_in_place_of():
    hits = run("The following order is issued in place of GR No. FIN/5/2012.")
    assert [h.relation for h in hits] == [Relation.REPLACES]


def test_passive_amended_by_third_party_is_only_refers_to():
    hits = run("GR No. A/1/2010 as amended by GR No. B/2/2012 shall continue to apply.")
    assert {h.relation for h in hits} == {Relation.REFERS_TO}
    assert len(hits) == 2


def test_passive_by_this_resolution_is_active():
    hits = run("GR No. A/1/2010 is superseded by this Resolution.")
    assert [h.relation for h in hits] == [Relation.SUPERSEDES]


def test_as_amended_from_time_to_time_is_ignored():
    hits = run("Rules as amended from time to time apply, see GR No. A/1/2010.")
    assert [h.relation for h in hits] == [Relation.REFERS_TO]


def test_references_in_other_sentences_are_not_cross_assigned():
    hits = run("This GR amends GR No. A/1/2010. Earlier, GR No. B/2/2005 was issued.")
    by_gr = {gr_key(h.reference.gr_number): h.relation for h in hits}
    assert by_gr[gr_key("A/1/2010")] is Relation.AMENDS
    assert by_gr[gr_key("B/2/2005")] is Relation.REFERS_TO


def test_trigger_without_reference_is_reported_unresolved():
    hits = run("The above resolution is hereby cancelled.")
    assert len(hits) == 1
    assert hits[0].relation is Relation.CANCELS
    assert hits[0].reference is None


def test_date_only_reference_when_no_gr_number():
    hits = run("This order supersedes the Resolution dated 12/03/2014.")
    assert hits[0].relation is Relation.SUPERSEDES
    assert hits[0].reference.gr_number is None
    assert hits[0].reference.issue_date == date(2014, 3, 12)


def test_gujarati_cancel_with_gujarati_digits():
    hits = run("તા.૧૨/૦૩/૨૦૧૨ ના ઠરાવ ક્રમાંક: સમાન-૨૦૧૨-૯ ને રદ કરવામાં આવે છે.")
    assert [h.relation for h in hits] == [Relation.CANCELS]
    assert hits[0].reference.issue_date == date(2012, 3, 12)
    assert gr_key(hits[0].reference.gr_number) == gr_key("સમાન-2012-9")


def test_gujarati_supersede_and_quote_is_verbatim():
    text = "ઠરાવ ક્રમાંક: સમાન-૨૦૧૦-૫ તા.૦૧/૦૧/૨૦૧૦ અધિક્રમિત કરવામાં આવે છે."
    hits = run(text)
    assert [h.relation for h in hits] == [Relation.SUPERSEDES]
    assert hits[0].quote in text


def test_page_number_is_recorded():
    hits = run("This GR supersedes GR No. X/1/2000.", page=4)
    assert hits[0].page == 4


def test_duplicate_hits_collapsed():
    hits = detect(
        [
            PageText(page=1, text="This GR supersedes GR No. X/1/2000."),
            PageText(page=1, text="This GR supersedes GR No. X/1/2000."),
        ]
    )
    assert len(hits) == 1


def test_long_sentence_quote_is_capped_and_contains_trigger():
    filler = "word " * 300
    hits = run(f"{filler} supersedes GR No. X/1/2000 {filler}")
    assert len(hits[0].quote) <= 600
    assert "supersedes" in hits[0].quote
