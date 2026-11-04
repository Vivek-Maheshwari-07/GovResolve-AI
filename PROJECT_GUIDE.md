# 🏛️ GovResolve-AI: Complete Codebase Onboarding Guide (Hinglish)

> **Welcome to GovResolve-AI!** 👋  
> Yeh guide tumhe pure codebase ka crystal-clear architecture, data flow, tech stack aur implementation details samjhane ke liye banayi gayi hai. Jaise ek Senior Engineer ek final-year B.Tech student ko live project explain karta hai, bilkul waise hi simple Hinglish me breakdown kiya gaya hai.

---

## 1. PROJECT OVERVIEW

### Yeh Project Kya Karta Hai? (In Simple Words)
1. **The Problem:** Gujarat Government ke General Administration Department (GAD) me hazaro Government Resolutions (GRs), circulars aur notifications aate hain. Kisi specific rule (jaise maternity leave, pension, recruitment) ka *latest* aur *valid* GR dhundna bohot tedious aur time-consuming hota hai.
2. **The Solution (GovResolve-AI):** Yeh ek bilingual (Gujarati + English + Gujlish) AI assistant hai jo everyday language me puche gaye questions ko samajhta hai aur relevant GR dhund kar lata hai.
3. **No Hallucinations / 100% Grounded:** AI man se kuch bhi fekta nahi hai (no hallucinations); answer ke saath exact supporting document, verbatim (exact) passage quote, page number aur issue date deta hai.
4. **Lineage Tracking (Amended vs Superseded):** Purane GRs ko naye GRs ne amend (badla) ya supersede (cancel/replace) kiya hai ya nahi, yeh pura history graph track karta hai.
5. **Strict Grounding Rule:** Yeh system kabhi kisi document ko blindly "ACTIVE" nahi bolta. Agar future me koi change nahi mila toh bolta hai `"No later amendment found"` (kyunki government me kal subah naya GR aa sakta hai).

### Complete Tech Stack Used
* **Frontend:**
  * **Framework:** React 18 (SPA) with Vite
  * **Styling & UI:** Tailwind CSS, Lucide React (Icons), Framer Motion (Smooth animations)
  * **PDF Viewer & Highlighting:** `pdfjs-dist` (In-browser official PDF rendering with verbatim bounding-box highlight)
* **Backend:**
  * **Framework:** FastAPI (Python 3.10+ / 3.13) running on Uvicorn ASGI
  * **Data Validation:** Pydantic v2 (Strict request/response validation)
  * **PDF Extraction & OCR:** PyMuPDF (`fitz`) for digital PDFs & bounding boxes; Tesseract OCR (`pytesseract` with Gujarati `guj` + English `eng` traineddata) for scanned documents
* **Database & Indexing:**
  * **Relational DB:** SQLite (`data/govresolve.sqlite`) — lineage edges, query logs, manual overrides aur user feedback store karne ke liye.
  * **Vector Database:** ChromaDB (`data/index/chroma/chroma.sqlite3`) with HNSW index for dense semantic embeddings.
  * **Lexical / Keyword Index:** BM25Okapi (`rank_bm25` in `data/index/chroma/bm25_corpus.json`) with Gujarati stemmer.
* **AI / ML & NLP Libraries:**
  * **Dense Embeddings:** `intfloat/multilingual-e5-large` (multilingual Gujarati & English vectors)
  * **Hybrid Search & Fusion:** Reciprocal Rank Fusion (RRF) combining BM25 lexical scores + Dense vector similarity.
  * **Gujarati NLP:** Indic Transliteration (`indic_transliteration`), custom `GujlishNormalizer`, and custom Gujarati suffix stemmer (`gujarati_stemmer.py`).
  * **Reranker:** Cross-Encoder for precision reranking.
