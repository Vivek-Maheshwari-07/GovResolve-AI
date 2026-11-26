// Run: node --test src/api.test.mjs   (no browser, fetch is faked)
import test from 'node:test';
import assert from 'node:assert/strict';
import { ask, lineageChain, needsTextTranslation, pdfUrl, translateResponseFields, voiceTranscribeStatus, transcribeAudio } from './api.js';

function fakeFetch(routes) {
  globalThis.fetch = async (url, init) => {
    const key = (init?.method || 'GET') + ' ' + url;
    const hit = routes[key];
    if (!hit) return { ok: false, status: 404, json: async () => ({ reason: 'no route ' + key }) };
    return { ok: true, status: 200, json: async () => hit };
  };
}
const meta = (id, num, date) => ({ meta: { doc_id: id, gr_number: num, issue_date: date, subject: 's' } });
const cit = (id, status) => ({ doc_id: id, page: 2, quote: 'q ' + id, issue_date: '2020-01-01', bbox: [1, 2, 3, 4], lineage: { status } });

test('answer: worst lineage status wins, statements point at the right citations, warnings pass through', async () => {
  fakeFetch({
    'POST /query': {
      verdict: 'answered', answer: 'A', warnings: ['careful'],
      citations: [cit('a', 'no_later_amendment_found'), cit('b', 'superseded')],
      statements: [{ text: 'S1', label: 'established', citations: [1] }, { text: 'S2', label: 'inferred', citations: [] }],
    },
    'GET /documents/a': meta('a', 'GR-A', '2020-01-01'),
    'GET /documents/b': meta('b', 'GR-B', '2019-01-01'),
    'GET /lineage/a': { nodes: [{ meta: { doc_id: 'a', gr_number: 'GR-A' }, status: 'no_later_amendment_found' }], edges: [], timeline: ['a'] },
  });
  const r = await ask('q');
  assert.equal(r.answer_status, 'superseded');
  assert.equal(r.summary, 'A');
  assert.deepEqual(r.warnings, ['careful']);
  assert.equal(r.citations[0].gr_number, 'GR-A');
  assert.equal(r.citations[1].passage, 'q b');
  assert.deepEqual(r.citations[0].bbox, [1, 2, 3, 4]);
  assert.equal(r.statements[0].citations[0].gr_id, 'b');
  assert.equal(r.statements[0].label, 'Established');
  assert.equal(r.statements[1].label, 'Inferred');
  assert.equal(r.lineage_chain.length, 1);
});

test('answer: amended and no-later-change statuses never say active', async () => {
  fakeFetch({
    'POST /query': { verdict: 'answered', answer: 'A', citations: [cit('a', 'amended')], statements: [] },
    'GET /documents/a': meta('a', 'GR-A', '2020-01-01'),
    'GET /lineage/a': { nodes: [], edges: [], timeline: [] },
  });
  assert.equal((await ask('q')).answer_status, 'amended');
  fakeFetch({
    'POST /query': { verdict: 'answered', answer: 'A', citations: [cit('a', 'unknown')], statements: [] },
    'GET /documents/a': meta('a', 'GR-A', '2020-01-01'),
    'GET /lineage/a': { nodes: [], edges: [], timeline: [] },
  });
  const r = await ask('q');
  assert.equal(r.answer_status, 'no_change');
  assert.ok(!/active/i.test(r.answer_status));
});

test('refusal: no answer, reason kept, no lineage call', async () => {
  fakeFetch({ 'POST /query': { verdict: 'insufficient_evidence', answer: null, reason: 'not in documents', reason_code: 'NO_DOCUMENT', citations: [], warnings: [] } });
  const r = await ask('q');
  assert.equal(r.answer_status, 'insufficient');
  assert.equal(r.insufficient_reason, 'not in documents');
  assert.equal(r.reason_code, 'NO_DOCUMENT');
  assert.equal(r.summary, null);
  assert.deepEqual(r.lineage_chain, []);
});

test('lineage chain keeps timeline order and edge direction newer -> older', async () => {
  fakeFetch({
    'GET /lineage/new': {
      nodes: [
        { meta: { doc_id: 'new', gr_number: 'N', issue_date: '2022-01-01' }, status: 'no_later_amendment_found' },
        { meta: { doc_id: 'old', gr_number: 'O', issue_date: '2010-01-01' }, status: 'amended' },
        { meta: { doc_id: 'ext:x', gr_number: 'X', is_external: true }, status: 'unknown' },
      ],
      edges: [{ source: 'new', target: 'old', relation: 'amends', evidence: { page: 3, quote: 'amend' }, warnings: [] }],
      timeline: ['old', 'new'],
    },
  });
  const chain = await lineageChain('new');
  assert.deepEqual(chain.map((n) => n.gr_id), ['old', 'new']);
  assert.equal(chain[0].status, 'Amended');
  assert.equal(chain[1].edges_out[0].to_gr_id, 'old');
  assert.equal(chain[1].edges_out[0].link_type, 'Amends');
  assert.equal(chain[0].edges_out.length, 0);
});

