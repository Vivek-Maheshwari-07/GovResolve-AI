"""OCR helpers: straightening, per-page language choice, which lines are kept, and (when Tesseract + Gujarati are installed) a real read."""
from __future__ import annotations

from pathlib import Path

import pytest

pytest.importorskip("pytesseract")
np = pytest.importorskip("numpy")
from PIL import Image, ImageDraw, ImageFont  # noqa: E402

from backend.ingestion import ocr  # noqa: E402


def _page_with_lines(rotate: float = 0.0) -> Image.Image:
    img = Image.new("L", (900, 1100), 255)
    d = ImageDraw.Draw(img)
    for i in range(24):
        d.rectangle([60, 70 + i * 40, 840 - (i % 4) * 90, 86 + i * 40], fill=30)   # dark bars stand in for text lines
    return img.rotate(rotate, resample=Image.BICUBIC, fillcolor=255) if rotate else img


def test_skew_is_found_and_removed():
    tilted = _page_with_lines(rotate=2.5)
    angle = ocr.estimate_skew(tilted)
    assert abs(angle + 2.5) <= 0.75, angle
    fixed = ocr.straighten(tilted, angle)
    assert abs(ocr.estimate_skew(fixed)) <= 0.5


def test_level_and_blank_pages_are_left_alone():
    assert ocr.estimate_skew(_page_with_lines()) == 0.0
    assert ocr.estimate_skew(Image.new("L", (600, 800), 255)) == 0.0


def _row(word: str, conf: float = 80.0):
    return (word, conf, 1, 1, 0, 0, 10, 10)


def test_language_is_chosen_per_page(monkeypatch):
    monkeypatch.setattr(ocr, "available_languages", lambda: frozenset({"guj", "eng", "osd"}))
    gujarati_page = [_row("સામાન્ય")] * 30 + [_row("GR", 40)] * 5
    english_page = [_row("Government")] * 30 + [_row("સામાન્ય")] * 3
    bilingual_page = [_row("સામાન્ય")] * 20 + [_row("Resolution")] * 20
    assert ocr.pick_language(gujarati_page) == "guj"
    assert ocr.pick_language(english_page) == "guj+eng"
    assert ocr.pick_language(bilingual_page) == "guj+eng"
    assert ocr.pick_language([]) == "guj+eng"


def test_english_only_install_falls_back_to_english(monkeypatch):
    monkeypatch.setattr(ocr, "available_languages", lambda: frozenset({"eng"}))
    assert ocr.pick_language([_row("સામાન્ય")] * 30) == "eng"


def test_short_lines_are_kept_but_noise_is_not():
    assert ocr._keep("(2)", 60)          # clause numbers
    assert ocr._keep("૧.", 70)
    assert ocr._keep("ઠરાવ", 90)         # a heading
    assert not ocr._keep("|||", 90)      # border or fold line
    assert not ocr._keep("~ .", 80)
    assert not ocr._keep("Resolution", 10)   # read, but hopelessly


_FONT = next((f for f in (r"C:\Windows\Fonts\Nirmala.ttc", "/usr/share/fonts/truetype/noto/NotoSansGujarati-Regular.ttf") if Path(f).is_file()), None)


@pytest.mark.skipif(_FONT is None or "guj" not in ocr.available_languages(), reason="needs Tesseract with Gujarati and a Gujarati font")
def test_gujarati_page_is_read_as_gujarati_with_the_gujarati_model():
    img = Image.new("L", (1700, 800), 255)
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype(_FONT, 56)
    for i in range(5):
        d.text((60, 40 + i * 150), "સામાન્ય વહીવટ વિભાગ ગુજરાત સરકાર ઠરાવ", font=font, fill=0)
    page = ocr.ocr_image(img, dpi=300)
    assert page.language == "guj"
    assert sum(1 for ch in page.text if "઀" <= ch <= "૿") > 15, page.text
    assert page.confidence > 0.5


# ── repair of garbled legacy-font pages (scripts/repair_garbled_pages.py) ─────────────────────────────

def test_garbled_pages_are_told_from_clean_ones():
    from scripts.repair_garbled_pages import page_is_garbled

    garbled = ("સામાન્ય વહીવટ વવભાગ સચિવાલય, ગાાંધીનગ૨ ગુજરાતના માંત્રીશ્રીઓના પગાર અને ભથ્ાાં અચધચનયમ ચનયમો, "
               "ચનયમ-૩ના પેટા-ચનયમ(૫)ના પ્ર્મ પરંતુકને બદલે")
    clean = ("સામાન્ય વહીવટ વિભાગ સચિવાલય ગાંધીનગર ગુજરાત સરકારના તમામ વિભાગો અને કચેરીઓ માટે આ નિયમ તથા ઠરાવ "
             "અમલમાં રહેશે અને કર્મચારીઓ માટે ઠરાવ લાગુ પડશે")
    assert page_is_garbled(garbled)
    assert not page_is_garbled(clean)
    assert not page_is_garbled("The Government of Gujarat hereby makes the following rules " * 5)
    assert not page_is_garbled("ઠરાવ")   # too little Gujarati to judge


class _FakePix:
    width, height, samples = 40, 20, bytes(40 * 20)


class _FakePage:
    def get_pixmap(self, **_):
        return _FakePix()


def test_block_keeps_its_text_layer_when_ocr_loses_most_of_it(monkeypatch):
    from scripts import repair_garbled_pages as rg

    old = "ક્રમ વાહનનો પ્રકાર ₹ ૯.૦૦ પ્રચત કક.મી. " * 4          # a table: the rates matter

    def short(*_a, **_k):
        return ocr.OcrPage(paragraphs=[ocr.OcrParagraph("ક્રમ", (0, 0, 1, 1), 0.9)], word_confidences=[90.0])

    monkeypatch.setattr(rg.ocr, "ocr_image", short)
    confs: list[float] = []
    assert rg.ocr_block(_FakePage(), (0, 0, 10, 10), old, 300, confs) == old and confs == []


def test_block_takes_the_ocr_text_when_it_is_complete(monkeypatch):
    from scripts import repair_garbled_pages as rg

    old = "ગુજરાતના માંત્રીશ્રીઓના પગાર"
    good = "ગુજરાતના મંત્રીશ્રીઓના પગાર"

    def full(*_a, **_k):
        return ocr.OcrPage(paragraphs=[ocr.OcrParagraph(good, (0, 0, 1, 1), 0.9)], word_confidences=[90.0, 91.0])

    monkeypatch.setattr(rg.ocr, "ocr_image", full)
    confs: list[float] = []
    assert rg.ocr_block(_FakePage(), (0, 0, 10, 10), old, 300, confs) == good and confs == [90.0, 91.0]
