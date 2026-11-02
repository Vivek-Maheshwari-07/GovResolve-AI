"""Find the source PDF of a GR by its file name, in one or more folders (searched recursively, indexed once).

A corpus record keeps only the bare file name (`source_pdf`), while the PDFs sit in sub-folders (`final_dataset/01_core_gad_searchable/...`).
The name is taken from our own corpus record and reduced to its last path part, so a request can never choose a path.
Search folders: `GOV_PDF_DIR` (default `data/raw`), `final_dataset/` of the repo, and any folders in `GOV_PDF_EXTRA_DIRS` (separated by `os.pathsep`: `;` on Windows).
"""
from __future__ import annotations

import os
import threading
from pathlib import Path

_lock = threading.Lock()
_index: dict[tuple[str, ...], dict[str, Path]] = {}


def search_roots(pdf_dir: Path, repo_root: Path) -> list[Path]:
    roots = [pdf_dir, repo_root / "final_dataset"]
    roots += [Path(p) for p in os.environ.get("GOV_PDF_EXTRA_DIRS", "").split(os.pathsep) if p.strip()]
    seen, out = set(), []
    for r in roots:
        if r.is_dir() and str(r.resolve()) not in seen:
            seen.add(str(r.resolve()))
            out.append(r)
    return out


def _build(roots: list[Path]) -> dict[str, Path]:
    found: dict[str, Path] = {}
    for root in roots:
        for p in root.rglob("*.pdf"):
            found.setdefault(p.name.lower(), p)   # first folder in the list wins
    return found


def find_pdf(source_pdf: str | None, pdf_dir: Path, repo_root: Path) -> Path | None:
    """The PDF file for a corpus record, or None."""
    if not source_pdf:
        return None
    name = Path(source_pdf.replace("\\", "/")).name
    if not name.lower().endswith(".pdf"):
        return None
    roots = search_roots(pdf_dir, repo_root)
    key = tuple(str(r.resolve()) for r in roots)
    with _lock:
        if key not in _index:
            _index[key] = _build(roots)
        idx = _index[key]
    hit = idx.get(name.lower())
    if hit is not None and hit.is_file():
        return hit
    return None


def reset_cache() -> None:
    with _lock:
        _index.clear()
