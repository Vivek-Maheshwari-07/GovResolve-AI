"""OCR scanned GR PDFs (Tesseract) and write GRRecord JSON, using the portal listing for the metadata.

Usage (from backend/):
    python -m scripts.ocr_to_gr_json --families ../final_dataset/rule_families.csv --pdf-root D:/test/dataset_organized \
        --out D:/test/gr_json_families [--lang eng] [--dpi 300] [--workers 6]

Text-layer PDFs go through the normal converter. Issue date, GR number and subject come from the portal listing
(rule_families.csv), which is more reliable than guessing from OCR text. Output is data, keep it out of git.
"""
import argparse
import csv
import hashlib
import json
import re
import sys
from concurrent.futures import ProcessPoolExecutor
from datetime import date
from pathlib import Path

import pymupdf
import pytesseract
from PIL import Image

from scripts.pdf_to_gr_json import convert


def _ocr_reader(lang: str, dpi: int, confs: list[float]):
    zoom = dpi / 72

    def read(page):
        pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), colorspace=pymupdf.csGRAY)
        img = Image.frombytes("L", (pix.width, pix.height), pix.samples)
        data = pytesseract.image_to_data(img, lang=lang, config="--psm 6", output_type=pytesseract.Output.DICT)
        paras: dict[tuple, dict] = {}
        for i, word in enumerate(data["text"]):
            word = word.strip()
            conf = float(data["conf"][i])
            if not word or conf < 0:
                continue
            confs.append(conf)
            key = (data["block_num"][i], data["par_num"][i])
            x0, y0 = data["left"][i] / zoom, data["top"][i] / zoom
            x1, y1 = x0 + data["width"][i] / zoom, y0 + data["height"][i] / zoom
            p = paras.setdefault(key, {"words": [], "bb": [x0, y0, x1, y1]})
            p["words"].append(word)
            p["bb"] = [min(p["bb"][0], x0), min(p["bb"][1], y0), max(p["bb"][2], x1), max(p["bb"][3], y1)]
        return [(" ".join(p["words"]), tuple(p["bb"])) for p in paras.values() if len(" ".join(p["words"])) >= 15]
    return read


def _work(job: dict) -> str:
    pdf = Path(job["pdf"])
    sha = hashlib.sha256(pdf.read_bytes()).hexdigest()
    gr_id = "GR-" + re.sub(r"[^A-Za-z0-9_]+", "-", pdf.stem)[:60] + "-" + sha[:6]
    out = Path(job["out"]) / f"{gr_id}.json"
    confs: list[float] = []
    reader = None if job["text_layer"] != "scanned" else _ocr_reader(job["lang"], job["dpi"], confs)
    rec = convert(pdf, gr_id, "General Administration Department", "en", reader)
    if rec is None:
        return f"EMPTY {pdf.name}"
    rec["issue_date"] = date.fromisoformat(job["date"]).isoformat()
    rec["gr_number"] = job["number"] or rec["gr_number"]
    rec["gr_number_norm"] = re.sub(r"\s+", "", job["number"]) if job["number"] else rec["gr_number_norm"]
    rec["subject"] = job["subject"] or rec["subject"]
    rec["field_confidence"].update({"issue_date": 0.95, "subject": 0.95, "gr_number": 0.9 if job["number"] else 0.0})
    if confs:
        rec["field_confidence"]["ocr_mean_word_conf"] = round(sum(confs) / len(confs) / 100, 3)
    out.write_text(json.dumps(rec, ensure_ascii=False), encoding="utf-8")
    return f"OK {pdf.name} {'ocr' if confs else 'text'} pages={rec['page_count']}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--families", type=Path, required=True)
    ap.add_argument("--pdf-root", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--lang", default="eng")
    ap.add_argument("--dpi", type=int, default=300)
    ap.add_argument("--workers", type=int, default=6)
    args = ap.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    jobs = []
    with open(args.families, encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            jobs.append({"pdf": str(args.pdf_root / r["file_in_dataset_organized"]), "out": str(args.out),
                         "text_layer": r["text_layer"], "date": r["issue_date"], "number": r["gr_number_as_listed"],
                         "subject": r["subject_as_listed"], "lang": args.lang, "dpi": args.dpi})
    with ProcessPoolExecutor(args.workers) as pool:
        for line in pool.map(_work, jobs):
            print(line, flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
