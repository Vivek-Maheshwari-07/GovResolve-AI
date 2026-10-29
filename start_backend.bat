@echo off
echo Starting GovResolve-AI Backend ...
cd /d "%~dp0"
python -m uvicorn backend.api.main:app --host 0.0.0.0 --port 8000 --reload

