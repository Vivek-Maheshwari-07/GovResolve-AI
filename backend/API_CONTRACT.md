# SFIC API contract (v0.1, Squad 3)

Base URL (dev): `http://localhost:8000`. Interactive docs: `/docs`. CORS is open. JSON everywhere, UTF-8.
Run with demo data: `SFIC_SEED=1 uvicorn app.main:app --reload` (demo docs are synthetic, ids start `demo-`).

## Conventions

- **Pages are 1-based**, dates are ISO (`2018-05-20`).
- **`doc_id`** is a stable string chosen by Squad 1 (e.g. `gr-2021-130`). It is also the key the UI uses to open the PDF.
- **Edge direction:** `source` is the newer document that acts on `target` (the older one). `relation` is one of `amends`, `replaces`, `supersedes`, `cancels`, `refers_to`.
- **Lineage status:** `superseded` | `amended` | `no_later_amendment_found` | `unknown`.
  There is no "active" status: finding no later order in our corpus does not prove a rule is in force.
- **External stubs:** a GR that is referenced but not ingested appears as a node with `is_external: true` and an id like `ext:gad201845:2018-05-20`. It has no PDF; show it greyed out as "not in corpus".
- **Evidence** (`{page, quote}`) is a verbatim sentence from the page text Squad 1 sent.

---

## Squad 1: ingestion

### `POST /documents`
Send one document with its text per page. Safe to call again for the same `doc_id` (its outgoing links are recomputed). Order of ingestion does not matter: links to documents that arrive later are connected automatically.

Request (only `doc_id` and `pages` are required; fill the rest when known):
```json
{
  "doc_id": "gr-2021-130",
  "gr_number": "GAD-2021-130",
  "department": "General Administration Department",
  "subject": "Revised leave provisions",
  "issue_date": "2021-08-02",
  "language": "en",
  "pdf_url": "/pdfs/gr-2021-130.pdf",
  "pages": [
    { "page": 1, "text": "This Resolution supersedes GR No. GAD-2018-45 dated 20/05/2018." }
  ]
}
```
Response:
```json
{
  "doc_id": "gr-2021-130",
  "edges_added": [
    {
      "source": "gr-2021-130",
      "target": "ext:gad201845:2018-05-20",
      "relation": "supersedes",
      "evidence": { "page": 1, "quote": "This Resolution supersedes GR No. GAD-2018-45 dated 20/05/2018." },
      "warnings": []
    }
  ],
  "unresolved": [],
  "external_stubs_created": ["ext:gad201845:2018-05-20"],
  "warnings": []
}
```
- `unresolved`: places where a cancel/supersede/amend phrase was found but no GR number or date was in the same sentence. Each has `relation`, `page`, `quote`, `reason`. Please review these by hand.
- `warnings`: e.g. a reference matched only approximately (likely an OCR slip).

What Squad 1 should send: text with Gujarati or ASCII digits (both work), one entry per page, **exact page numbering of the PDF**, and the extracted `gr_number` and `issue_date` (matching depends on them). Send the text as OCR'd, without cleaning it, so quotes stay verbatim.

### `GET /documents` , `GET /documents/{doc_id}`
List returns an array of metadata (real documents only). Detail returns:
```json
{
  "meta": { "doc_id": "demo-2018-045", "gr_number": "DEMO-GAD-2018-045", "department": "General Administration Department", "subject": "[DEMO] Maternity leave: documents required", "issue_date": "2018-05-20", "language": "en", "pdf_url": null, "is_external": false },
  "lineage": { "doc_id": "demo-2018-045", "status": "superseded", "summary": "Superseded by DEMO-GAD-2021-130 dated 2021-08-02.", "acted_on_by": [], "latest_doc_ids": ["demo-2021-130"], "notes": [] }
}
```
Unknown id returns `404`.

---

## Squad 4: UI

### `GET /lineage/{doc_id}`
The whole chain the document belongs to, for the timeline view.
```json
{
  "root": "demo-2018-045",
  "nodes": [
    { "meta": { "doc_id": "demo-2014-001", "gr_number": "DEMO-GAD-2014-001", "issue_date": "2014-03-12", "is_external": false }, "status": "amended" },
    { "meta": { "doc_id": "demo-2018-045", "gr_number": "DEMO-GAD-2018-045", "issue_date": "2018-05-20", "is_external": false }, "status": "superseded" },
    { "meta": { "doc_id": "demo-2021-130", "gr_number": "DEMO-GAD-2021-130", "issue_date": "2021-08-02", "is_external": false }, "status": "no_later_amendment_found" }
  ],
  "edges": [
    {
      "source": "demo-2018-045", "target": "demo-2014-001", "relation": "amends",
      "evidence": { "page": 2, "quote": "In partial modification of GR No. DEMO-GAD-2014-001 dated 12/03/2014, a medical certificate shall be submitted with the leave application." },
      "warnings": []
    },
    {
      "source": "demo-2021-130", "target": "demo-2018-045", "relation": "supersedes",
      "evidence": { "page": 1, "quote": "This Resolution supersedes GR No. DEMO-GAD-2018-045 dated 20/05/2018." },
      "warnings": []
    }
  ],
  "timeline": ["demo-2014-001", "demo-2018-045", "demo-2021-130"]
}
```
(Node `meta` is abbreviated above; the real response includes all meta fields.)
- **Use `timeline` for left-to-right order**; `nodes` is unordered.
- `edges[].evidence` is what to show when a user clicks a link (and to jump the PDF to that page).
- `edges[].warnings` may contain `date_conflict: ...` (the link looks wrong, draw it dashed) or `date_unverified: ...`.
- Suggested status styling: `superseded` red, `amended` amber, `no_later_amendment_found` neutral (not green, it does not mean "current"), `unknown` grey.