* **LLM Providers (Pluggable Architecture via `llm_gateway.py`):**
  * **Local / Offline:** Ollama (`qwen3.5:4b` or `bge-m3`)
  * **Hosted Cloud:** Groq API (`openai/gpt-oss-120b`, `llama-3.3-70b-versatile`)
  * **Google Cloud:** Gemini API (`gemini-2.0-flash` via `google-genai`)
  * **Deterministic Fallback:** Agar koi LLM nahi chal raha ho, toh zero-hallucination extractive engine seedha document ke exact relevant lines quote karke de deta hai without breaking!

---

## 2. FOLDER-BY-FOLDER EXPLANATION

Pure repository ka clean structure niche diya gaya hai:

```
GovResolve-AI/
├── .github/                      # CI/CD Workflows & Issue templates (OPTIONAL)
│   ├── workflows/ci.yml          # GitHub Actions CI build & test pipeline
│   ├── ISSUE_TEMPLATE/           # Bug report & feature templates
│   └── pull_request_template.md
├── backend/                      # Complete Python backend logic (ESSENTIAL)
│   ├── app/                      # FastAPI core, routers, lineage & DB state
│   │   ├── lineage/              # Clause-level lineage parser & status engine
│   │   ├── routers/              # Secondary API routes (/ask, /grs, /admin)
│   │   ├── schemas/              # Pydantic schemas (Request/Response models)
│   │   ├── services/             # High-level services (ask runner, vector stub)
│   │   ├── store/                # SQLite DB and JSON corpus loader
│   │   ├── config.py             # App environment configuration
│   │   ├── detector.py           # Language & metadata detector
│   │   ├── engine.py             # Abstract base classes for retrieval engines
│   │   ├── graph.py              # Document-level lineage contract graph
│   │   ├── main.py               # FastAPI app entry point & contract endpoints
│   │   ├── normalize.py          # Language detection & text normalization
│   │   ├── pdf_lookup.py         # Helper to locate local PDF files on disk
│   │   ├── security.py           # Hardening headers & input security middleware
│   │   ├── seed.py               # Demo fixtures loader
│   │   ├── squad2_bridge.py      # Adapter between contract API & RAG pipeline
│   │   ├── squad2_runtime.py     # Lazy pre-warming & pipeline runner
│   │   └── state.py              # Global application state (singleton)
│   ├── ingestion/                # PDF parsing & OCR extraction pipelines (ESSENTIAL)
│   │   └── ingest.py             # Converts PDF to chunked JSON records
│   ├── lineage/                  # Legacy/alternate lineage graph (UNUSED / DUPLICATE)
│   │   └── lineage_graph.py      # Deprecated Squad 2 graph (replaced by app/lineage)
│   ├── rag/                      # Core search, retrieval & LLM generation (ESSENTIAL)
│   │   ├── providers/            # LLM provider clients (Ollama, Groq, Gemini, OpenAI)
│   │   ├── gujarati_stemmer.py   # Rule-based Gujarati stemmer for BM25
│   │   ├── gujlish_normalizer.py # Transliteration & Secretariat glossary expansion
│   │   ├── llm_gateway.py        # Unified interface for all LLM calls + fallback
│   │   └── search_engine.py      # Hybrid RAG pipeline (BM25 + Chroma + RRF + Grounding)
│   ├── scripts/                  # Data preparation & evaluation scripts (ESSENTIAL FOR SETUP)
│   │   ├── build_corpus.py       # Converts folder of PDFs to JSON corpus
│   │   ├── build_squad2_index.py # Builds BM25 + Chroma indexes
│   │   ├── build_lineage.py      # Extracts edges across JSON corpus
│   │   ├── pdf_to_gr_json.py     # Batch converts PDFs to GR JSON
│   │   └── scorecard.py          # Evaluates performance metrics
│   ├── tests/                    # 200+ unit & integration tests (ESSENTIAL)
│   ├── API_CONTRACT.md           # Frozen API specification
│   ├── IMPLEMENTATION_PLAN.md    # Squad architecture & integration history
│   └── requirements.txt          # Backend dependencies
├── config/                       # Administrative glossaries (ESSENTIAL)
│   ├── gad_glossary.json         # Administrative English-Gujarati dictionary
│   └── glossary.yaml             # Domain-specific terms & acronyms
├── data/                         # Runtime data, indices & databases (ESSENTIAL)
│   ├── corpus_v2/                # 366 indexed official GR JSON documents
│   ├── fixtures/                 # 23 synthetic test documents for offline demo (OPTIONAL)
│   ├── index/                    # Active search indexes (Chroma vector + BM25 JSON)
│   ├── tessdata/                 # Tesseract OCR language files (eng, guj, osd)
│   └── govresolve.sqlite         # SQLite DB storing 749 extracted lineage edges
├── docs/                         # Project proposals, architecture PDFs & notes (OPTIONAL)
│   ├── GovResolve-AI_HLD_LLD.pdf # High-Level & Low-Level Design doc
│   ├── LLM_PROVIDERS.md          # Setup instructions for Ollama, Groq, Gemini
│   ├── REQUIREMENTS_TRACEABILITY.md # Tracking PS000230 requirements
│   └── PS.txt / PS230.pdf        # Official hackathon problem statement
├── eval/                         # Evaluation datasets & test scorecards (OPTIONAL)
│   ├── evaluate.py               # Benchmark runner against gold questions
│   ├── gold_questions.json       # Questions used to test accuracy
│   └── gold_lineage_verified.csv # Ground-truth amendment pairs
├── final_dataset/                # 515 Official raw PDF documents & manifests (ESSENTIAL)
│   ├── 01_core_gad_searchable/   # 247 digital GAD PDFs (Main corpus)
│   ├── 02_extension_panchayat/   # 103 Panchayat department amendment PDFs
│   ├── 03_scanned_ocr_sample/    # 40 scanned GAD PDFs (requires Tesseract)
│   ├── 04_friend_supplement/     # 45 supplemental PDFs from WhatsApp source
│   ├── 05_corpus_supplement/     # 80 additional supplementary PDFs
│   ├── DATA_CARD.md              # Provenance & scraping details
│   └── manifest.csv              # Full metadata & source URLs of all PDFs
├── frontend/                     # React Single Page Application (ESSENTIAL)
│   ├── src/
│   │   ├── components/           # UI widgets (AnswerCard, PdfInspector, LineageGraph, etc.)
│   │   ├── lib/                  # Helper utilities (lineage calculation, sample queries)
│   │   ├── pages/                # Landing page (Hero) & interactive tour
│   │   ├── api.js                # Frontend API client communicating with backend
│   │   └── App.jsx               # Root React application container
│   ├── package.json              # Frontend npm dependencies
│   └── vite.config.js            # Vite build configuration with API proxy
├── unwanted/                     # Stale experimental artifacts (UNUSED / SAFE TO DELETE)
│   ├── data/vector/              # Outdated Chroma database from earlier build
│   └── eval/                     # Outdated scorecard runs and old CSVs
├── .env.example                  # Environment configuration template (ESSENTIAL)
├── Makefile                      # Command shortcuts (make test, make lint, etc.) (OPTIONAL)
├── run.py                        # Single-command launcher for whole system (ESSENTIAL)
└── start.bat                     # Double-click launcher for Windows (ESSENTIAL)
```

