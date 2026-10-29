"""
Squad 2 — Gujarati Linguistic Stemmer & Tokenizer for BM25
Solves the agglutinative inflected nature of Gujarati in BM25 lexical search:
- Strips case markers / postpositions (-માં, -થી, -ના, -ની, -નું, -નો, -એ, -ઓ, -ને)
- Normalizes Gujarati numerals (૦૧૨૩૪૫૬૭૮૯ -> 0123456789)
- Tokenizes alphanumeric identifiers (e.g. GAD/2021/0147)
"""
import re

# Gujarati digit normalization table
GU_DIGIT_MAP = str.maketrans("૦૧૨૩૪૫૬૭૮૯", "0123456789")

# Regex to strip common Gujarati postpositions / inflectional suffixes from words with 3+ base chars
GU_SUFFIX_RE = re.compile(
    r"^([\u0A80-\u0AFF]{3,})(માં|થી|ના|ની|નું|નો|નાં|એ|ઓ|ને|વાળા|વાળી|પૂર્વક|ો|ે)$"
)

# Common Gujarati stop words to avoid BM25 index pollution
GU_STOP_WORDS = {
    "અને", "કે", "તો", "જો", "પણ", "માટે", "દ્વારા", "સાથે", "તે", "આ", "જે",
    "છે", "હતા", "હતી", "હતું", "હોય", "કરે", "કરવા", "આવેલ", "મુજબ", "અંગે"
}


def normalize_gujarati_digits(text: str) -> str:
    """Normalize Gujarati numerals to ASCII 0-9."""
    return text.translate(GU_DIGIT_MAP)


def stem_gujarati_word(word: str) -> str:
    """Strip inflectional suffixes from a Gujarati word."""
    m = GU_SUFFIX_RE.match(word)
    if m:
        return m.group(1)
    return word


def tokenize_for_bm25(text: str) -> list[str]:
    """
    Tokenize bilingual Gujarati-English administrative text for BM25:
    1. Normalizes Gujarati numerals to standard ASCII
    2. Extracts alphanumeric tokens (words, GR numbers, dates)
    3. Stems Gujarati case suffixes
    4. Filters out stop words and short noise
    """
    normalized = normalize_gujarati_digits(text)
    
    # Extract words or compound codes (e.g. GAD/2021/123)
    raw_tokens = re.findall(r"[\u0A80-\u0AFF]+|[a-zA-Z0-9]+(?:[/\-_][a-zA-Z0-9]+)*", normalized)
    
    tokens = []
    for tok in raw_tokens:
        tok_clean = tok.strip()
        if not tok_clean or len(tok_clean) < 2:
            continue
        
        # Check if Gujarati script
        if re.search(r"[\u0A80-\u0AFF]", tok_clean):
            stemmed = stem_gujarati_word(tok_clean)
            if stemmed not in GU_STOP_WORDS:
                tokens.append(stemmed)
        else:
            # English / Alphanumeric token
            tok_lower = tok_clean.lower()
            tokens.append(tok_lower)
            
    return tokens
