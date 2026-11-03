"""Unit tests for Gujarati lineage parsing: inline OCR read-lists, numerals, pointer ranges,
explicit cancellation/amendment phrasing, and false-positive immunity (e.g. 'રજા રદ')."""
from datetime import date
from app.schemas import GRRecord, Chunk, RelType
from app.lineage.extract import extract_refs, split_segments, parse_read_items
from app.lineage.patterns import match_relation
from app.lineage.resolve import _without_quoted_text


def _make_gr(gr_id: str, text: str, gr_number: str = "TEST-101", issue_date: date = date(2021, 5, 10)) -> GRRecord:
    return GRRecord(
        gr_id=gr_id,
        gr_number=gr_number,
        department="General Administration Department",
        subject="Test Gujarati Subject",
        issue_date=issue_date,
        chunks=[Chunk(chunk_id=f"{gr_id}:1", page=1, text=text, section="other")]
    )


def test_inline_read_list_splitting():
    """Verify inline headings (વંચાણમાં લીધા, આમુખ, ઠરાવ) and inline items (૧), (૨), (૩) are parsed into ReadItems."""
    text = (
        "ગુજરાત સરકાર સામાન્ય વહીવટ વિભાગ ઠરાવ ક્રમાંક. ખતપ-૧૦૯૮-૫૪૦-ત.એ. તા. ૨૪/૦૯/૨૦૧૯ વંચાણમાં લીધાં:- "
        "(૧) સા.વ.વિ.નો તા.૨/૧૧/૨૦૦૦નો સરખા ક્રમાંકનો ઠરાવ "
        "(૨) સા.વ.વિ.નો તાઃ ૨૧/૧૧/૨૦૦૦નો સરખા ક્રમાંકનો પત્ર "
        "(૩) સા.વ.વિ.નો તાઃ ૨૪/૫/૨૦૦૧નો સરખા ક્રમાંકનો પત્ર "
        "(૪) સા.વ.વિ.નો તાઃ ૪/૧/૨૦૦૨નો સરખા ક્રમાંકનો ઠરાવ "
        "(પ) સા.વ.વિ.નો તાઃ ૧૬/૭/૨૦૦૪નો સરખા ક્રમાંકનો ઠરાવ "
        "આમુખ-.- સરકારી અધિકારી/કર્મચારી સામેની ખાતાકીય તપાસ અંગે. "
        "ઠરાવ:- આથી ઠરાવવામાં આવે છે."
    )
    gr = _make_gr("GR-2028", text, gr_number="ખતપ-૧૦૯૮-૫૪૦-ત.એ.", issue_date=date(2019, 9, 24))
    segs = split_segments(gr)
    read_segs = [s for s in segs if s.section == "read"]
    assert len(read_segs) >= 1
    items = parse_read_items(segs)
    assert len(items) == 5
    assert items[0].number == 1
    assert "2/11/2000" in items[0].text
    assert items[1].number == 2
    assert items[4].number == 5  # OCR '(પ)' parsed as 5


def test_pointer_range_and_multi_pointer_extraction():
    """Verify pointer ranges '(૧) થી (૩)' and multi-pointers 'સંદર્ભ (૧), (૨), અને (૬)'."""
    text1 = "પુખ્ત વિચારણાને અંતે વંચાણમાં લીધેલ ક્રમાંક (૧) થી (૩) પરના પરિપત્રો આથી રદ કરવામાં આવે છે."
    refs1 = extract_refs(text1, set(), date(2021, 1, 1), ["સામાન્ય વહીવટ વિભાગ"])
    assert refs1.pointers == [1, 2, 3]

    text2 = "મહેનતાણાંના દરમાં સુધારા અંગેના ઉક્ત ફેરફાર સિવાયની સંદર્ભ(૧), (૨), અને (૬)ના ઠરાવથી નિયત થયેલી અન્ય જોગવાઇઓ યથાવત રહેશે."
    refs2 = extract_refs(text2, set(), date(2021, 1, 1), ["સામાન્ય વહીવટ વિભાગ"])
    assert 1 in refs2.pointers and 2 in refs2.pointers and 6 in refs2.pointers

    text3 = "સંદર્ભ (૨) પરના ઠરાવ મુજબ"
    refs3 = extract_refs(text3, set(), date(2021, 1, 1), ["સામાન્ય વહીવટ વિભાગ"])
    assert refs3.pointers == [2]


def test_all_read_items_pointer():
    """Verify 'વંચાણે લીધેલ તમામ' activates all_read_items flag."""
    text = "ઉપર વંચાણે લીધેલ તમામ ઠરાવો, પત્રોની સૂચનાઓનો આ ઠરાવમાં સમાવેશ કરેલ હોઇ, વંચાણે લીધેલ તમામ ઠરાવો તથા પત્રો આથી રદ કરવામાં આવે છે."
    refs = extract_refs(text, set(), date(2021, 1, 1), ["સામાન્ય વહીવટ વિભાગ"])
    assert refs.all_read_items is True
    assert refs.has_target() is True


def test_leave_cancellation_false_positive_immunity():
    """Verify 'રજા રદ' (leave cancelled) does NOT produce a cancellation lineage relation."""
    text_leave = "કર્મચારી દ્વારા રજૂ કરાયેલ અરજી અન્વયે પ્રસૂતિ રજા રદ કરવામાં આવે છે."
    rel = match_relation(text_leave)
    assert rel is None  # Must NOT be RelType.CANCELS

    text_leave2 = "આથી સંબંધિત કર્મચારીની હક્ક રજાઓ રદ ગણવામાં આવે છે."
    rel2 = match_relation(text_leave2)
    assert rel2 is None

    # Real GR cancellation MUST still match
    text_gr_cancel = "આથી ઉક્ત પરિપત્રો આથી રદ કરવામાં આવે છે."
    rel3 = match_relation(text_gr_cancel)
    assert rel3 is not None
    assert rel3[0] == RelType.CANCELS


def test_explicit_cancellation_and_amendment_phrasing():
    """Verify explicit cancellation and amendment phrases."""
    assert match_relation("વંચાણે લીધેલ પરિપત્રો આથી રદ કરવામાં આવે છે")[0] == RelType.CANCELS
    assert match_relation("આમુખમાં દર્શાવેલ પરિપત્રો રદ કરીને બહાર પાડવામાં આવે છે")[0] == RelType.SUPERSEDES
    assert match_relation("નીચે મુજબ સુધારો કરવામાં આવે છે")[0] == RelType.AMENDS
    assert match_relation("ઉક્ત સુધારા વધારા સિવાય અન્ય જોગવાઇઓ યથાવત રહેશે")[0] == RelType.AMENDS


def test_senior_clerk_first_named_instrument_wins():
    """Verify that in Senior Clerk 2020 amendment, the first-named instrument wins and doesn't link to quoted 1967 rules."""
    text = (
        'In the Senior Clerk, class III, in the subordinate service of the Non Secretariat Departments, Recruitment Rules, 2015, '
        '(herein after referred to as the said rules) in rule 3, in clause (a) for the words, "by promotion of a person of proved merit", '
        'the words "by promotion of a person who possess good benchmark as laid down in the Gujarat Civil Services Classification and '
        'Recruitment (General) Rules, 1967" shall be substituted.'
    )
    # _without_quoted_text should remove the quoted 1967 rules
    unquoted = _without_quoted_text(text)
    assert "1967" not in unquoted
    assert "Rules, 2015" in unquoted

