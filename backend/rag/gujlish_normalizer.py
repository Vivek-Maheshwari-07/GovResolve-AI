"""
Squad 2 — Bilingual Query Reformulator & Gujlish Normalizer
Transforms raw user queries (Gujlish slang, typos, transliteration, English or Gujarati)
into a synchronized Search Bundle:
  - query_en: canonical English search string
  - query_gu: canonical Gujarati search string
  - keywords: exact tokens, GR numbers, and years
"""
from __future__ import annotations

import difflib
import json
import re
from pathlib import Path
from typing import Optional
from dataclasses import dataclass, field
from loguru import logger

# Load GAD Glossary
_GLOSSARY_PATH = Path(__file__).parent.parent.parent / "config" / "gad_glossary.json"

# Core English vocabulary used for statistical language discrimination
_COMMON_EN_WORDS = {
    "the", "is", "at", "which", "on", "what", "how", "many", "when", "where", "who", "whom",
    "whose", "why", "can", "could", "should", "would", "will", "shall", "does", "do", "did",
    "are", "were", "been", "being", "have", "has", "had", "for", "from", "with", "without",
    "under", "over", "between", "about", "into", "through", "during", "before", "after", "above",
    "below", "to", "of", "in", "and", "or", "any", "some", "all", "each", "every", "both",
    "few", "more", "most", "other", "such", "only", "own", "same", "so", "than", "too", "very",
    "rules", "rule", "order", "orders", "circular", "resolution", "government", "employee",
    "employees", "department", "entitled", "entitlement", "ceiling", "limit", "amount",
    "allowance", "leave", "pension", "salary", "service", "medical", "claim", "reimbursement",
    "officer", "officers", "office", "date", "year", "number", "policy", "scheme", "application",
    "notification", "benefits", "benefit", "eligible", "eligibility", "procedure", "document",
    "documents", "status", "amendment", "superseded", "guidelines", "prescribed", "pay", "fixed"
}

_INDIC_PHONETICS = re.compile(
    r"(?:kh|bh|dh|gh|chh|jh|thh|ddh|shh|rya|kya|tya|mya|vya|sva|shva|ksha|gna|shth|[aeiou]{2,})",
    re.I
)

_GU_SUFFIXES = (
    "mate", "matena", "mateni", "mateno", "matenu",
    "oma", "ma", "thi", "athi", "ethi",
    "na", "ni", "nu", "no", "nao", "nio",
    "vama", "vani", "vano", "vanu", "vathi", "va",
    "karelu", "karel", "karela", "kareli", "karyu", "karya", "karto", "karta", "karti",
    "thase", "thashe", "thay", "thayo", "thayi", "thayu",
    "malse", "malshe", "male", "maleche", "malechhe",
    "uo", "ao", "io"
)

_GU_ADMIN_WORDS = {
    "aadesh", "hukam", "tharav", "paripatra", "suchna", "suchnao", "nirdesh", "margdarshan",
    "aheval", "samiti", "aayog", "karyalay", "kacheri", "vibhag", "khathu", "shakha", "seva",
    "sevao", "sanstha", "mandal", "mandas", "karyakram", "yojana", "yojanao", "anudan",
    "fadavani", "aavantan", "manjuri", "darakhast", "tapas", "tathya", "tapasani", "nirnay",
    "chukaado", "nyay", "adalat", "karyavahi", "karyapadhati", "karyavidhi", "amal", "amalikaran",
    "pagla", "paglan", "niyam", "niyamo", "niyamavali", "kaydo", "kaydao", "adhiniyam",
    "jeshthata", "badhti", "badli", "bharti", "nivad", "pasandagi", "nemnuk", "chuntani",
    "sarpanch", "talati", "mantri", "prant", "mamlatdar", "collector", "sachivalay", "sachivalaya",
    "gandhinagar", "gujarat", "rajya", "sarkar", "shasan", "rajyapal", "mukhyamantri",
    "karmachari", "karmchari", "karmchario", "adhikari", "adhikario", "sevak", "sevako",
    "shikshak", "vidyasahayak", "sahayak", "talim", "pariksha", "kasoti", "pagar", "bhadu",
    "bhathu", "vetan", "vadhari", "vadharo", "kapat", "vasulat", "dand", "shiksha", "shist",
    "guno", "faraj", "farajo", "kamgiri", "kam", "hajari", "gerhajari", "rajani", "raja",
    "rajao", "arji", "arjio", "puravatha", "godown", "vahan", "kharedi", "deadstock",
    "bhav", "dar", "ganvesh", "kapad", "sahay", "updan", "pension", "nivruti", "sevanivruti",
    "che", "chhe", "nathi", "shu", "su", "kya", "kyan", "kyare", "kone", "ketla", "ketli", "ketlu",
    "kevi", "kevo", "kevu", "kem", "kaun", "kon", "pachi", "pahela", "sudhi", "hethal", "mujab",
    "anusar", "sathe", "dwara", "vade", "padi", "raheli", "rahel", "vastu", "vastuo", "binjaruri",
    "bin", "jaruri", "nikal", "nikalva", "karvu", "karva", "aapo", "apo", "leva", "melvva",
    "joie", "joye", "spashtata", "jagyae", "vanchvanu"
}

