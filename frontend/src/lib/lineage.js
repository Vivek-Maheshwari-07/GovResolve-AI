// Rule Time Machine: what a lineage chain looked like on a given day, using only the documents' own issue dates.
// A document counts as amended / superseded on a date only if the order that does it was issued on or before that date.
const REPLACING = new Set(['supersedes', 'replaces', 'cancels']);

/** Status of every node on `date` (ISO 'YYYY-MM-DD', or empty for "all orders count"). */
export function statusAsOf(chain, date) {
  const out = {};
  for (const n of chain) out[n.gr_id] = { status: 'no_change', issued: !date || !n.date || n.date <= date, by: [] };
  for (const src of chain) {
    for (const e of src.edges_out || []) {
      if (!out[e.to_gr_id]) continue;
      if (date && src.date && src.date > date) continue; // the acting order did not exist yet
      const kind = REPLACING.has(e.relation) ? 'superseded' : e.relation === 'amends' ? 'amended' : null;
      if (!kind) continue;
      out[e.to_gr_id].by.push(src.gr_id);
      if (kind === 'superseded' || out[e.to_gr_id].status === 'no_change') out[e.to_gr_id].status = kind;
    }
  }
  return out;
}

export function issuedCount(chain, date) {
  const real = chain.filter((n) => !n.is_external);
  return { issued: real.filter((n) => !date || !n.date || n.date <= date).length, total: real.length };
}

/** One formatted note for an office file or a tribunal: the source, page and the verbatim quote. */
export function courtCitation(c, today = new Date()) {
  const lines = [
    `${c.department ? c.department + ', ' : ''}Government of Gujarat`,
    `GR No. ${c.gr_number || c.gr_id}${c.issue_date ? `, dated ${c.issue_date}` : ''}, page ${c.page}`,
  ];
  if (c.subject) lines.push(`Subject: ${c.subject}`);
  if (c.passage) lines.push(`Quote (verbatim): “${c.passage}”`);
  lines.push(`Retrieved with GovResolve-AI on ${today.toISOString().slice(0, 10)}. Verify against the original before acting.`);
  return lines.join('\n');
}

export function reportText(c, question) {
  return [
    'WRONG CITATION REPORT (GovResolve-AI)',
    `Question: ${question || '-'}`,
    `Document: ${c.gr_number || c.gr_id} (${c.gr_id}), page ${c.page}`,
    `Quote shown: ${c.passage || '-'}`,
    'What is wrong: ',
  ].join('\n');
}
