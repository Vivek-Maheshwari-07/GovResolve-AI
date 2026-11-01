"""Every relationship type in both languages, the Read-list trap, scope, sections and sentence splitting."""
import pytest

from app.lineage.extract import extract_gr, split_sentences, split_segments
from app.lineage.patterns import match_relation
from app.lineage.scope import label_matches, parse_scope
from app.schemas import Chunk, GRRecord, RelType, Scope

R = RelType


@pytest.mark.parametrize("sentence,rel", [
    ("In supersession of GR A/1/1 the rate is Rs. 5.", R.SUPERSEDES),
    ("GR A/1/1 stands superseded.", R.SUPERSEDES),
    ("ઠરાવ ક્રમાંક ખેતી-૨૦૧૨-૦૩ ના અધિક્રમણમાં સહાય મળશે.", R.SUPERSEDES),
    ("આ ઠરાવ અધિક્રમણ કરીને નવો ઠરાવ કરવામાં આવે છે.", R.SUPERSEDES),
    ("Para 4 of GR A/1/1 is hereby amended.", R.AMENDS),
    ("GR A/1/1 is amended as under:", R.AMENDS),
    ("ઠરાવમાં નીચે મુજબ સુધારો કરવામાં આવે છે.", R.AMENDS),
    ("ફકરા ૪ માં સુધારો કરવામાં આવે છે.", R.AMENDS),
    ("The amount shall be substituted by Rs. 500.", R.SUBSTITUTES),
    ("For the words 'Rs. 200' in para 2, read 'Rs. 350'.", R.SUBSTITUTES),
    ("રૂ. ૨૦૦ ને બદલે રૂ. ૩૫૦ વાંચવું.", R.SUBSTITUTES),
    ("GR A/1/1 stands cancelled.", R.CANCELS),
    ("GR A/1/1 is hereby withdrawn.", R.CANCELS),
    ("ઠરાવ રદ કરવામાં આવે છે.", R.CANCELS),
    ("ઠરાવ પરત ખેંચવામાં આવે છે.", R.CANCELS),
    ("It is clarified that GR A/1/1 applies to all.", R.CLARIFIES),
    ("સ્પષ્ટતા કરવામાં આવે છે કે ઠરાવ લાગુ પડશે.", R.CLARIFIES),
    ("GR A/1/1 is hereby restored.", R.RESTORES),
    ("ઠરાવ પુનઃસ્થાપિત કરવામાં આવે છે.", R.RESTORES),
    ("This GR is to be read with GR A/1/1.", R.REFERS),
    ("With reference to GR A/1/1, the following.", R.REFERS),
    ("સંદર્ભ ઠરાવ મુજબ કાર્યવાહી થશે.", R.REFERS),
])
def test_relationship_phrases(sentence, rel):
    assert match_relation(sentence)[0] == rel


def test_phrases_allow_ocr_whitespace():
    assert match_relation("in   supersession\n of GR")[0] == R.SUPERSEDES


def test_no_phrase_no_match():
    assert match_relation("The allowance is Rs. 200 per day.") is None


def _gr(*chunks, **kw) -> GRRecord:
    cs = [Chunk(chunk_id=f"X:{i}", page=1, text=t, section=s, clause_label=c) for i, (c, s, t) in enumerate(chunks, 1)]
    return GRRecord(gr_id="X", gr_number="X/2020/01", chunks=cs, **kw)


def test_phrase_in_read_list_gives_no_change_edge():
    gr = _gr((None, "read", "Read:\n(1) GR A/1/1 dated 01/01/2010, amended as under."),
             ("1", "operative", "Government sanctions an additional grant."))
    ex = extract_gr(gr, [])
    assert ex.candidates == [] and ex.read_items[0].number == 1 and "A/1/1" in ex.read_items[0].text


def test_sections_inferred_from_headings():
    gr = _gr((None, "other", "Read:\n(1) GR A/1/1\nPreamble:\nBackground text.\nResolution:\nGR A/1/1 stands cancelled."))
    assert [s.section for s in split_segments(gr)] == ["read", "preamble", "operative"]
    assert [c.rel for c in extract_gr(gr, []).candidates] == [R.CANCELS]


def test_gujarati_section_headings():
    gr = _gr((None, "other", "વંચાણે લીધા:\n(૧) ઠરાવ ખેતી-૨૦૧૨-૦૩\nઠરાવ:\nખેતી-૨૦૧૨-૦૩ રદ કરવામાં આવે છે."))
    assert [s.section for s in split_segments(gr)] == ["read", "operative"]


def test_headingless_gr_is_all_operative():
    ex = extract_gr(_gr(("1", "other", "GR A/1/1 stands cancelled.")), [])
    assert len(ex.candidates) == 1


def test_read_pointer_extracted():
    ex = extract_gr(_gr((None, "other", "Read:\n(2) GR A/1/1\nResolution:\nThe GR at Read (2) above is amended as under:")), [])
    assert ex.candidates[0].refs.pointers == [2]


def test_split_phrasing_uses_previous_sentence_refs():
    ex = extract_gr(_gr(("1", "operative", "Reference is made to GR A/1/1 dated 01/01/2010. The said GR is hereby amended.")), [])
    assert ex.candidates[0].rel == R.AMENDS and ex.candidates[0].refs.numbers == ["A/1/1"]


def test_no_target_is_logged_for_review_not_an_edge():
    ex = extract_gr(_gr(("1", "operative", "The earlier order is hereby amended.")), [])
    assert ex.candidates == [] and ex.review[0]["kind"] == "no_usable_target"


