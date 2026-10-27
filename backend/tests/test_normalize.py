from datetime import date

from app.normalize import detect_language, gr_key, gr_similarity, parse_date, to_ascii_digits


def test_gujarati_digits_converted():
    assert to_ascii_digits("૧૨/૦૩/૨૦૧૪") == "12/03/2014"


def test_gr_key_ignores_separators_case_and_digit_script():
    assert gr_key("GAD/2014/123-K") == gr_key("gad 2014 123 k")
    assert gr_key("સમાન-૧૦૨૦૧૪-૧૨૩") == gr_key("સમાન/102014/123")


def test_gr_similarity_tolerates_ocr_slip():
    assert gr_similarity("GAD-2014-1234", "GAD-2014-1Z34") >= 0.88


def test_parse_numeric_dates():
    assert parse_date("dated 12/03/2014") == date(2014, 3, 12)
    assert parse_date("તા.૧૨.૦૩.૨૦૧૪") == date(2014, 3, 12)
    assert parse_date("12-3-2014") == date(2014, 3, 12)


def test_parse_text_dates():
    assert parse_date("12th March, 2014") == date(2014, 3, 12)
    assert parse_date("5 માર્ચ 2014") == date(2014, 3, 5)


def test_invalid_date_rejected():
    assert parse_date("31/02/2014") is None


def test_detect_language():
    assert detect_language("maternity leave rule") == "en"
    assert detect_language("પ્રસૂતિ રજા નિયમ") == "gu"
    assert detect_language("maternity leave નો નિયમ શું છે") == "mixed"
    assert detect_language("1234") == "unknown"
