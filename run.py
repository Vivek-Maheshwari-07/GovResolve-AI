"""
GovResolve-AI — One-Click Server Launcher
Run with: python run.py
"""
import os
import sys
from pathlib import Path

# Ensure working directory is always the project root
PROJECT_ROOT = Path(__file__).resolve().parent
os.chdir(PROJECT_ROOT)
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

banner = """
==============================================================
  GovResolve-AI Server
  Bilingual Government Resolution RAG System
==============================================================
  Web Dashboard:   http://localhost:8000
  API Docs (Docs): http://localhost:8000/docs
  Health Check:    http://localhost:8000/api/health
==============================================================
"""

if __name__ == "__main__":
    print(banner)
    import uvicorn
    uvicorn.run("backend.api.main:app", host="0.0.0.0", port=8000, reload=True)

