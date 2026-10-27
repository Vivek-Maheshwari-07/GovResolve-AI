"""Step 4.6: LLM fallback, only for sentences that point at a GR but match no phrase.

`call` is any function that takes a prompt and returns the model's text (Squad 2's provider plugs in here).
Output must be strict JSON; anything that fails validation is discarded. Results are cached by sentence hash.
"""
import hashlib
import json
import re
from typing import Callable, Protocol

from pydantic import BaseModel, Field, ValidationError

from ..schemas import RelType, Scope

PROMPT = """You read one sentence from an Indian government resolution (GR), in English or Gujarati.
Decide whether the sentence changes an EARLIER GR, and how. Answer with ONLY this JSON, nothing else:
{{"rel_type": one of SUPERSEDES|AMENDS|SUBSTITUTES|CANCELS|CLARIFIES|RESTORES|REFERS or null,
  "target_ref_text": the GR number or date of the earlier GR exactly as written, or null,
  "scope": WHOLE|PARAGRAPH|CLAUSE|UNKNOWN,
  "target_clauses": [paragraph or clause labels of the earlier GR that are changed]}}
Use null for rel_type if the sentence only mentions the GR without changing it.

Reference list of this GR:
{refs}

Previous sentence: {before}
SENTENCE: {sentence}
Next sentence: {after}
"""


class LLMEdge(BaseModel):
    rel_type: RelType | None = None
    target_ref_text: str | None = None
    scope: Scope = Scope.UNKNOWN
    target_clauses: list[str] = Field(default_factory=list)


class Cache(Protocol):
    def cache_get(self, sentence_hash: str) -> dict | None: ...
    def cache_put(self, sentence_hash: str, result: dict) -> None: ...


def parse_llm_json(text: str) -> LLMEdge | None:
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M).strip()
    try:
        return LLMEdge.model_validate(json.loads(text))
    except (json.JSONDecodeError, ValidationError, TypeError):
        return None


class LLMFallback:
    def __init__(self, call: Callable[[str], str], cache: Cache | None = None):
        self.call, self.cache = call, cache
        self.calls = 0  # model calls actually made (cache hits excluded)

    def classify(self, sentence: str, before: str = "", after: str = "", read_items: list[str] | None = None) -> LLMEdge | None:
        prompt = PROMPT.format(sentence=sentence, before=before or "-", after=after or "-",
                               refs="\n".join(read_items or []) or "-")
        key = hashlib.sha256(prompt.encode("utf-8")).hexdigest()
        if self.cache and (hit := self.cache.cache_get(key)) is not None:
            return LLMEdge.model_validate(hit)
        self.calls += 1
        try:
            result = parse_llm_json(self.call(prompt))
        except Exception:  # provider errors must never break a corpus build
            return None
        if result is not None and self.cache:
            self.cache.cache_put(key, result.model_dump(mode="json"))
        return result
