// A GR number as read from the scan is shown only when it looks like a clean identifier.
// OCR fragments such as "EXE- 1155 dated the 10th /" fall back to the collection's own stable id,
// so a judge never reads a garbled line where a GR number should be.
const CLEAN_NUMBER = /^[\p{L}\p{N}][\p{L}\p{M}\p{N}/\-.]{3,27}$/u;

export function displayNumber(gr) {
  const n = String(gr?.gr_number || '').trim();
  return CLEAN_NUMBER.test(n) ? n : String(gr?.gr_id || n || '');
}
