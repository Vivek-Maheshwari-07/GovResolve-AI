# syntax=docker/dockerfile:1
# GovResolve-AI: API + built web app in one image.  docker compose up   (see docker-compose.yml)

# ---- build the web app --------------------------------------------------------------------------------------------------
FROM node:20-alpine AS ui
WORKDIR /ui
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---- run the API --------------------------------------------------------------------------------------------------------
FROM python:3.12-slim AS app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
# Tesseract with English and Gujarati data, for OCR when a corpus is built inside the container; curl for the health check
RUN apt-get update \
 && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng tesseract-ocr-guj curl \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt ./
RUN pip install -r requirements.txt
COPY backend ./backend
COPY config ./config
COPY data/fixtures ./data/fixtures
COPY run.py ./
COPY --from=ui /ui/dist ./frontend/dist
RUN useradd --create-home --uid 10001 app && chown -R app:app /app
USER app
WORKDIR /app/backend
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 CMD curl -fsS http://localhost:8000/health || exit 1
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
