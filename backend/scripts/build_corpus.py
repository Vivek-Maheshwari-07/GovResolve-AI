"""Assemble the demo corpus: rule-family records + core text-layer GRs + Gujarati GRs, with portal metadata.

Usage (from backend/):
    python -m scripts.build_corpus --manifest ../final_dataset/manifest.csv --root ../final_dataset \
        --sources ../final_dataset/SOURCES_full_per_file_urls.txt --families-json D:/test/gr_json_families \
        --out D:/test/corpus_v1 [--workers 6]

- Rule-family records (already OCR'd, listing metadata) are copied as they are and win over duplicates.
- Core tier PDFs are converted from the text layer.
- Gujarati PDFs (any tier) are also OCR'd with guj+eng; the text with the better Gujarati score is kept. Most Gujarati
  text layers in this archive are lossy (legacy-font remapping, dropped conjuncts), so OCR usually wins.
- Issue date, GR number and subject come from the portal listing (`ROW:` lines) when it has them.
Writes one JSON per GR plus `corpus_report.csv` (text source, scores, metadata source). Output is data, keep it out of git.
"""
import argparse
import csv
import json
import os
import re
import shutil
import sys
from concurrent.futures import ProcessPoolExecutor
from datetime import date
from pathlib import Path
from urllib.parse import unquote

from scripts.pdf_to_gr_json import convert

_TESSDATA = Path(__file__).resolve().parents[2] / "data" / "tessdata"  # bundled guj.traineddata
_GU_WORD = re.compile(r"[\u0A80-\u0AFF]+")
_COMMON_GU = set("અને છે માટે તથા સરકાર નિયમ ઠરાવ વિભાગ આ કે ના ની નો થી તેમજ કરવા અંગે સામાન્ય વહીવટ ગુજરાત "
                 "રાજ્ય કર્મચારીઓ તા અધિકારી હુકમ પરિપત્ર સચિવાલય".split())
CORE_TIER = "01_core_gad_searchable"


def gujarati_score(text: str) -> float:
    """Share of Gujarati words that are very common words spelled correctly. Garbled layers score near 0."""
    words = _GU_WORD.findall(text)
    return sum(w in _COMMON_GU for w in words) / len(words) if words else 0.0


def parse_listing(path: Path) -> dict[str, dict]:
    """SOURCES file -> {pdf basename (lowercase): {date, number, subject}} from each block's `ROW:` line."""
    out, name = {}, None
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        if line.startswith("URL:"):
            name = unquote(line[4:].strip().rsplit("/", 1)[-1]).lower()
        elif line.startswith("ROW:") and name:
            cells = [c.strip() for c in line[4:].split("|")]
            if len(cells) >= 5:
                m = re.fullmatch(r"(\d{1,2})/(\d{1,2})/(\d{4})", cells[2])
                try:
                    d = date(int(m.group(3)), int(m.group(2)), int(m.group(1))).isoformat() if m else None
                except ValueError:
                    d = None
                subj = cells[4].rstrip(". ").strip() or None
                out.setdefault(name, {"date": d, "number": cells[3] or None, "subject": subj})
            name = None
    return out


def apply_listing(rec: dict, row: dict | None) -> str:
    """Overwrite date, number and subject with the portal listing where it has them. Returns the metadata source."""
    if not row:
        return "extracted"
    fc = rec["field_confidence"]
    if row["date"]:
        rec["issue_date"], fc["issue_date"] = row["date"], 0.95
    if row["number"]:
        rec["gr_number"], rec["gr_number_norm"], fc["gr_number"] = row["number"], re.sub(r"\s+", "", row["number"]), 0.9
    if row["subject"]:
        rec["subject"], fc["subject"] = row["subject"], 0.95
    return "portal_listing"


def _gr_id(file: str, sha: str) -> str:
    return "GR-" + re.sub(r"[^A-Za-z0-9_]+", "-", Path(file).stem)[:60] + "-" + sha[:6]