### Categorization & Dead Code Audit

| Category | Folders / Files | Reason |
| :--- | :--- | :--- |
| **ESSENTIAL** | `backend/app/`, `backend/rag/`, `backend/ingestion/`, `data/corpus_v2/`, `data/index/`, `data/tessdata/`, `data/govresolve.sqlite`, `final_dataset/`, `frontend/src/`, `run.py`, `start.bat`, `.env.example`, `requirements.txt` | Core engine, UI, database, active indices, and PDFs needed for runtime operation. |
| **OPTIONAL** | `data/fixtures/` (synthetic demo data), `eval/` (benchmark tests), `docs/` (documentation), `.github/` (CI), `backend/scripts/` (only needed when rebuilding data from scratch). | App works fine without them during daily usage; needed for benchmarks or docs. |
| **UNUSED / SAFE TO DELETE** | 1. **`unwanted/` folder**: Contains 100+ MB of stale Chroma files and old scorecards.<br>2. **`backend/lineage/lineage_graph.py`**: Duplicate/legacy graph code from Squad 2. Squad 3 replaced this with `backend/app/lineage/` and `backend/app/graph.py`.<br>3. **`backend/.pytest_cache/` & `backend/__pycache__/`**: Standard temporary test caches. | Safe to delete without affecting backend or frontend execution. |

