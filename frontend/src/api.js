// Talks to the contract API (backend/API_CONTRACT.md) and reshapes answers into the form the UI components use.
// Same origin in production (FastAPI serves the built UI); `npm run dev` proxies these paths (see vite.config.js).

const NODE_STATUS = { superseded: 'Superseded', amended: 'Amended', no_later_amendment_found: 'NoLater', unknown: 'Unknown' };
const LABEL_TEXT = { established: 'Established', inferred: 'Inferred', not_found: 'Not found' };
const RELATION_TEXT = {
  amends: 'Amends', replaces: 'Replaces', supersedes: 'Supersedes', cancels: 'Cancels', refers_to: 'Refers to',
};

async function getJson(path, init) {
  const res = await fetch(path, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.reason || body.error || `Request failed with status ${res.status}`);
  return body;
}

export async function fetchStats() {
  const h = await getJson('/health');
  return {
    total_grs: h.gr_count ?? h.documents ?? 0,
    chunks: h.chunk_count ?? null,
    edges: h.edge_count ?? null,
    lineage_ready: (h.edge_count ?? 0) > 0,
  };
}

export function pdfUrl(docId) {
  return `/grs/${encodeURIComponent(docId)}/pdf`;
}

export async function pageBlocks(docId, page) {
  const r = await getJson(`/grs/${encodeURIComponent(docId)}/pages/${page}`);
  return (r.blocks || []).map((b) => ({ id: b.chunk_id, text: b.text || '' }));
}

async function docMeta(docId) {
  try {
    return (await getJson(`/documents/${encodeURIComponent(docId)}`)).meta;
  } catch {
    return null;
  }
}

// The worst status wins: a superseded source makes the whole answer "superseded", an amended one "amended".
function overallStatus(citations) {
  const seen = citations.map((c) => c.lineage?.status);
  if (seen.includes('superseded')) return 'superseded';
  if (seen.includes('amended')) return 'amended';
  return 'no_change';
}

export async function lineageChain(docId) {
  const g = await getJson(`/lineage/${encodeURIComponent(docId)}`);
  const byId = Object.fromEntries(g.nodes.map((n) => [n.meta.doc_id, n]));
  const order = g.timeline?.length ? g.timeline : g.nodes.map((n) => n.meta.doc_id);
  return order.filter((id) => byId[id]).map((id) => {
    const n = byId[id];
    return {
      gr_id: id,
      gr_number: n.meta.gr_number || id,
      date: n.meta.issue_date,
      status: NODE_STATUS[n.status] || 'Unknown',
      is_external: !!n.meta.is_external,
      department: n.meta.department,
      subject: n.meta.subject,
      language: n.meta.language,
      // this document acts on older ones: newer -> older, as in the graph
      edges_out: g.edges.filter((e) => e.source === id).map((e) => ({
        to_gr_id: e.target,
        to_gr_number: byId[e.target]?.meta.gr_number || e.target,
        link_type: RELATION_TEXT[e.relation] || e.relation,
        relation: e.relation,
        page: e.evidence?.page ?? 1,
        scope: `Page ${e.evidence?.page ?? '?'}`,
        quote: e.evidence?.quote,
        warnings: e.warnings || [],
      })),
    };
  });
}

export async function ask(question, language = null) {
  const r = await getJson('/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(language ? { question, language } : { question }),
  });
  const ids = [...new Set((r.citations || []).map((c) => c.doc_id))];
  const metas = Object.fromEntries(await Promise.all(ids.map(async (id) => [id, await docMeta(id)])));
  const citations = (r.citations || []).map((c) => ({
    gr_id: c.doc_id,
    gr_number: metas[c.doc_id]?.gr_number || c.doc_id,
    subject: metas[c.doc_id]?.subject,
    department: metas[c.doc_id]?.department,
    language: metas[c.doc_id]?.language,
    page: c.page,
    passage: c.quote,
    issue_date: c.issue_date,
    bbox: c.bbox,
    lineage: c.lineage,
  }));
  const answered = r.verdict === 'answered';
  let chain = [];
  if (answered && citations.length) {
    try { chain = await lineageChain(citations[0].gr_id); } catch { chain = []; }
  }
  return {
    question,
    verdict: r.verdict,
    reason_code: r.reason_code,
    answer_status: answered ? overallStatus(r.citations) : 'insufficient',
    summary: r.answer,
    insufficient_reason: answered ? null : (r.reason || '').replace(/^[A-Z_]{4,}:\s*/, ''),  // the code is shown as its own badge
    warnings: r.warnings || [],
    citations,
    statements: (r.statements || []).map((s) => ({
      text: s.text,
      label: LABEL_TEXT[s.label] || s.label,
      citations: (s.citations || []).map((i) => citations[i]).filter(Boolean),
    })),
    lineage_chain: chain,
  };
}
