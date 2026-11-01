@echo off
echo ========================================================
echo   GovResolve-AI (PS000230) — Live Assistant & Backend
echo ========================================================
echo   Web UI:     http://localhost:8000
echo   API Docs:   http://localhost:8000/docs
echo ========================================================
cd /d "%~dp0"
python -m uvicorn backend.api.main:app --host 0.0.0.0 --port 8000 --reload