### `GET /lineage/{doc_id}/status`
One document's status, used for badges.
```json
{
  "doc_id": "demo-2014-001",
  "status": "amended",
  "summary": "Amended by DEMO-GAD-2018-045 dated 2018-05-20.",
  "acted_on_by": [
    {
      "source": "demo-2018-045", "target": "demo-2014-001", "relation": "amends",
      "evidence": { "page": 2, "quote": "In partial modification of GR No. DEMO-GAD-2014-001 dated 12/03/2014, a medical certificate shall be submitted with the leave application." },
      "warnings": []
    }
  ],
  "latest_doc_ids": ["demo-2018-045"],
  "notes": [
    "Amending order demo-2018-045 is itself superseded; check its successor.",
    "Based only on the 4 ingested documents; the absence of a later order here does not prove the rule is still in force."
  ]
}
```
Show `summary` as the badge text and `notes` in the detail panel. For `superseded`, `latest_doc_ids` are the documents to look at instead.

### `POST /query`
Request:
```json
{ "question": "પ્રસૂતિ રજા માટે કયા documents જોઈએ?", "language": null }
```
`language` is optional (`gu`, `en`, `mixed`); if omitted it is detected and echoed back in the response.

Response when answered:
```json
{
  "verdict": "answered",
  "answer": "A medical certificate must be submitted with the leave application.",
  "citations": [
    {
      "doc_id": "demo-2018-045",
      "page": 2,
      "quote": "a medical certificate shall be submitted with the leave application",
      "issue_date": "2018-05-20",
      "bbox": [72.0, 410.5, 520.0, 438.0],
      "lineage": {
        "doc_id": "demo-2018-045",
        "status": "superseded",
        "summary": "Superseded by DEMO-GAD-2021-130 dated 2021-08-02.",
        "acted_on_by": [ { "source": "demo-2021-130", "target": "demo-2018-045", "relation": "supersedes", "evidence": { "page": 1, "quote": "This Resolution supersedes GR No. DEMO-GAD-2018-045 dated 20/05/2018." }, "warnings": [] } ],
        "latest_doc_ids": ["demo-2021-130"],
        "notes": ["Latest instruction(s) in the corpus: demo-2021-130."]
      }
    }
  ],
  "warnings": [
    "demo-2018-045 is superseded (Superseded by DEMO-GAD-2021-130 dated 2021-08-02.); this passage may no longer apply."
  ],
  "reason": null,
  "language": "mixed"
}
```
Response when refused (no answer, no valid citation, or unknown cited document):
```json
{
  "verdict": "insufficient_evidence",
  "answer": null,
  "citations": [],
  "warnings": [],
  "reason": "The available documents do not support an answer.",
  "language": "en"
}
```
UI rules: if `verdict` is `insufficient_evidence`, show the refusal and `reason`, never an answer. Always render `warnings` visibly next to the answer. `bbox` is optional and passed through from Squad 2 (the UI owns the coordinate convention, agree it with Squad 2).

### Other
- `GET /edges`: every edge in the graph (debugging).
- `GET /health`: `{"status": "ok", "documents": 4}`.

---

## Squad 2: answer engine

Squad 3 calls your engine inside `POST /query`. Implement one method (Python, see `app/engine.py`):

```python
class AnswerEngine(Protocol):
    def answer(self, question: str, language: str) -> EngineResult: ...

class EngineResult(BaseModel):
    answer: str | None
    citations: list[RawCitation]          # doc_id, page (1-based), quote, bbox | None
    insufficient_reason: str | None
```
Rules we enforce on our side, so please follow them:
- `doc_id` must be one that was ingested via `POST /documents`; other ids are dropped with a warning.
- `quote` should be verbatim from that page (your citation verifier checks this before returning).
- Return `answer=None` (and optionally an `insufficient_reason`) when evidence is lacking. An answer with no valid citation is converted to `insufficient_evidence`.
- Squad 3 adds the lineage status and warnings. You do not need to compute them, but you may use `LineageGraph.status_of(doc_id)` to prefer current documents when ranking.

To plug in: pass the engine to `create_app(engine=YourEngine())` in `app/main.py`. Until then a placeholder engine always refuses.

---

## Known limits (v0.1)

- Lineage is document-level; there is no per-clause status yet.
- Gujarati amendment wording is not yet validated on real GRs, so some links may be missing; check `unresolved` after ingest.
- Statuses only reflect the ingested corpus.
