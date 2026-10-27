from datetime import date

import pytest

from app.lineage.normalize import (
    find_dates, gr_key, gu_to_ascii_digits, join_lines, normalize_gr_number, normalize_text, parse_date,
)


@pytest.mark.parametrize("text,expected", [
    ("12/05/2014", date(2014, 5, 12)),
    ("12-5-2014", date(2014, 5, 12)),
    ("12.05.2014", date(2014, 5, 12)),
    ("૧૨/૦૫/૨૦૧૪", date(2014, 5, 12)),
    ("તા. ૧૨-૦૫-૨૦૧૪", date(2014, 5, 12)),
    ("12th May 2014", date(2014, 5, 12)),
    ("12 May, 2014", date(2014, 5, 12)),
    ("May 12, 2014", date(2014, 5, 12)),
    ("12-May-2014", date(2014, 5, 12)),
    ("1st January 2020", date(2020, 1, 1)),
    ("2014-05-12", date(2014, 5, 12)),
    ("12/05/14", date(2014, 5, 12)),
    ("૧૫ જુલાઈ ૨૦૧૨", date(2012, 7, 15)),
    ("૧ મે ૨૦૧૯", date(2019, 5, 1)),
    ("dated 31 December 1999", date(1999, 12, 31)),
])
def test_date_formats(text, expected):
    assert parse_date(text) == expected


@pytest.mark.parametrize("text", ["31/02/2014", "GAD/2014/07", "no date here", "99/99/2014"])
def test_not_a_date(text):
    assert parse_date(text) is None


def test_several_dates_in_order_without_overlap():
    hits = find_dates(normalize_text("GR dated 12/05/2014 and GR dated 3 March 2016"))
    assert [h.value for h in hits] == [date(2014, 5, 12), date(2016, 3, 3)]


def test_gujarati_digits():
    assert gu_to_ascii_digits("૦૧૨૩૪૫૬૭૮૯") == "0123456789"


def test_normalize_text_never_needs_original_changed():
    original = "ખેતી-૨૦૧૨-૦૩"
    assert normalize_text(original) == "ખેતી-2012-03" and original == "ખેતી-૨૦૧૨-૦૩"


def test_zero_width_and_odd_dashes_removed():
    assert normalize_text("GAD​– 2014‍") == "GAD- 2014"


def test_join_lines_for_ocr_breaks():
    assert join_lines("in super-\nsession") != "insupersession"  # hyphenated breaks are left alone
    assert normalize_text(join_lines("in\nsupersession   of")) == "in supersession of"


@pytest.mark.parametrize("raw,norm", [
    ("GAD/2014/07", "GAD/2014/07"),
    ("gad / 2014 / 07", "GAD/2014/07"),
    ("ખેતી-૨૦૧૨-૦૩", "ખેતી-2012-03"),
    ("FIN– 2018 –03", "FIN-2018-03"),
])
def test_gr_number_normalisation(raw, norm):
    assert normalize_gr_number(raw) == norm


def test_gr_key_ignores_separators():
    assert gr_key("GAD/2014/07") == gr_key("GAD-2014-07") == gr_key("gad 2014 07")
    assert gr_key("ખેતી-૨૦૧૨-૦૩") == gr_key("ખેતી/2012/03")
    assert gr_key("GAD/2014/07") != gr_key("GAD/2014/08")