def _work(job: dict) -> dict:
    """Convert one PDF; for Gujarati ones also OCR and keep the better text."""
    os.environ.setdefault("TESSDATA_PREFIX", str(_TESSDATA))
    from scripts.ocr_to_gr_json import _ocr_reader  # imports pytesseract, only needed in workers

    pdf, gr_id = Path(job["pdf"]), job["gr_id"]
    layer = None if job["text_layer"] == "scanned" else convert(pdf, gr_id, job["department"], job["language"])
    best, source = layer, "text_layer"
    layer_score = gujarati_score(" ".join(c["text"] for c in layer["chunks"])) if layer else 0.0
    ocr_score, confs = None, []
    if job["language"] == "gu":
        ocr = convert(pdf, gr_id, job["department"], "gu", _ocr_reader("guj+eng", job["dpi"], confs))
        ocr_score = gujarati_score(" ".join(c["text"] for c in ocr["chunks"])) if ocr else 0.0
        if ocr and (best is None or ocr_score > layer_score):
            best, source = ocr, "ocr_guj+eng"
            best["field_confidence"]["ocr_mean_word_conf"] = round(sum(confs) / len(confs) / 100, 3) if confs else 0.0
    return {"job": job, "rec": best, "source": source, "layer_score": round(layer_score, 3),
            "ocr_score": None if ocr_score is None else round(ocr_score, 3)}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", type=Path, required=True)
    ap.add_argument("--root", type=Path, required=True)
    ap.add_argument("--sources", type=Path, required=True)
    ap.add_argument("--families-json", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--dpi", type=int, default=300)
    ap.add_argument("--workers", type=int, default=6)
    args = ap.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    listing = parse_listing(args.sources)

    report, have = [], set()
    for f in sorted(args.families_json.glob("*.json")):
        shutil.copyfile(f, args.out / f.name)
        have.add(f.stem)
        rec = json.loads(f.read_text(encoding="utf-8"))
        report.append({"gr_id": f.stem, "set": "rule_family", "language": rec["language"], "text_source": "family_json",
                       "layer_score": "", "ocr_score": "", "metadata": "portal_listing", "pages": rec["page_count"],
                       "subject": bool(rec["subject"]), "number": bool(rec["gr_number"])})

    jobs = []
    with open(args.manifest, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            if row["tier"] != CORE_TIER and row["language"] != "gu":
                continue
            gr_id = _gr_id(row["file"], row["sha256"])
            if gr_id in have:
                continue
            have.add(gr_id)
            jobs.append({"pdf": str(args.root / row["file"]), "gr_id": gr_id, "tier": row["tier"],
                         "department": row["department"], "language": row["language"] if row["language"] in ("gu", "en") else "en",
                         "text_layer": row["text_layer"], "dpi": args.dpi,
                         "listing_key": unquote(row["source_url"].rsplit("/", 1)[-1]).lower() if row["source_url"]
                         else Path(row["file"]).name.lower()})

    with ProcessPoolExecutor(args.workers) as pool:
        for res in pool.map(_work, jobs):
            job, rec = res["job"], res["rec"]
            if rec is None:
                print(f"EMPTY {job['gr_id']}", flush=True)
                continue
            meta = apply_listing(rec, listing.get(job["listing_key"]))
            (args.out / f"{job['gr_id']}.json").write_text(json.dumps(rec, ensure_ascii=False), encoding="utf-8")
            report.append({"gr_id": job["gr_id"], "set": "core" if job["tier"] == CORE_TIER else "gujarati_extra",
                           "language": rec["language"], "text_source": res["source"], "layer_score": res["layer_score"],
                           "ocr_score": "" if res["ocr_score"] is None else res["ocr_score"], "metadata": meta,
                           "pages": rec["page_count"], "subject": bool(rec["subject"]), "number": bool(rec["gr_number"])})
            print(f"OK {job['gr_id']} {res['source']}", flush=True)

    with open(args.out / "corpus_report.csv", "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(report[0]))
        w.writeheader()
        w.writerows(report)
    n = len(report)
    print(f"records {n}; subject {sum(r['subject'] for r in report)}/{n}; number {sum(r['number'] for r in report)}/{n}; "
          f"ocr {sum(r['text_source'] == 'ocr_guj+eng' for r in report)} -> {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
