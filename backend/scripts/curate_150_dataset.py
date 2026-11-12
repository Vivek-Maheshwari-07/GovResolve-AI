"""
GovResolve-AI — Golden 150-Dataset Curator & Ingester

Picks exactly 150 high-impact resolutions and notifications:
  - 103 Panchayat & Rural Housing amendments (dense amendment chains)
  - 25 Core GAD Government Resolutions (Leave, LTC, Pension, Pay, Service rules)
  - 12 Core GAD Circulars
  - 10 Historical Scanned Photocopies (Dual-pipeline OCR verification)
"""
import shutil
import sys
from pathlib import Path
from loguru import logger

PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))

from scripts.ingest_accurate import ingest_dataset

SOURCE_DIR = PROJECT_ROOT / "final_dataset"
TARGET_GRS = PROJECT_ROOT / "data" / "grs"
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"
CHROMA_DIR = PROJECT_ROOT / "data" / "index" / "chroma"
GRAPH_PATH = PROJECT_ROOT / "data" / "index" / "lineage_graph.json"


def curate_and_ingest():
    logger.info("=== STEP 1: Curating exactly 150 documents for SFIC-PS000230 ===")

    # 1. Gather files
    panchayat_files = sorted(list((SOURCE_DIR / "02_extension_panchayat_amendments").rglob("*.pdf")))
    gad_gr_files = sorted(list((SOURCE_DIR / "01_core_gad_searchable" / "government-resolutions").glob("*.pdf")))
    gad_circ_files = sorted(list((SOURCE_DIR / "01_core_gad_searchable" / "circulars").glob("*.pdf")))
    scanned_files = sorted(list((SOURCE_DIR / "03_scanned_ocr_sample_gad").rglob("*.pdf")))

    selected_files = []

    # 103 Panchayat amendments (high amendment density)
    selected_files.extend(panchayat_files[:103])

    # 25 GAD GRs
    selected_files.extend(gad_gr_files[:25])

    # 12 GAD Circulars
    selected_files.extend(gad_circ_files[:12])

    # 10 Scanned Historical Photocopies
    selected_files.extend(scanned_files[:10])

    assert len(selected_files) == 150, f"Expected 150 files, got {len(selected_files)}"
    logger.success(f"Curated {len(selected_files)} files across 4 categories.")

    # 2. Reset target directories for clean build
    logger.info("=== STEP 2: Preparing data directories ===")
    if TARGET_GRS.exists():
        shutil.rmtree(TARGET_GRS)
    TARGET_GRS.mkdir(parents=True, exist_ok=True)

    if PROCESSED_DIR.exists():
        shutil.rmtree(PROCESSED_DIR)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    # 3. Copy files to data/grs
    for p in selected_files:
        rel_folder = p.parent.name
        dest_dir = TARGET_GRS / rel_folder
        dest_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(p, dest_dir / p.name)

    logger.success(f"Copied 150 PDFs to {TARGET_GRS.resolve()}")

    # 4. Run accurate ingestion
    logger.info("=== STEP 3: Executing High-Accuracy Ingestion Pipeline ===")
    ingest_dataset(
        dir_path=str(TARGET_GRS),
        processed_dir=str(PROCESSED_DIR),
        index_dir=str(CHROMA_DIR),
        graph_path=str(GRAPH_PATH),
    )


if __name__ == "__main__":
    curate_and_ingest()
