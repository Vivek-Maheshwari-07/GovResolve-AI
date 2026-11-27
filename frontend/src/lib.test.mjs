// Run: npm test   (no browser)
import test from 'node:test';
import assert from 'node:assert/strict';
import { statusAsOf, issuedCount, courtCitation, reportText } from './lib/lineage.js';
import { STATUS } from './lib/status.js';
import { HISTORY_MAX, loadHistory, saveHistory } from './lib/history.js';
import { TRANSLATIONS, translate, statusText, reasonText, pickSubject } from './lib/bilingualStrings.js';
import {
  CHAT_TOPICS,
  buildBotMessage,
  detectChatLanguage,
  detectLanguageSwitchIntent,
  resolveChatTurn,
  rewriteFollowUp,
} from './lib/chat.js';

const base = { gr_id: 'base', gr_number: 'B', date: '2010-01-01', edges_out: [] };
const am1 = { gr_id: 'a1', gr_number: 'A1', date: '2015-05-01', edges_out: [{ to_gr_id: 'base', relation: 'amends', page: 1 }] };
const am2 = { gr_id: 'a2', gr_number: 'A2', date: '2020-05-01', edges_out: [{ to_gr_id: 'base', relation: 'amends', page: 2 }] };
const repl = { gr_id: 'r', gr_number: 'R', date: '2022-01-01', edges_out: [{ to_gr_id: 'a1', relation: 'supersedes', page: 1 }] };
const chain = [base, am1, am2, repl];

test('time machine: a document is amended only once an amending order exists', () => {
  assert.equal(statusAsOf(chain, '2012-01-01').base.status, 'no_change');
  assert.equal(statusAsOf(chain, '2016-01-01').base.status, 'amended');
  assert.equal(statusAsOf(chain, '').base.status, 'amended');
});

test('time machine: superseded beats amended, and only from the replacing order\'s date', () => {
  assert.equal(statusAsOf(chain, '2021-01-01').a1.status, 'no_change');
  assert.equal(statusAsOf(chain, '2022-06-01').a1.status, 'superseded');
});

test('time machine: documents issued after the date are flagged not issued', () => {
  const s = statusAsOf(chain, '2016-01-01');
  assert.equal(s.base.issued, true);
  assert.equal(s.a2.issued, false);
  assert.deepEqual(issuedCount(chain, '2016-01-01'), { issued: 2, total: 4 });
  assert.deepEqual(issuedCount(chain, ''), { issued: 4, total: 4 });
});

test('references alone never change a status', () => {
  const ref = { gr_id: 'x', date: '2019-01-01', edges_out: [{ to_gr_id: 'base', relation: 'refers_to' }] };
  assert.equal(statusAsOf([base, ref], '').base.status, 'no_change');
});

test('no status is called active or safe', () => {
  const text = JSON.stringify(STATUS);
  assert.ok(!/\bactive\b/i.test(text));
  assert.ok(!/\bsafe\b/i.test(text));
});

test('court citation keeps the verbatim quote, page and date', () => {
  const t = courtCitation({ gr_id: 'g', gr_number: 'GR-1', issue_date: '2022-09-29', page: 3, passage: 'relaxed by one year', department: 'GAD', subject: 'Rules' }, new Date('2026-11-02T00:00:00Z'));
  assert.match(t, /GR No\. GR-1, dated 2022-09-29, page 3/);
  assert.match(t, /“relaxed by one year”/);
  assert.match(t, /2026-11-02/);
  assert.match(reportText({ gr_id: 'g', page: 3, passage: 'q' }, 'my question'), /my question/);
});

test('GR numbers: clean ones are shown, OCR fragments fall back to the stable id', async () => {
  const { displayNumber } = await import('./lib/grnumber.js');
  assert.equal(displayNumber({ gr_id: 'GAD-1', gr_number: 'પરચ-૧૦ર૦૦૫-૧૫૧૯-પાર્ટ-૧-ક' }), 'પરચ-૧૦ર૦૦૫-૧૫૧૯-પાર્ટ-૧-ક');
  assert.equal(displayNumber({ gr_id: 'GAD-1', gr_number: 'CRR/102017/1245/G' }), 'CRR/102017/1245/G');
  assert.equal(displayNumber({ gr_id: 'GAD-1', gr_number: 'EXE- 1155 dated the 10th /' }), 'GAD-1');
  assert.equal(displayNumber({ gr_id: 'GAD-1', gr_number: null }), 'GAD-1');
});

