"""OCR for scanned Government Resolution pages (Tesseract), shared by the upload path and the corpus scripts.

What it does that a plain `image_to_data(lang="guj+eng")` call does not:
  * finds Tesseract and a tessdata folder that really has the Gujarati model (the system install usually has English only);
  * straightens slightly skewed scans;
  * chooses the language per page. Gujarati text read with `guj+eng` partly comes out as Latin junk ("સામાન્ય વહીવટ" -> "aglae Bao"),
    so a page that is mostly Gujarati is read with `guj` alone, an English page with `guj+eng`;
  * keeps short lines (clause numbers, headings) and reports the real mean word confidence.

Images are never modified beyond straightening; the text is exactly what Tesseract read.
"""
from __future__ import annotations

import os
import re
import shutil
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from loguru import logger

try:
    import numpy as np
    import pytesseract
    from PIL import Image, ImageOps

    PYTESSERACT = True
except ImportError:  # pragma: no cover - optional dependency
    PYTESSERACT = False

_ROOT = Path(__file__).resolve().parents[2]
_GU = re.compile(r"[઀-૿]")
_LATIN = re.compile(r"[A-Za-z]")

DEFAULT_DPI = 300
DETECT_DPI = 150
MIN_WORD_CONF = 0           # Tesseract uses -1 for "not a word"; 0 is a real, if hopeless, reading
MIN_PARAGRAPH_CONF = 25     # a paragraph whose words average below this is noise (stains, punch holes, borders)


@dataclass
class OcrParagraph:
    text: str
    bbox: tuple[float, float, float, float]   # page points (PDF units)
    confidence: float                          # 0-1


@dataclass
class OcrPage:
    paragraphs: list[OcrParagraph] = field(default_factory=list)
    confidence: float = 0.0                    # mean word confidence, 0-1
    language: str = "eng"                      # Tesseract language string actually used
    skew: float = 0.0                          # degrees the page was rotated to straighten it
    word_confidences: list[float] = field(default_factory=list)   # 0-100, one per word

    @property
    def text(self) -> str:
        return "\n".join(p.text for p in self.paragraphs)


# ── Tesseract discovery ───────────────────────────────────────────────────────────────────────────────

def _has_lang(folder: Path, lang: str) -> bool:
    return (folder / f"{lang}.traineddata").is_file()


@lru_cache(maxsize=1)
def configure() -> bool:
    """Point pytesseract at the binary and at a tessdata folder with Gujarati. False when OCR cannot run."""
    if not PYTESSERACT:
        logger.warning("pytesseract is not installed; scanned pages will have no text.")
        return False
    for cand in (
        os.getenv("TESSERACT_CMD", ""),
        shutil.which("tesseract") or "",
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    ):
        if cand and cand != "tesseract" and Path(cand).is_file():
            pytesseract.pytesseract.tesseract_cmd = cand
            break
    # Folder order: the one the user set, higher-accuracy models if downloaded, the bundled ones.
    folders = []
    if os.environ.get("TESSDATA_PREFIX"):
        folders.append(Path(os.environ["TESSDATA_PREFIX"]))
    folders += [_ROOT / "data" / "tessdata_best", _ROOT / "data" / "tessdata"]
    for folder in folders:
        if _has_lang(folder, "guj") and _has_lang(folder, "eng"):
            os.environ["TESSDATA_PREFIX"] = str(folder.resolve())
            logger.info(f"OCR models: {folder.resolve()}")
            return True
    logger.warning("No tessdata folder has both guj and eng; Gujarati pages will not be read correctly.")
    return True


@lru_cache(maxsize=1)
def available_languages() -> frozenset[str]:
    if not configure():
        return frozenset()
    try:
        return frozenset(pytesseract.get_languages())
    except Exception:
        return frozenset({"eng"})


# ── Image preparation ─────────────────────────────────────────────────────────────────────────────────

def render_gray(page, dpi: int = DEFAULT_DPI):
    """A PyMuPDF page as a greyscale PIL image."""
    import pymupdf

    pix = page.get_pixmap(dpi=dpi, colorspace=pymupdf.csGRAY)
    return Image.frombytes("L", (pix.width, pix.height), pix.samples)


