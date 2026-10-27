from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="GOV_", env_file=".env", extra="ignore")

    version: str = "0.1.0"
    data_dir: Path = ROOT / "data"
    corpus_dir: Path = ROOT / "data" / "fixtures"
    pdf_dir: Path = ROOT / "data" / "raw"
    db_path: Path = ROOT / "data" / "govresolve.sqlite"
    vector_dir: Path = ROOT / "data" / "vector"
    # "hash" = offline deterministic embedder (demo/tests); otherwise a sentence-transformers
    # model name, e.g. "intfloat/multilingual-e5-small"
    embed_model: str = "hash"
    lineage_engine: str = "auto"  # auto = real engine if importable | real | stub
    stub_edges: Path | None = None  # seed edges for the stub engine (tests, demos)
    cors_origins: list[str] = ["*"]


settings = Settings()
