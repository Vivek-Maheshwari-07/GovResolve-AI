# Manual smoke scripts

Slow end-to-end checks that load the real embedding model and the processed corpus. They are not collected by `pytest` (see `conftest.py`).
Run from the repository root:

```bash
python backend/tests/manual/test_pipeline.py
python backend/tests/manual/test_target_language.py
```
