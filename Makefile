# GovResolve-AI developer shortcuts. `make help` lists them.
PY      ?= python3
CORPUS  ?= data/corpus_v2
.DEFAULT_GOAL := help

.PHONY: help install install-dev ui run demo llm-check index test test-backend test-frontend lint docker-build docker-up docker-up-ollama docker-down clean

help:  ## Show this help
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install:  ## Install runtime dependencies (Python + web app)
	$(PY) -m pip install -r requirements.txt
	cd frontend && npm ci

install-dev:  ## Install development dependencies (tests, linter)
	$(PY) -m pip install -r requirements-dev.txt
	cd frontend && npm ci

ui:  ## Build the web app into frontend/dist (served by the API)
	cd frontend && npm run build

run:  ## Start the app on http://127.0.0.1:8000 (real collection if found, else demo fixtures)
	$(PY) run.py

demo:  ## Start with the synthetic demo documents only (no corpus, no model needed)
	cd backend && SFIC_SEED=1 $(PY) -m uvicorn app.main:app --port 8000

llm-check:  ## Check Ollama / Groq configuration, reachability and speed
	$(PY) -m backend.scripts.llm_smoke

index:  ## Build the search index from a corpus folder (slow with a CPU embedder). CORPUS=data/corpus_v2
	cd backend && $(PY) -m scripts.build_squad2_index --corpus ../$(CORPUS) --index ../data/index/chroma

test: test-backend test-frontend  ## Run all tests

test-backend:  ## Backend tests (pytest)
	cd backend && $(PY) -m pytest -q

test-frontend:  ## Frontend tests
	cd frontend && npm test

lint:  ## Lint the Python code (pyflakes rules via ruff)
	$(PY) -m ruff check backend run.py scripts tests

docker-build:  ## Build the application image
	docker compose build

docker-up:  ## Run the API in Docker (use Groq, or an Ollama you already run). Needs GOV_ADMIN_TOKEN in .env
	docker compose up -d

docker-up-ollama:  ## Run the API plus an Ollama container, and pull the models once
	docker compose --profile ollama up -d
	docker compose --profile init run --rm ollama-pull

docker-down:  ## Stop the containers
	docker compose --profile ollama --profile init down

clean:  ## Remove build output and caches
	rm -rf frontend/dist .ruff_cache .pytest_cache backend/.pytest_cache
	find . -name __pycache__ -type d -prune -exec rm -rf {} +
