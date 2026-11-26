// Run: npm test   (no browser)
import test from 'node:test';
import assert from 'node:assert/strict';
import { statusAsOf, issuedCount, courtCitation, reportText } from './lib/lineage.js';
import { STATUS } from './lib/status.js';
import { TRANSLATIONS, translate, statusText, reasonText, pickSubject } from './lib/i18n.js';
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