_GUJLISH_MARKERS = _GU_ADMIN_WORDS
_DISTINCTIVE_GUJLISH = {
    "vanchvanu", "karmchario", "spashtata", "jagyae", "malse", "ketla", "ketli",
    "ketlu", "ganvesh", "pachi", "pahela", "sudhi", "nathi",
    "mateni", "karyavidhi", "karyapadhati", "nikal", "sachivalay", "binjaruri", "raheli", "vastuo",
    "darakhast", "manjur", "tathya", "tapas", "aheval", "kramank"
}


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
        """Classify script robustly: 'gu', 'en', 'gujlish', or 'mixed'."""
        gu_chars = len(re.findall(r"[\u0A80-\u0AFF]", text))
        en_chars = len(re.findall(r"[a-zA-Z]", text))
        
        if gu_chars > 0 and en_chars == 0:
            return "gu"
        if gu_chars > 0 and en_chars > 0:
            return "mixed"
        
        words = re.findall(r"[a-zA-Z]+", text.lower())
        if not words:
            return "en"
        
        # 1. Check glossary and known Gujlish terms
        words_set = set(words)
        gujlish_hits = 0
        stem_keys = list(self.functional_stems.keys())
        for stem in stem_keys:
            stem_words = stem.split()
            if len(stem_words) == 1 and stem_words[0] in words_set:
                gujlish_hits += 2
            elif len(stem_words) > 1 and stem in text.lower():
                gujlish_hits += 3

        for term in self.secretariat_terms:
            for syn in term.get("synonyms", []):
                syn_lower = syn.lower()
                if " " in syn_lower and syn_lower in text.lower():
                    gujlish_hits += 3
                elif syn_lower in words_set:
                    gujlish_hits += 2

        # Fuzzy check for minor misspellings of distinctive Gujlish words
        distinctive_list = list(_DISTINCTIVE_GUJLISH)
        for w in words_set:
            if difflib.get_close_matches(w, distinctive_list, n=1, cutoff=0.85):
                gujlish_hits += 2

        # 2. Check linguistic suffixes, phonetics, and administrative vocabulary
        en_count = sum(1 for w in words if w in _COMMON_EN_WORDS)
        gu_count = sum(1 for w in words if w in _GU_ADMIN_WORDS)
        suffix_hits = sum(1 for w in words if len(w) > 3 and any(w.endswith(sfx) for sfx in _GU_SUFFIXES))
        phonetic_hits = sum(1 for w in words if _INDIC_PHONETICS.search(w) and w not in _COMMON_EN_WORDS)

        total_gu_clues = gujlish_hits + (gu_count * 2) + suffix_hits + phonetic_hits
        total_en_clues = en_count * 2

        if any(w in words_set for w in _DISTINCTIVE_GUJLISH):
            return "gujlish"
        if total_gu_clues >= 2 and total_gu_clues > total_en_clues:
            return "gujlish"
        if (gu_count >= 1 or gujlish_hits >= 1) and en_count == 0:
            return "gujlish"
        if en_count >= 2 and total_en_clues >= total_gu_clues:
            return "en"
        if total_gu_clues >= 2:
            return "gujlish"
        
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
            pattern = r"\b" + re.escape(stem) + r"\b"
            if re.search(pattern, lower_raw):
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
            # Add Gujarati tokens from matched terms
            for tok in re.findall(r"[\u0A80-\u0AFF0-9]+", " ".join(gu_parts)):
                if len(tok) >= 2:
                    keywords.add(tok)
                    
        elif detected_lang == "gu":
            # Native Gujarati query -> Generate English equivalent
            query_gu = raw
            if matched_gu_terms:
                query_gu = f"{raw} {' '.join(matched_gu_terms)}"
            en_parts = matched_en_terms + matched_stems_en
            query_en = " ".join(dict.fromkeys(en_parts)) if en_parts else raw
            for tok in re.findall(r"[\u0A80-\u0AFF0-9]+", raw):
                if len(tok) >= 2:
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
            for tok in re.findall(r"[\u0A80-\u0AFF0-9]+", " ".join(gu_parts)):
                if len(tok) >= 2:
                    keywords.add(tok)

        return SearchBundle(
            original_query=raw,
            query_en=query_en.strip(),
            query_gu=query_gu.strip(),
            keywords=list(keywords),
            detected_lang=detected_lang,
            extracted_gr_no=gr_no,
            extracted_year=year
        )
