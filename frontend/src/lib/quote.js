// How a verbatim quote is shown. The quote itself is never changed (the API returns it exactly as stored); only invisible
// control characters, which some legacy-font Gujarati PDFs leave in their text layer, are hidden, and repeated spaces collapsed.

const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F]/g;
// Characters a Gujarati text layer only contains when the PDF used a legacy (non-Unicode) font: Latin Extended-B, IPA and
// Latin Extended-C letters ("Ȥજરાત", "ƛય", "Ⱦુ"), or ASCII symbols jammed between Gujarati letters ("ર !વાસ", "$પાંતર").
const LEGACY = /[ƀ-ɏɐ-ʯⱠ-Ɀ]|[઀-૿]\s*[!$%=@#*+]|[!$%=@#*+]\s*[઀-૿]/;

export function displayQuote(text) {
  return String(text || '').replace(CONTROL, ' ').replace(/[ \t]{2,}/g, ' ').trim();
}

// True when the stored text of a passage is probably a damaged extraction, so the reader should check the PDF page.
export function looksGarbled(text) {
  const s = String(text || '');
  CONTROL.lastIndex = 0;
  return CONTROL.test(s) || LEGACY.test(s);
}
