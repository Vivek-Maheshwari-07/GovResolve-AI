"""
Squad 2 — Bilingual Query Reformulator & Gujlish Normalizer
Transforms raw user queries (Gujlish slang, typos, transliteration, English or Gujarati)
into a synchronized Search Bundle:
  - query_en: canonical English search string
  - query_gu: canonical Gujarati search string
  - keywords: exact tokens, GR numbers, and years
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Optional
from dataclasses import dataclass, field
from loguru import logger

# Load GAD Glossary
_GLOSSARY_PATH = Path(__file__).parent.parent.parent / "config" / "gad_glossary.json"

@dataclass
class SearchBundle:
    original_query:  str
    query_en:        str
    query_gu:        str
    keywords:        list[str] = field(default_factory=list)
    detected_lang:   str = "en"  # "gu" | "en" | "gujlish" | "mixed"
    extracted_gr_no: Optional[str] = None
    extracted_year:  Optional[str] = None


class GujlishNormalizer:
    def __init__(self, glossary_path: Path = _GLOSSARY_PATH):
        self.functional_stems = {}
        self.secretariat_terms = []
        if glossary_path.exists():
            with open(glossary_path, encoding="utf-8") as f:
                data = json.load(f)
                self.functional_stems = data.get("functional_stems", {})
                self.secretariat_terms = data.get("secretariat_terms", [])
        else:
            logger.warning(f"Glossary not found at {glossary_path}")

    def detect_language(self, text: str) -> str:
        """Classify script: 'gu', 'en', 'gujlish', or 'mixed'."""
        gu_chars = len(re.findall(r"[\u0A80-\u0AFF]", text))
        en_chars = len(re.findall(r"[a-zA-Z]", text))
        
        if gu_chars > 0 and en_chars == 0:
            return "gu"
        
        # Check for Gujlish keywords in Latin script
        words = re.findall(r"[a-zA-Z]+", text.lower())
        gujlish_hits = 0
        for stem in self.functional_stems.keys():
            stem_words = stem.split()
            if len(stem_words) == 1 and stem_words[0] in words:
                gujlish_hits += 1
            elif len(stem_words) > 1 and stem in text.lower():
                gujlish_hits += 2

        if gujlish_hits >= 1:
            return "gujlish" if gu_chars == 0 else "mixed"
        
        if gu_chars > 0 and en_chars > 0:
            return "mixed"
        
        return "en"

    def extract_metadata_entities(self, text: str) -> tuple[Optional[str], Optional[str]]:
        """Extract explicit GR Number and 4-digit Year if mentioned in query."""
        gr_no = None
        year = None
        
        # Match GR number patterns: GAD/2021/..., ક્રમાંક: ...
        gr_match = re.search(r"\b([A-Za-zઅ-ૠ]{2,8}[/\-]\d{4}[/\-][\w\/\-]+)\b", text)
        if gr_match:
            gr_no = gr_match.group(1).strip()
            
        # Match 4-digit year (1990-2035)
        year_match = re.search(r"\b(19\d{2}|20[0-3]\d)\b", text)
        if year_match:
            year = year_match.group(1)
            
        return gr_no, year

    def normalize(self, query: str) -> SearchBundle:
        """
        Produce synchronized bilingual search bundle:
        - Maps Gujlish functional phrases to canonical administrative intents
        - Matches Secretariat terms (e.g. 'refund', 'leave encashment', 'maternity')
        - Generates high-recall English and Gujarati search representations
        """
        raw = query.strip()
        detected_lang = self.detect_language(raw)
        gr_no, year = self.extract_metadata_entities(raw)
        
        lower_raw = raw.lower()
        matched_en_terms = []
        matched_gu_terms = []
        keywords = set()

        if gr_no:
            keywords.add(gr_no)
        if year:
            keywords.add(year)

        # 1. Match Secretariat Administrative Terms (Sachivalaya Shabdavali)
        for entry in self.secretariat_terms:
            synonyms = entry.get("synonyms", [])
            matched = False
            for syn in synonyms:
                pattern = r"\b" + re.escape(syn.lower()) + r"\b"
                if re.search(pattern, lower_raw):
                    matched = True
                    keywords.add(syn)
                    break
            
            if matched:
                matched_en_terms.append(entry["canonical_en"])
                matched_gu_terms.append(entry["canonical_gu"])
                keywords.add(entry["key"])

        # 2. Match & Normalize Functional Stems (e.g. "su karvu pade", "mate", "joie")
        matched_stems_gu = []
        matched_stems_en = []
        for stem, mapping in sorted(self.functional_stems.items(), key=lambda x: len(x[0]), reverse=True):
            if stem in lower_raw:
                matched_stems_gu.append(mapping["gu"])
                matched_stems_en.append(mapping["en"])

        # 3. Construct Synchronized Bilingual Queries
        if detected_lang in ("gujlish", "mixed"):
            # Construct formal Gujarati query
            gu_parts = matched_gu_terms + matched_stems_gu
            en_parts = matched_en_terms + matched_stems_en
            
            query_gu = " ".join(dict.fromkeys(gu_parts)) if gu_parts else raw
            query_en = " ".join(dict.fromkeys(en_parts)) if en_parts else raw
            
            # Add standalone core alphanumeric tokens to keywords
            for tok in re.findall(r"[A-Za-z0-9]+", raw):
                if tok.lower() not in self.functional_stems and len(tok) > 2:
                    keywords.add(tok)
                    
        elif detected_lang == "gu":
            # Native Gujarati query -> Generate English equivalent
            query_gu = raw
            if matched_gu_terms:
                query_gu = f"{raw} {' '.join(matched_gu_terms)}"
            en_parts = matched_en_terms + matched_stems_en
            query_en = " ".join(dict.fromkeys(en_parts)) if en_parts else raw
            for tok in re.findall(r"[\u0A80-\u0AFF0-9]+", raw):
                if len(tok) >= 3:
                    keywords.add(tok)
                    
        else: # "en"
            # English query -> Generate Gujarati equivalent
            query_en = raw
            if matched_en_terms:
                query_en = f"{raw} {' '.join(matched_en_terms)}"
            gu_parts = matched_gu_terms + matched_stems_gu
            query_gu = " ".join(dict.fromkeys(gu_parts)) if gu_parts else raw
            for tok in re.findall(r"[A-Za-z0-9]+", raw):
                if len(tok) >= 3:
                    keywords.add(tok.lower())

        return SearchBundle(
            original_query=raw,
            query_en=query_en.strip(),
            query_gu=query_gu.strip(),
            keywords=list(keywords),
            detected_lang=detected_lang,
            extracted_gr_no=gr_no,
            extracted_year=year
        )

