@echo off
title GovResolve-AI - Executive Command Center
cd /d "%~dp0"
echo ==============================================================
echo   GovResolve-AI (PS000230) - Startup Check
echo   Checking environment...
echo   Please ensure Ollama (qwen3.5:4b) is running in the background for local execution.
echo ==============================================================
if exist ".venv\Scripts\python.exe" (set PY=.venv\Scripts\python.exe) else (set PY=python)
%PY% run.py %*
pause