def test_wef_date_is_effective_date_not_reference():
    ex = extract_gr(_gr(("1", "operative", "GR A/1/1 stands cancelled w.e.f. 01/04/2020."), issue_date="2020-03-01"), [])
    refs = ex.candidates[0].refs
    assert refs.eff_date.isoformat() == "2020-04-01" and refs.dates == []


def test_blanket_phrase_detected():
    ex = extract_gr(_gr(("1", "operative", "All earlier orders on this subject stand cancelled.")), [])
    assert ex.candidates[0].refs.blanket


def test_sentence_split_keeps_abbreviations_and_dates():
    s = split_sentences("GR No. GAD/1/1 dated 12.05.2014 gives Rs. 500 to staff. Next sentence here.")
    assert len(s) == 2 and s[0].startswith("GR No. GAD/1/1")


@pytest.mark.parametrize("sentence,rel,scope,clauses", [
    ("In supersession of GR A/1/1", R.SUPERSEDES, Scope.WHOLE, []),
    ("Para 4 of GR A/1/1 is amended", R.AMENDS, Scope.PARAGRAPH, ["4"]),
    ("Paras 3 and 5 of GR A/1/1 are amended", R.AMENDS, Scope.PARAGRAPH, ["3", "5"]),
    ("Clause 4(a) of GR A/1/1 is amended", R.AMENDS, Scope.CLAUSE, ["4(a)"]),
    ("Sub-para (ii) of para 3 is amended", R.AMENDS, Scope.CLAUSE, ["3(ii)"]),
    ("Annexure-A is replaced", R.SUBSTITUTES, Scope.CLAUSE, ["annexure-a"]),
    ("ફકરા 2 માં સુધારો", R.AMENDS, Scope.PARAGRAPH, ["2"]),
    ("GR A/1/1 is amended", R.AMENDS, Scope.UNKNOWN, []),
])
def test_scope(sentence, rel, scope, clauses):
    assert parse_scope(sentence, rel) == (scope, clauses)


def test_clause_label_matching():
    assert label_matches("4", ["4"]) and label_matches("4(a)", ["4"]) and label_matches("4.1", ["4"])
    assert label_matches("4(a)(i)", ["4(a)"]) and label_matches("4 (a)", ["4(a)"])
    assert not label_matches("4", ["4(a)"]) and not label_matches("14", ["4"]) and not label_matches(None, ["4"])


def test_year_after_number_and_own_number_prefix():
    from app.lineage.extract import extract_refs
    own = {"GU/2025/20/IMD/WRT/E-FILE/9/2025/0586/J".replace("/", "").upper()}
    text = "No. GU/2025/20/IMD/WRT: in supersession of KP/51 of 2014 and GU/2016/38/MIS/102016/395/D."
    refs = extract_refs(text, own, None, [])
    assert "GU/2025/20/IMD/WRT" not in refs.numbers
    assert refs.number_years.get("KP/51") == 2014
    assert "GU/2016/38/MIS/102016/395/D" in refs.numbers


def test_header_number_before_leader_is_the_document_itself():
    from app.lineage.extract import extract_refs
    text = "No' KP/51 of 2014tELCll020tOtl43(1)/G:- In exercise of the powers, in supersession of KP/09 of 2010."
    refs = extract_refs(text, set(), None, [])
    assert "KP/51" not in refs.numbers
    assert "KP/09" in refs.numbers


def test_further_to_amend_survives_ocr_slips():
    from app.lineage.patterns import match_relation
    for text in ("rules fur:her to amend the", "rules further 1o amend the", "rules further to- amend the",
                 "rules further to amerd the"):
        rel = match_relation(text)
        assert rel and rel[0].value == "AMENDS", text
    assert match_relation("the committee will further consider the proposal") is None


def test_title_window_keeps_text_after_the_phrase_but_not_the_previous_sentence():
    from app.lineage.extract import _title_window
    sents = ["It cites the Gujarat Civil Services Classification and Recruitment (General) Rules, 1967.",
             "The Governor makes rules further to amend the Clerk Recruitment Rules,",
             "2013, namely:-"]
    win = _title_window(sents, 1, "further to amend")
    assert "Clerk Recruitment" in win and "2013" in win and "Classification" not in win


def test_merge_continuations_joins_blocks_split_mid_sentence():
    from scripts.pdf_to_gr_json import merge_continuations
    out = merge_continuations([("the Governor makes the rules further", (0, 0, 10, 5)),
                               ("to amend the Gujarat Rules, 1967, namely:-", (0, 6, 12, 10)),
                               ("1. These rules may be called X.", (0, 11, 9, 15))])
    assert len(out) == 2 and out[0][0].endswith("namely:-") and out[0][1] == (0, 0, 12, 10)


def test_own_header_number_before_enacting_words_is_not_a_target():
    from app.lineage.extract import _after_enacting_words, extract_refs
    text = "NO.GS-2016-15- BRT-102015-1079-K :- In exercise of the powers conferred by article 309 the Governor makes rules."
    assert extract_refs(_after_enacting_words(text), set(), None, []).numbers == []


def test_blanket_repeal_names_no_instrument():
    from app.lineage.extract import _names_no_instrument
    s = "In exercise of the powers, and in supersession of all the rules made in this behalf, the Governor makes the following rules"
    assert _names_no_instrument(s, "in supersession of")
    assert not _names_no_instrument("rules in supersession of the Gujarat Rules, 1967", "in supersession of")