test('answer: includeChain=false skips lineage fetch while keeping language', async () => {
  fakeFetch({
    'POST /query': {
      verdict: 'answered',
      answer: 'પંચવટી યોજના ગ્રામીણ બગીચા માટે છે.',
      language: 'gu',
      citations: [cit('a', 'no_later_amendment_found')],
      statements: [],
    },
    'GET /documents/a': meta('a', 'GR-A', '2020-01-01'),
  });
  const r = await ask('Panchwati Yojna', null, undefined, { includeChain: false });
  assert.equal(r.language, 'gu');
  assert.deepEqual(r.lineage_chain, []);
});

test('voice: voiceTranscribeStatus and transcribeAudio fast mode work cleanly', async () => {
  let postedBody = null;
  globalThis.fetch = async (url, init) => {
    if (init?.method === 'GET' && url === '/voice/transcribe') {
      return { ok: true, status: 200, json: async () => ({ available: true, provider: 'groq' }) };
    }
    if (init?.method === 'POST' && url === '/voice/transcribe') {
      postedBody = init.body;
      return { ok: true, status: 200, json: async () => ({ text: 'પંચવટી યોજના', detected_language: 'gu' }) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
  assert.equal(await voiceTranscribeStatus(), true);
  const res = await transcribeAudio(new Blob(['abc'], { type: 'audio/webm' }), null, undefined, 'fast');
  assert.equal(res.text, 'પંચવટી યોજના');
  assert.equal(res.detected_language, 'gu');
  assert.equal(postedBody.get('mode'), 'fast');
  assert.equal(postedBody.get('language'), null);
});

test('a failing request raises the backend reason', async () => {
  fakeFetch({});
  await assert.rejects(() => ask('q'), /no route/);
});

test('pdf url is encoded', () => {
  assert.equal(pdfUrl('GR-1_2 x'), '/grs/GR-1_2%20x/pdf');
});

test('library statuses never pass "ACTIVE" through', async () => {
  const { mapGrStatus, listGrs } = await import('./api.js');
  assert.equal(mapGrStatus('ACTIVE'), 'no_change');
  assert.equal(mapGrStatus('ABROGATED'), 'superseded');
  assert.equal(mapGrStatus('CONFLICT'), 'unknown');
  fakeFetch({ 'GET /grs': [
    { gr_id: 'a', gr_number: 'A', issue_date: '2010-01-01', status: 'ACTIVE' },
    { gr_id: 'b', gr_number: 'B', issue_date: '2020-01-01', status: 'AMENDED' },
  ] });
  const rows = await listGrs();
  assert.deepEqual(rows.map((r) => r.gr_id), ['b', 'a']);      // newest first
  assert.ok(!JSON.stringify(rows).includes('ACTIVE'));
});

test('in-place response translation translates prose only without altering citations or lineage', async () => {
  const cites = [{ gr_id: 'GR-1', gr_number: 'FD/1', page: 2, passage: 'Original verbatim text.' }];
  const base = {
    question: 'leave rules?',
    verdict: 'answered',
    answer_status: 'no_change',
    summary: 'Leave is admissible for 180 days.',
    statements: [{ text: 'Leave is admissible for 180 days.', label: 'Established', citations: cites }],
    warnings: [],
    citations: cites,
    lineage_chain: [{ gr_id: 'GR-1' }],
  };

  let calls = 0;
  const fakeTranslate = async (txt, tgt) => {
    calls += 1;
    return tgt === 'gu' ? '૧૮૦ દિવસની રજા મળવાપાત્ર છે.' : txt;
  };

  // Already English -> 0 translation calls
  const same = await translateResponseFields(base, 'en', { translateFn: fakeTranslate });
  assert.equal(calls, 0);
  assert.equal(same, base);

  // Switch EN -> GU -> deduplicated 1 call because summary equals joined statement text; citations preserved verbatim
  assert.equal(needsTextTranslation(base.summary, 'gu'), true);
  const gu = await translateResponseFields(base, 'gu', { translateFn: fakeTranslate });
  assert.equal(calls, 1);
  assert.equal(gu.summary, '૧૮૦ દિવસની રજા મળવાપાત્ર છે.');
  assert.equal(gu.statements[0].text, '૧૮૦ દિવસની રજા મળવાપાત્ર છે.');
  assert.equal(gu.citations, base.citations);
  assert.equal(gu.citations[0].passage, 'Original verbatim text.');
  assert.equal(gu.lineage_chain, base.lineage_chain);
});