---

## 3. DATA AND DATASET

### Exact Paths Where Data Is Stored
* **Official Raw PDFs:** `d:\GovResolve-AI\final_dataset\` (Total **515 PDF files** distributed across 5 subfolders).
* **Processed JSON Corpus:** `d:\GovResolve-AI\data\corpus_v2\` (Total **366 JSON files** with metadata, paragraphs, and bounding boxes).
* **Lineage & Graph SQLite DB:** `d:\GovResolve-AI\data\govresolve.sqlite` (Table `edges` contains **749 relationships** between GRs).
* **Search Indices:** `d:\GovResolve-AI\data\index\chroma\` (`chroma.sqlite3` for dense vectors + `bm25_corpus.json` for keyword search).

### Data Kaha Se Aaya? (Provenance & Origin)
* **Real Government Portals:** Yeh data koi dummy text nahi hai. Isko directly Gujarat Government ki official public portals se harvest kiya gaya hai:
  1. GAD (Personnel Department): `https://gad.gujarat.gov.in/Personnel/government-resolutions.htm`
  2. Panchayat & Rural Development: `https://panchayat.gujarat.gov.in/gu/government-resolutions`
* Har ek PDF ka original source URL, listing page, SHA-256 hash aur detected date `final_dataset/manifest.csv` me recorded hai.
* **Tier 04 (`04_friend_supplement`):** Isme 45 PDFs ek peer/friend ke WhatsApp dump (`gad_g2.zip`) se liye gaye the, jinki portal URLs officially re-verify nahi ho saki thi (isliye inko unverified supplement rakha gaya hai).

### Kitna Bada Dataset Hai?
* **515 Official PDFs** (~640 MB).
* **366 Active JSON GRs** indexed in `corpus_v2`.
* **749 Lineage Edges** in SQLite (`REFERS`, `AMENDS`, `SUPERSEDES`, `SUBSTITUTES`, `CLARIFIES`).

### Real Hai Ya Fake? (Honest Assessment)
* **Documents & PDFs:** **100% REAL.** Official Gujarat Government ke notifications, circulars aur resolutions hain.
* **Lineage Graph:** **REAL.** Engine ne actual circulars ki reading lines (e.g. *"In supersession of Resolution dated..."*) ko parse karke 749 edges nikale hain.
* **Evaluation Questions (`eval/gold_questions.json`):** **SYNTHETIC / AI-GENERATED.** Real Gujarat government officers ne questions validate nahi kiye; unhe Claude AI se draft karwaya gaya tha benchmarking ke liye.

---

## 4. END-TO-END FLOW (STEP-BY-STEP)

Jab user search bar me query type karta hai (e.g., *"What is the qualifying service for full pension?"* ya *"પેન્શન માટે લઘુત્તમ સેવા કેટલી?"*), toh flow aise chalta hai:

### Step 1: User Types Query & Frontend Initiates Request
* **File:** `frontend/src/components/QueryDock.jsx` or `frontend/src/pages/hero/Sections.jsx`
* User question type karke Enter ya Submit dabata hai.
* Function `ask(question, language)` call hota hai jo `frontend/src/api.js` me hai.