def estimate_skew(gray, max_angle: float = 5.0) -> float:
    """Degrees to rotate (PIL's counter-clockwise `rotate`) so the text lines run level; 0.0 when already level or unsure."""
    small = gray.copy()
    small.thumbnail((800, 800))
    arr = np.asarray(small, dtype=np.float32)
    ink = arr < (arr.mean() - arr.std())
    if ink.sum() < 200:   # blank page
        return 0.0
    ink_img = Image.fromarray((ink * 255).astype("uint8"))

    def score(angle: float) -> float:
        rotated = np.asarray(ink_img.rotate(angle, resample=Image.BILINEAR, fillcolor=0), dtype=np.float32)
        return float(np.var(rotated.sum(axis=1)))   # sharp, separated text lines give a spiky row profile

    coarse = max(np.arange(-max_angle, max_angle + 0.01, 1.0), key=score)
    fine = max(np.arange(coarse - 1.0, coarse + 1.01, 0.25), key=score)
    # only trust a clear gain over the page as it is
    if score(fine) < score(0.0) * 1.05:
        return 0.0
    return float(fine) if abs(fine) >= 0.5 else 0.0


def straighten(gray, angle: float):
    if not angle:
        return gray
    return gray.rotate(angle, resample=Image.BICUBIC, expand=False, fillcolor=255)


# ── Reading ───────────────────────────────────────────────────────────────────────────────────────────

def _words(img, lang: str, psm: int | None = None):
    config = f"--psm {psm}" if psm else ""
    data = pytesseract.image_to_data(img, lang=lang, config=config, output_type=pytesseract.Output.DICT)
    rows = []
    for i, word in enumerate(data["text"]):
        word = word.strip()
        conf = float(data["conf"][i])
        if word and conf >= MIN_WORD_CONF:
            rows.append((word, conf, data["block_num"][i], data["par_num"][i],
                         data["left"][i], data["top"][i], data["width"][i], data["height"][i]))
    return rows


def pick_language(rows) -> str:
    """Tesseract language string for a page, from a first `guj+eng` reading of it.

    Mostly Gujarati (clearly more Gujarati words than confident English words of 4+ letters) -> `guj` only;
    otherwise `guj+eng`; English-only installs fall back to `eng`.
    """
    langs = available_languages()
    if "guj" not in langs:
        return "eng"
    gu = sum(1 for w, *_ in rows if _GU.search(w))
    english = sum(1 for w, c, *_ in rows if c >= 60 and len(w) >= 4 and _LATIN.search(w) and not _GU.search(w))
    if gu >= 15 and gu >= 2 * english:
        return "guj"
    return "guj+eng" if "eng" in langs else "guj"


def _keep(text: str, conf: float) -> bool:
    """Short lines are fine (clause numbers, "(2)", headings) as long as they hold a letter or digit and were read with some confidence."""
    return bool(re.search(r"[\w઀-૿]", text)) and conf >= MIN_PARAGRAPH_CONF


def ocr_image(gray, dpi: int = DEFAULT_DPI, lang: str | None = None, deskew: bool = True, psm: int | None = None) -> OcrPage:
    """Read one rendered page (or a clipped block of one). `lang` forces a Tesseract language string; None chooses per page."""
    if not configure():
        return OcrPage(language="")
    skew = estimate_skew(gray) if deskew else 0.0
    gray = ImageOps.autocontrast(straighten(gray, skew))
    if lang is None:
        # a quick low-resolution reading only decides the language; the page is then read once at full resolution
        scale = min(1.0, DETECT_DPI / dpi)
        probe = gray.resize((max(1, int(gray.width * scale)), max(1, int(gray.height * scale))), Image.LANCZOS)
        lang = pick_language(_words(probe, "guj+eng" if "guj" in available_languages() else "eng"))
    rows = _words(gray, lang, psm)

    zoom = dpi / 72
    paras: dict[tuple[int, int], dict] = {}
    for word, conf, block, par, left, top, width, height in rows:
        x0, y0 = left / zoom, top / zoom
        x1, y1 = x0 + width / zoom, y0 + height / zoom
        p = paras.setdefault((block, par), {"words": [], "confs": [], "bb": [x0, y0, x1, y1]})
        p["words"].append(word)
        p["confs"].append(conf)
        p["bb"] = [min(p["bb"][0], x0), min(p["bb"][1], y0), max(p["bb"][2], x1), max(p["bb"][3], y1)]

    page = OcrPage(language=lang, skew=skew)
    for p in paras.values():
        text = " ".join(p["words"])
        conf = sum(p["confs"]) / len(p["confs"])
        if not _keep(text, conf):
            continue
        page.paragraphs.append(OcrParagraph(text=text, bbox=tuple(p["bb"]), confidence=conf / 100))
        page.word_confidences.extend(p["confs"])
    if page.word_confidences:
        page.confidence = sum(page.word_confidences) / len(page.word_confidences) / 100
    return page


def ocr_pdf_page(pdf_page, dpi: int = DEFAULT_DPI, lang: str | None = None) -> OcrPage:
    """Render a PyMuPDF page and read it."""
    return ocr_image(render_gray(pdf_page, dpi), dpi=dpi, lang=lang)
