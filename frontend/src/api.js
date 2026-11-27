// Talks to the contract API (docs/API_CONTRACT.md) and reshapes answers into the form the UI components use.
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
      subject_en: n.meta.subject_en,
      subject_gu: n.meta.subject_gu,
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

// Reads the NDJSON lines of POST /query/stream: stage events go to `onStage`, the last line carries the /query response.
export async function streamQuery(body, signal, onStage) {
  const res = await fetch('/query/stream', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal,
  });
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({}));
    const e = new Error(err.reason || err.error || `Request failed with status ${res.status}`);
    e.status = res.status;
    throw e;
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf(String.fromCharCode(10))) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      const ev = JSON.parse(line);
      if (ev.type === 'stage') onStage?.(ev);
      else if (ev.type === 'result') return { ...ev.response, _elapsed: ev.t };
      else if (ev.type === 'error') throw new Error(ev.reason || 'The answer engine failed.');
    }
    if (done) throw new Error('The answer stream ended without a result.');
  }
}

// `options` is either a stage callback (live pipeline, POST /query/stream) or `{ onStage, includeChain }`; the chat helpline
// passes `{ includeChain: false }` because it does not draw the amendment chain.
export async function ask(question, language = null, signal = undefined, options = undefined) {
  const opts = typeof options === 'function' ? { onStage: options } : (options || {});
  const { onStage, includeChain = true } = opts;
  const body = language && language !== 'auto' ? { question, language } : { question };
  let r;
  if (onStage) {
    try {
      r = await streamQuery(body, signal, onStage);
    } catch (e) {
      if (e.name === 'AbortError' || (e.status !== 404 && e.status !== 405)) throw e;
      r = null;  // an older server without /query/stream: ask the plain endpoint
    }
  }
  if (!r) {
    r = await getJson('/query', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal,
    });
  }
  const ids = [...new Set((r.citations || []).map((c) => c.doc_id))];
  const metas = Object.fromEntries(await Promise.all(ids.map(async (id) => [id, await docMeta(id)])));
  const citations = (r.citations || []).map((c) => ({
    gr_id: c.doc_id,
    gr_number: metas[c.doc_id]?.gr_number || c.doc_id,
    subject: metas[c.doc_id]?.subject,
    subject_en: metas[c.doc_id]?.subject_en,
    subject_gu: metas[c.doc_id]?.subject_gu,
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
  if (includeChain && answered && citations.length) {
    try { chain = await lineageChain(citations[0].gr_id); } catch { chain = []; }
  }
  return {
    question,
    language: r.language || null,
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
    server_seconds: r._elapsed ?? null,
  };
}

/** Quick capability probe (`GET /voice/transcribe`) to see if backend Whisper STT is live. */
export async function voiceTranscribeStatus(signal = undefined) {
  try {
    const r = await getJson('/voice/transcribe', { method: 'GET', signal });
    return Boolean(r?.available);
  } catch {
    return false;
  }
}

/** Upload recorded browser microphone audio to Whisper (`/voice/transcribe`) with automatic language detection. */
export async function transcribeAudio(blob, language = null, signal = undefined, mode = 'accurate') {
  const fd = new FormData();
  const ext = (blob?.type || '').includes('mp4') ? 'm4a' : (blob?.type || '').includes('ogg') ? 'ogg' : 'webm';
  fd.append('file', blob, `voice.${ext}`);
  if (language && language !== 'auto') fd.append('language', language);
  if (mode) fd.append('mode', mode);
  return getJson('/voice/transcribe', { method: 'POST', body: fd, signal });
}

// The library: every GR with its status. `/grs` uses the lineage engine's internal words (ACTIVE, ABROGATED, ...);
// they are mapped here so the UI never shows "active" (finding no later order is not proof that a rule is in force).
const GR_STATUS = { ACTIVE: 'no_change', AMENDED: 'amended', SUPERSEDED: 'superseded', ABROGATED: 'superseded' };
export const mapGrStatus = (s) => GR_STATUS[String(s || '').toUpperCase()] || 'unknown';

export async function listGrs() {
  const rows = await getJson('/grs');
  return rows
    .map((g) => ({
      gr_id: g.gr_id,
      gr_number: g.gr_number || g.gr_id,
      department: g.department,
      issue_date: g.issue_date,
      subject: g.subject,
      subject_en: g.subject_en,
      subject_gu: g.subject_gu,
      language: g.language,
      status: mapGrStatus(g.status),
    }))
    .sort((a, b) => String(b.issue_date || '').localeCompare(String(a.issue_date || '')));
}

const _TR_CACHE = new Map();

/** On-demand official translation helper for verbatim GR quotes / OCR paragraphs. */
export async function translateText(text, targetLanguage = 'gu', signal = undefined) {
  const src = String(text || '').trim();
  const tgt = targetLanguage === 'en' ? 'en' : 'gu';
  if (!src) return '';
  const key = `${tgt}:${src}`;
  if (_TR_CACHE.has(key)) return _TR_CACHE.get(key);
  const res = await getJson('/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: src.slice(0, 2500), target_language: tgt }),
    signal,
  });
  const out = res?.translated || '';
  if (out) _TR_CACHE.set(key, out);
  return out;
}

export function needsTextTranslation(text, targetLang) {
  const s = String(text || '').trim();
  if (!s) return false;
  const hasGu = /[\u0A80-\u0AFF]/.test(s);
  if (targetLang === 'gu') return !hasGu && /[A-Za-z]/.test(s);
  if (targetLang === 'en') return hasGu;
  return false;
}

/**
 * Translate rendered answer prose (`summary`, `insufficient_reason`, `warnings`, `statements[].text`)
 * in place into `targetLang` without re-running `/query` or altering citations/lineage.
 */
export async function translateResponseFields(res, targetLang, { translateFn = translateText, signal } = {}) {
  if (!res) return res;
  const tgt = targetLang === 'gu' ? 'gu' : 'en';
  const stmts = res.statements || [];
  const joinedStmts = stmts.map((s) => (s.text || '').trim()).filter(Boolean).join(' ').trim();
  const sumTrim = (res.summary || '').trim();
  const sumMatchesJoined = Boolean(sumTrim && joinedStmts && sumTrim === joinedStmts);

  const unique = new Set();
  if (res.summary && !sumMatchesJoined && needsTextTranslation(res.summary, tgt)) {
    unique.add(res.summary);
  }
  if (res.insufficient_reason && needsTextTranslation(res.insufficient_reason, tgt)) {
    unique.add(res.insufficient_reason);
  }
  for (const w of res.warnings || []) {
    if (needsTextTranslation(w, tgt)) unique.add(w);
  }
  for (const st of stmts) {
    if (needsTextTranslation(st.text, tgt)) unique.add(st.text);
  }

  if (unique.size === 0) return res;

  const entries = await Promise.all(
    [...unique].map(async (txt) => {
      const tr = await translateFn(txt, tgt, signal);
      return [txt, tr || txt];
    }),
  );
  const trMap = new Map(entries);
  const nextStatements = stmts.map((st) => ({
    ...st,
    text: trMap.get(st.text) || st.text,
  }));
  const nextSummary = sumMatchesJoined
    ? nextStatements.map((s) => (s.text || '').trim()).filter(Boolean).join(' ').trim()
    : (res.summary ? (trMap.get(res.summary) || res.summary) : res.summary);

  return {
    ...res,
    language: tgt,
    summary: nextSummary,
    insufficient_reason: res.insufficient_reason ? (trMap.get(res.insufficient_reason) || res.insufficient_reason) : res.insufficient_reason,
    warnings: (res.warnings || []).map((w) => trMap.get(w) || w),
    statements: nextStatements,
  };
}