test('what changed: the latest explicit amending order and its verbatim sentence, nothing without a link', async () => {
  const { whatChanged } = await import('./lib/whatChanged.js');
  const cit = { gr_id: 'old', gr_number: 'GAD/2014/07', page: 1, passage: 'Rs. 350 per day', issue_date: '2014-05-12' };
  const chain = [
    { gr_id: 'base', gr_number: 'GAD/2010/01', date: '2010-04-01', edges_out: [] },
    { gr_id: 'old', gr_number: 'GAD/2014/07', date: '2014-05-12', edges_out: [{ to_gr_id: 'base', relation: 'amends', page: 1, quote: 'x' }] },
    { gr_id: 'mid', gr_number: 'GAD/2016/03', date: '2016-01-01', edges_out: [{ to_gr_id: 'old', relation: 'amends', page: 2, quote: 'first change' }] },
    { gr_id: 'new', gr_number: 'GAD/2019/22', date: '2019-09-30', edges_out: [{ to_gr_id: 'old', relation: 'supersedes', page: 1, quote: 'In supersession of GR GAD/2014/07' }] },
  ];
  const w = whatChanged(cit, chain);
  assert.equal(w.newer.gr_number, 'GAD/2019/22');
  assert.equal(w.newer.quote, 'In supersession of GR GAD/2014/07');
  assert.equal(w.label, 'Superseded by');
  assert.equal(w.older.quote, 'Rs. 350 per day');
  assert.equal(w.others, 1);
  // references never count as a change, and the cited order's own outgoing links are not about it
  assert.equal(whatChanged(cit, [{ gr_id: 'r', date: '2020-01-01', edges_out: [{ to_gr_id: 'old', relation: 'refers_to', quote: 'see' }] }]), null);
  assert.equal(whatChanged({ gr_id: 'base' }, chain.slice(0, 1)), null);
  assert.equal(whatChanged(null, chain), null);
});

import { displayQuote, looksGarbled } from './lib/quote.js';

test('quotes hide control characters but keep every visible character', () => {
  const raw = 'અિધકારી \u0013ીઓ / કમ \u0016ચારી\u0013ીઓની   ર \u0019 (Leave)';
  const shown = displayQuote(raw);
  assert.ok(!/[\u0000-\u001F]/.test(shown));
  assert.equal(shown.replace(/\s/g, ''), raw.replace(/[\u0000-\u001F\s]/g, ''));
});

test('legacy-font Gujarati is flagged, clean Gujarati and English are not', () => {
  assert.ok(looksGarbled('ઓનલાઈન  Leave  /  LTC  ની અર ĥ Ȥુજરાત'));
  assert.ok(looksGarbled('ર   !વાસ   રાહત  (LTC)'));
  assert.ok(looksGarbled('કમ \u0016ચારી'));
  assert.ok(!looksGarbled('“કમમયોગી” એપ્લિકેશનમાં રજા (Leave) તથા રજા પ્રવાસ રાહત (LTC)'));
  assert.ok(!looksGarbled('To be eligible for appointment by direct selection, a candidate shall not be more than 33 years of age.'));
});

test('saved chat history persists, migrates this session, and keeps only the newest entries', () => {
  const makeStorage = (initial = {}) => ({
    values: { ...initial },
    getItem(key) { return this.values[key] ?? null; },
    setItem(key, value) { this.values[key] = value; },
  });
  const legacyEntry = { id: 'legacy', question: 'Old question', response: { verdict: 'answered' }, at: 1 };
  const legacyStorage = makeStorage({ 'govresolve.history': JSON.stringify([legacyEntry]) });
  const primaryStorage = makeStorage();

  assert.deepEqual(loadHistory(primaryStorage, legacyStorage), [legacyEntry]);

  const entries = Array.from({ length: HISTORY_MAX + 2 }, (_, index) => ({
    id: `${index}`,
    question: `Question ${index}`,
    response: { verdict: 'answered' },
    at: index,
  }));
  saveHistory(entries, primaryStorage);
  assert.deepEqual(loadHistory(primaryStorage, legacyStorage), entries.slice(0, HISTORY_MAX));
});

test('chat: rewriteFollowUp attaches prior answered context for short follow-ups only', () => {
  const turns = [
    { role: 'user', text: 'What is Panchvati Yojana?' },
    {
      role: 'assistant',
      question: 'What is Panchvati Yojana?',
      verdict: 'answered',
      citations: [{ gr_id: 'FD-0000-8a8a0d', gr_number: 'UNKNOWN', page: 1 }],
    },
  ];
  assert.match(rewriteFollowUp('Explain in Gujarati', turns), /FD-0000-8a8a0d.*Explain in Gujarati/);
  assert.equal(
    rewriteFollowUp('What is the age limit for direct selection of Stenographer Grade III under 2019 rules?', turns),
    'What is the age limit for direct selection of Stenographer Grade III under 2019 rules?',
  );
  assert.equal(rewriteFollowUp('Explain in Gujarati', []), 'Explain in Gujarati');
});