### Step 2: HTTP POST to Backend
* `api.js` backend ko POST request bhejta hai:
  * **Endpoint:** `POST /query` (Defined in `backend/app/main.py`)
  * **Payload:** `{"question": "What is the qualifying service...", "language": "en"}`

### Step 3: API Gateway & Language Detection
* **File:** `backend/app/main.py` -> Function: `query(req: QueryRequest)`
* Agar language specify nahi hai, toh `detect_language()` run hota hai (identifies English vs Gujarati script).
* Call pass hoti hai `engine.answer(question, language)`.

### Step 4: LazySquad2Engine & Pipeline Activation
* **File:** `backend/app/squad2_runtime.py` -> Class: `LazySquad2Engine`
* Yeh bridge Squad 2 ke hybrid search pipeline `backend.rag.search_engine.RAGPipeline` ko call karta hai.

### Step 5: Query Normalization & Bilingual Expansion
* **File:** `backend/rag/gujlish_normalizer.py` -> Function: `reformulate(question)`
* Agar user ne Gujlish ("pension na niyamo") likha hai, toh yeh transliteration dictionary aur `gad_glossary.json` use karke Gujarati aur English dono terms expand karta hai (SearchBundle).

### Step 6: Hybrid Retrieval (BM25 + Chroma Vector)
* **File:** `backend/rag/search_engine.py` -> Class: `GRIndex`
  1. **Lexical Search (BM25):** `tokenize_for_bm25()` Gujarati suffixes hata kar BM25Okapi se top matching chunks nikalta hai.
  2. **Dense Vector Search:** ChromaDB me Multilingual-E5 embeddings se semantic top-K chunks dhunde jate hain.
  3. **Reciprocal Rank Fusion (RRF):** Dono ranking lists ko mathematically merge karke top candidate passages select kiye jate hain.

### Step 7: Lineage Injection (Outdated Rule Prevention)
* **File:** `backend/app/squad2_runtime.py` -> Class: `OurLineageAdapter`
* Retrieval me aaye huye har GR ka status SQLite graph (`govresolve.sqlite`) me check hota hai.
* Agar koi GR **AMENDED** ya **SUPERSEDED** hai, toh engine latest amending GR ko bhi context me pull karta hai taaki outdated rule ka galat answer generate na ho!

### Step 8: LLM Generation & Verbatim Grounding
* **File:** `backend/rag/llm_gateway.py` -> Function: `execute_llm_generation()`
* Retrieved passages ko numbered sentences `[S1]`, `[S2]`, `[S3]` me pack karke LLM (Groq / Ollama / Gemini) ko bheja jata hai.
* LLM ko strict prompt hota hai: *"Answer ONLY using sentence numbers [S1], [S2]. Do not hallucinate."*
* **Safety Fallback:** Agar system me koi LLM connect nahi hai, toh zero-shot deterministic extractive ranker seedha highest matching sentence ko verbatim quote karke return kar deta hai (system fail nahi hota!).

### Step 9: Post-Processing & Verification
* Engine check karta hai ki LLM ne jo quotes diye hain woh document me word-to-word match hote hain ya nahi.
* Claims ko label kiya jata hai: `ESTABLISHED` (document me directly mila), `INFERRED` (logical inference), ya `NOT_FOUND`.

### Step 10: Response Assembly & Frontend Rendering
* **File:** `backend/app/main.py`
* Response assemble hota hai: `verdict` (`answered` / `insufficient_evidence`), `answer`, `citations` (with document metadata, page number, verbatim quote, aur bounding box `[x0, y0, x1, y1]`).
* Frontend ko JSON response wapas milta hai.
* **File:** `frontend/src/components/AnswerCard.jsx`
  * Answer render hota hai.
  * `TrustShield.jsx` dikhata hai ki kitne quotes verbatim verify huye aur kitne GRs consult kiye gaye.
  * `LineageGraph.jsx` historical amendment chain draw karta hai.
  * User kisi citation pe click karta hai toh `frontend/src/components/PdfInspector.jsx` background se `/grs/{doc_id}/pdf` fetch karke exact page par yellow highlight box draw kar deta hai!

