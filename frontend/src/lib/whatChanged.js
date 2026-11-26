// "What changed": the cited passage beside the newer order's own words that amend or replace it.
// Built only from explicit lineage edges (newer -> older) and their stored verbatim quote; nothing is paraphrased.
const ACTS = { amends: 'amends', supersedes: 'supersedes', replaces: 'replaces', cancels: 'cancels' };
const VERB = { amends: 'Amended by', supersedes: 'Superseded by', replaces: 'Replaced by', cancels: 'Cancelled by' };

/**
 * citation: an answer citation ({gr_id, gr_number, page, passage, issue_date, lineage})
 * chain: lineage chain nodes ({gr_id, gr_number, date, edges_out: [{to_gr_id, relation, page, quote}]})
 * Returns null unless a newer order in the chain explicitly acts on the cited one.
 */
export function whatChanged(citation, chain = []) {
  if (!citation?.gr_id || !Array.isArray(chain)) return null;
  const acts = [];
  for (const node of chain) {
    if (!node || node.gr_id === citation.gr_id) continue;
    for (const e of node.edges_out || []) {
      if (e.to_gr_id === citation.gr_id && ACTS[e.relation]) acts.push({ node, e });
    }
  }
  if (!acts.length) return null;
  // the latest order that acts on it is the one to read
  acts.sort((a, b) => String(b.node.date || '').localeCompare(String(a.node.date || '')));
  const { node, e } = acts[0];
  return {
    older: { gr_id: citation.gr_id, gr_number: citation.gr_number || citation.gr_id, date: citation.issue_date || null, page: citation.page ?? null, quote: citation.passage || null },
    newer: { gr_id: node.gr_id, gr_number: node.gr_number || node.gr_id, date: node.date || null, page: e.page ?? null, quote: e.quote || null, relation: e.relation },
    label: VERB[e.relation],
    others: acts.length - 1,
  };
}
