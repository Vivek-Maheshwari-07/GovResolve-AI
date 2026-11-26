"""Missing GR metadata is filled from the document text, its file name and the manifest, never over a value that is already good."""
import datetime as dt

from backend.scripts.enrich_metadata import date_from_filename, date_from_text, enrich, number_from_text, subject_from_text

GAZETTE = ("Extra No. 5 © The Gujarat Government Gazette EXTRAORDINARY PUBLISHED BY AUTHORITY Vol. LXIII] TUESDAY, FEBRUARY 1, 2022 "
           "/ MAGHA 12, 1943 ... No. KP/38 of 2023/PER/102020/1511/KH :- In exercise of the powers ... "
           "These rules may be called the Compounder, Class III, in the Superior Panchayat Service Recruitment Rules, 2022.")


def test_the_gazette_header_gives_the_publication_date():
    assert date_from_text(GAZETTE) == (dt.date(2022, 2, 1), "gazette_header")


def test_dates_in_portal_file_names():
    assert date_from_filename("kh-branch-gr-06-01-2021.pdf") == dt.date(2021, 1, 6)
    assert date_from_filename("1_2198_1_12-7-1962.pdf") == dt.date(1962, 7, 12)
    assert date_from_filename("1_3940_1_1-19630206-Circular.pdf") == dt.date(1963, 2, 6)
    assert date_from_filename("notification-13022007.pdf") == dt.date(2007, 2, 13)
    assert date_from_filename("clerk.pdf") is None


def test_gr_numbers_in_english_and_gujarati():
    assert number_from_text(GAZETTE) == "KP/38 of 2023/PER/102020/1511/KH"
    assert number_from_text("વિભાગ ક્રમાંક:- રજમ/૧૫૨૦૨૦/૧૦૩૭/ખ સચિવાલય") == "રજમ/૧૫૨૦૨૦/૧૦૩૭/ખ"


def test_subject_from_the_rules_title_with_an_ocr_split_year():
    text = "These rules may be called the Gujarat Development Service Departmental Examination Rules, 1 990."
    assert subject_from_text(text, "x.pdf") == ("Gujarat Development Service Departmental Examination Rules, 1990", "rules_title")


def test_sub_section_is_not_a_subject_line():
    s, src = subject_from_text("conferred by sub-section (2) of section 1 of the Act", "g-branch-notification.pdf")
    assert src == "file_name" and "section" not in s.lower()


def test_the_file_name_date_beats_a_date_the_text_only_cites():
    rec = {"file_path": r"C:\x\9_GR-Z-27-9-1990-Exam-Rules.pdf", "issue_date": None, "gr_number": "UNKNOWN", "subject": "Unknown Subject",
           "raw_text": "in supersession of the Rules, 1979, prescribed under No. GP-16, dated the 11th January, 1979 the Governor ..."}
    changed = enrich(rec)
    assert rec["issue_date"] == "1990-09-27" and changed["issue_date"][1] == "file_name"
    assert rec["metadata_sources"]["issue_date"] == "file_name"


def test_good_values_are_never_overwritten_and_a_future_date_is_replaced():
    rec = {"file_path": "a-01-02-2020.pdf", "issue_date": "2019-05-05", "gr_number": "GS/2019/1", "subject": "Leave rules", "raw_text": GAZETTE}
    assert enrich(rec) == {} and "metadata_sources" not in rec
    rec = {"file_path": "PRHRDD.pdf", "issue_date": "2999-01-01", "gr_number": "X/1/2", "subject": "S", "raw_text": GAZETTE}
    assert enrich(rec)["issue_date"] == ("2022-02-01", "gazette_header")


def test_two_digit_years_in_file_names():
    assert date_from_filename("1_3847_1_Leave-LTC-Notification_25-10-24.pdf") == dt.date(2024, 10, 25)
    assert date_from_filename("1_1424_1_26-12-77.pdf") == dt.date(1977, 12, 26)


def test_recheck_replaces_a_date_the_order_only_cites_and_a_truncated_number():
    text = ("પરિપત્ર ક્રમાાંક : GAD/HRM/e-file/1/2024/1067/HRMS Section સચિવાલય તા. .૧૦.૨૦૨૪ વંચાણે લીધા : "
            "(૧) સામાન્ય વહીવટ વિભાગનો તા. ૩૧.૦૮.૨૦૧૬નો પરિપત્ર")
    rec = {"file_path": "1_3847_1_Leave-LTC-Notification_25-10-24.pdf", "issue_date": "2016-08-31",
           "gr_number": "1/2024/1067/HRMS", "subject": "Leave", "raw_text": text}
    assert enrich(dict(rec)) == {}                                # without recheck an ingester value is left alone
    changed = enrich(rec, recheck=True)
    assert rec["issue_date"] == "2024-10-25" and "was 2016-08-31" in changed["issue_date"][1]
    assert rec["gr_number"] == "GAD/HRM/e-file/1/2024/1067/HRMS"


def test_recheck_keeps_the_gazette_publication_date():
    rec = {"file_path": "Compounder-01-02-2021.pdf", "issue_date": "2022-02-01", "gr_number": "KP/38 of 2023/PER/102020/1511/KH",
           "subject": "S", "raw_text": GAZETTE}
    assert enrich(rec, recheck=True) == {} and rec["issue_date"] == "2022-02-01"