---

### Mermaid Flow Diagram

```mermaid
sequenceDiagram
    autonumber
    actor User as User (Officer / Citizen)
    participant UI as Frontend (React / QueryDock)
    participant API as FastAPI Backend (/query)
    participant Norm as Gujlish Normalizer
    participant Hybrid as Hybrid Search (BM25 + Chroma)
    participant Lineage as Lineage Graph (SQLite)
    participant LLM as LLM Gateway (Groq / Ollama / Fallback)
    participant PDF as PDF Inspector (pdfjs-dist)

    User->>UI: Types query ("Full pension qualifying service?")
    UI->>API: POST /query {question, language}
    API->>Norm: Reformulate & expand Gujlish/Gujarati terms
    Norm-->>API: Bilingual Search Bundle
    API->>Hybrid: Search BM25 (tokens) + Dense Vectors (Chroma)
    Hybrid-->>API: Top Candidate Chunks
    API->>Lineage: Check GR Status (Is it Amended or Superseded?)
    Lineage-->>API: Status + Inject Latest Amending GRs
    API->>LLM: Prompt with [S1], [S2] numbered sentences
    LLM-->>API: Grounded Answer + Sentence-ID Citations
    API->>API: Verbatim Quote Verification & Bounding Box lookup
    API-->>UI: QueryResponse (Answer, Citations, BBoxes, Lineage)
    UI->>User: Displays AnswerCard + Trust Shield
    opt User clicks Citation
        UI->>PDF: Fetch /grs/{doc_id}/pdf
        PDF-->>UI: Render official PDF with highlighted yellow box
    end
```

---

## 5. HOW TO RUN THE PROJECT

### Step 1: Clone and Setup Virtual Environment
PowerShell ya Command Prompt me run karein:
```powershell
# 1. Repo directory me aayein
cd d:\GovResolve-AI

# 2. Python virtual environment create karein (Python 3.10 to 3.13)
python -m venv .venv

# 3. Virtual environment activate karein
.venv\Scripts\activate

# 4. Python dependencies install karein
pip install -r requirements.txt
```

### Step 2: Setup Frontend
```powershell
cd frontend
npm install
npm run build
cd ..
```

### Step 3: Configure Environment Variables
Root directory me `.env` file banayein (`.env.example` ko copy karke):
```powershell
copy .env.example .env
```
Apni `.env` file me provider choose karein:
* **Option A: Free Cloud LLM (Fastest & Recommended - Groq):**
  ```env
  LLM_PROVIDER=groq
  GROQ_API_KEY=gsk_your_actual_groq_api_key_here
  GROQ_MODEL=openai/gpt-oss-120b
  ```
* **Option B: 100% Local Offline (Ollama):**
  Install Ollama and run: `ollama pull qwen3.5:4b`
  ```env
  LLM_PROVIDER=ollama
  OLLAMA_MODEL=qwen3.5:4b
  ```
* **Option C: Deterministic Fallback (No Key, No Model):**
  ```env
  LLM_PROVIDER=none
  ```
  *(App will extract exact quotes without hallucinating).*

### Step 4: Run the Application!
Root folder se single command chalayein:
```powershell
python run.py
```
*(Windows user chahein toh direct `start.bat` par double-click kar sakte hain).*

Browser automatic open ho jayega at:  
👉 **Web Application:** `http://127.0.0.1:8000`  
👉 **Interactive API Docs (Swagger):** `http://127.0.0.1:8000/docs`

---

## 6. PROBLEMS AND GAPS (HONEST REVIEW)