test('chat: buildBotMessage formats grounded answers and refusals without ever emitting active', () => {
  const ok = buildBotMessage('q', {
    verdict: 'answered',
    answer_status: 'no_change',
    summary: 'Twenty-seven per cent.',
    citations: [{ gr_id: 'GAD-0000-019627', page: 2 }],
    warnings: [],
  }, 'en');
  assert.equal(ok.verdict, 'answered');
  assert.equal(ok.statusLabel, 'No later change');
  assert.ok(!/\bactive\b/i.test(JSON.stringify(ok)));

  const ref = buildBotMessage('q2', {
    verdict: 'insufficient_evidence',
    reason_code: 'NO_DOCUMENT',
    insufficient_reason: 'Not found in GRs.',
  });
  assert.equal(ref.answerStatus, 'insufficient');
  assert.equal(ref.reasonLabel, 'Not in the collection');
  assert.ok(CHAT_TOPICS.length >= 4);
});

test('chat: auto-detects Gujarati, Gujlish, English and resolves language switch turns', () => {
  assert.equal(detectChatLanguage('પંચવટી યોજના શું છે?'), 'gu');
  assert.equal(detectChatLanguage('Panchwati Yojna'), 'gujlish');
  assert.equal(detectChatLanguage('Aayojana Kyare chalu Thay Hati'), 'gujlish');
  assert.equal(detectChatLanguage('What are the maternity leave rules?'), 'en');

  assert.deepEqual(detectLanguageSwitchIntent('Explain in Gujarati'), {
    targetLang: 'gu',
    isPureSwitch: true,
    cleanedText: '',
  });
  assert.deepEqual(detectLanguageSwitchIntent('What is Panchvati Yojana in Gujarati'), {
    targetLang: 'gu',
    isPureSwitch: false,
    cleanedText: 'What is Panchvati Yojana',
  });
  assert.equal(detectLanguageSwitchIntent('English ma batao').targetLang, 'en');

  const turns = [
    { role: 'assistant', verdict: 'answered', question: 'What is Panchvati Yojana?', lang: 'en', citations: [] },
  ];
  const sw = resolveChatTurn('Explain in Gujarati', turns, null);
  assert.equal(sw.queryToSend, 'What is Panchvati Yojana?');
  assert.equal(sw.effectiveLang, 'gu');
  assert.equal(sw.isLanguageSwitch, true);
  assert.equal(sw.isPureSwitch, true);

  const partial = resolveChatTurn('What is Panchvati Yojana in Gujarati', turns, null);
  assert.equal(partial.isLanguageSwitch, true);
  assert.equal(partial.isPureSwitch, false);

  const guBot = buildBotMessage('પંચવટી યોજના', { verdict: 'answered', summary: 'આ યોજના ગ્રામીણ બગીચા માટે છે.' }, null);
  assert.equal(guBot.lang, 'gu');
});

test('i18n: all keys provide non-empty English and Gujarati translations', () => {
  const keys = Object.keys(TRANSLATIONS);
  assert.ok(keys.length >= 100, 'Expected comprehensive UI translation table');
  for (const k of keys) {
    assert.equal(typeof TRANSLATIONS[k].en, 'string', `Missing en translation for ${k}`);
    assert.equal(typeof TRANSLATIONS[k].gu, 'string', `Missing gu translation for ${k}`);
    assert.ok(TRANSLATIONS[k].en.trim().length > 0, `Empty en translation for ${k}`);
    assert.ok(TRANSLATIONS[k].gu.trim().length > 0, `Empty gu translation for ${k}`);
  }
});

test('i18n: translate handles locale lookup, variable substitution, and safe fallback', () => {
  assert.equal(translate('rail.inquiry', 'en'), 'Inquiry');
  assert.equal(translate('rail.inquiry', 'gu'), 'પૂછપરછ');
  assert.equal(translate('tour.progress', 'en', { n: 2, total: 11 }), 'Tour · 2 of 11');
  assert.equal(translate('tour.progress', 'gu', { n: 2, total: 11 }), 'માર્ગદર્શન · 2 / 11');
  assert.equal(translate('missing.nonexistent.key', 'gu'), 'missing.nonexistent.key');

  assert.equal(statusText('amended', 'gu').short, 'સુધારેલ');
  assert.equal(statusText('unknown_code', 'en').short, 'Insufficient evidence');
  assert.equal(reasonText('NO_DOCUMENT', 'gu'), 'સંગ્રહમાં ઉપલબ્ધ નથી');
  assert.equal(reasonText('NON_EXISTENT', 'gu'), '');

  const rec = { gr_number: 'GR-1', subject: 'Orig', subject_en: 'English title', subject_gu: 'ગુજરાતી શીર્ષક' };
  assert.equal(pickSubject(rec, 'en'), 'English title');
  assert.equal(pickSubject(rec, 'gu'), 'ગુજરાતી શીર્ષક');
  assert.equal(pickSubject({ gr_number: 'GR-2', subject: 'Fallback' }, 'gu'), 'Fallback');
});