Problem Statement (PS000230) ke against analyze karne par codebase me yeh gaps aur issues hain:

### Gaps Against PS000230
1. **Unverified Evaluation Questions:** Problem statement me bola tha *"officer-validated questions and answers"*. Repository me jo `gold_questions.json` hai, woh Claude AI se generate kiya gaya hai, kisi real Gujarat Secretariat officer ne sign-off nahi kiya.
2. **Limited Department Coverage:** Portal scraping sirf **GAD (General Administration Department)** aur **Panchayat Department** tak limited rahi. Gujarat ke baaki important departments jaise Finance, Revenue, Health, aur Education ke GRs missing hain. Is wajah se bohot se references `"BROKEN_CHAIN"` (target GR missing from corpus) ban jaate hain.
3. **No Multi-turn Chat Memory:** User ek question puchne ke baad agar follow-up puchta hai (*"Aur iska exception kya hai?"*), toh system purana context yaad nahi rakhta. Har question standalone treat hota hai.

### Bugs, Broken Features & Risks
1. **Negation & Proposal False-Positives in Lineage (Design Finding F1):** Lineage engine regex-based patterns use karta hai. Agar document me likha ho *"The proposal to supersede Resolution X was rejected"*, toh regex word *"supersede Resolution X"* dekh kar galat `SUPERSEDES` edge bana deta hai.
2. **Lossy Gujarati Text Layer in Older PDFs:** Kuch purane Gujarati PDFs me non-standard legacy fonts use huye the, jisse extracted text garbled ho jata hai (jaise `રાજ્ય` ban jata hai `રાય`). Tesseract OCR se re-run na karne par BM25 matching fail ho sakti hai.
3. **Dead / Duplicate Code Leftover:** `backend/lineage/lineage_graph.py` pura unused pada hai kyunki Squad 3 ne naya lineage engine `backend/app/lineage/` banaya tha. Similarly `unwanted/` folder me 100MB+ purane Chroma vector database files aur discarded CSVs bhare huye hain.

### Top 5 Recommended Improvements (In Priority Order)
1. **Priority 1: Multi-Turn Conversation Memory:** Frontend aur Backend `/query` me conversation history session array pass karo taaki users context-aware follow-up questions puch sakein.
2. **Priority 2: Filter Negation & Context in Regex Lineage:** Regex extractor me negative lookaheads ya dependency parsing lagao taaki *"proposal to supersede"*, *"rejected"*, ya *"draft"* phrases false edges na banayein.
3. **Priority 3: Multi-Department Data Ingestion:** Finance (FD) aur Revenue (RD) departments ke resolutions scrape karke corpus 366 se 2,000+ GRs tak expand karo taaki `"BROKEN_CHAIN"` issue 80% decrease ho jaye.
4. **Priority 4: Indic-Specific Vision OCR for Gujarati:** Standard Tesseract ki jagah DocTr ya Indic-OCR model integrate karo jo legacy Gujarati typography ko bina spelling mistakes ke 99% accuracy ke sath extract kar sake.
5. **Priority 5: Clean Up Technical Debt & Dead Files:** `unwanted/` folder aur deprecated `backend/lineage/lineage_graph.py` ko delete karke repo ko clean aur lightweight rakho.

---

## 7. QUICK REFERENCE SUMMARY

* **Core Entry Point:** `run.py` (orchestrates Vite build, FastAPI ASGI, Chroma and static file serving).
* **Search Brain:** `backend/rag/search_engine.py` (Hybrid BM25 + Dense E5 + Lineage Injection).
* **Lineage Database:** `data/govresolve.sqlite` (Holds the 749 verified amendment edges).
* **Primary API Contract:** `POST /query` in `backend/app/main.py`.
* **Official Data:** `final_dataset/` (515 official government PDFs).

*All tests verified passing (`python -m pytest backend/tests/test_squad2_bridge.py` and `npm test` in frontend).*

