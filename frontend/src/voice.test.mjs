import test from 'node:test';
import assert from 'node:assert/strict';
import { createEndpointer, looksIncomplete } from './lib/endpointing.js';
import { createSpeechSession } from './lib/speechSession.js';
import { replyTargetLang } from './lib/chat.js';

// Drive the endpointer with a list of [durationMs, rms] segments at 50 ms per reading; returns the stop reason and when.
function run(segments, hint = {}, options = {}) {
  const ep = createEndpointer(options);
  let t = 0;
  for (const [ms, rms] of segments) {
    for (let i = 0; i < ms / 50; i += 1) {
      t += 50;
      const r = ep.push(rms, t, hint);
      if (r) return { reason: r, at: t };
    }
  }
  return { reason: null, at: t };
}

const QUIET = 0.005;
const SPEECH = 0.12;

test('a one second pause in the middle of a sentence does not end the recording', () => {
  const r = run([[400, QUIET], [2000, SPEECH], [1000, QUIET], [2000, SPEECH], [3000, QUIET]]);
  assert.equal(r.reason, 'end');
  assert.ok(r.at > 400 + 2000 + 1000 + 2000 + 1800 - 100, `ended too early at ${r.at}`);
});

test('a long utterance ends after about 1.8 s of silence', () => {
  const r = run([[400, QUIET], [4000, SPEECH], [3000, QUIET]]);
  assert.equal(r.reason, 'end');
  const silence = r.at - 4400;
  assert.ok(silence >= 1750 && silence <= 1900, `silence was ${silence}`);
});

test('a very short utterance waits longer, and a sentence that ends mid-way waits longer still', () => {
  const short = run([[400, QUIET], [1000, SPEECH], [5000, QUIET]]);
  assert.equal(short.reason, 'end');
  assert.ok(short.at - 1400 >= 2550, `short utterance ended after ${short.at - 1400} ms of silence`);
  const incomplete = run([[400, QUIET], [4000, SPEECH], [5000, QUIET]], { incomplete: true });
  assert.ok(incomplete.at - 4400 >= 2750, 'incomplete sentence should wait about 1 s more');
});

test('nothing said gives up after the no-speech window; coughs shorter than 150 ms are not speech', () => {
  assert.equal(run([[9000, QUIET]]).reason, 'nospeech');
  assert.equal(run([[500, QUIET], [100, SPEECH], [9000, QUIET]]).reason, 'nospeech');
});

test('the recording is capped', () => {
  assert.equal(run([[400, QUIET], [70000, SPEECH]]).reason, 'max');
});

test('a noisy room raises the threshold but never above the cap', () => {
  const ep = createEndpointer();
  for (let t = 50; t <= 400; t += 50) ep.push(0.04, t);
  assert.ok(ep.threshold <= 0.06 && ep.threshold >= 0.02);
});

test('looksIncomplete spots sentences that stop mid-way, in English and Gujarati', () => {
  assert.equal(looksIncomplete('What is the leave rule for'), true);
  assert.equal(looksIncomplete('What is the leave rule and'), true);
  assert.equal(looksIncomplete('પંચવટી યોજના શું છે અને'), true);
  assert.equal(looksIncomplete('Tell me about the rules,'), true);
  assert.equal(looksIncomplete('What is the leave rule?'), false);
  assert.equal(looksIncomplete('પંચવટી યોજના શું છે'), false);
  assert.equal(looksIncomplete(''), false);
});

// A stand-in for the browser's SpeechRecognition.
function fakeRecognition(log) {
  return class FakeRecognition {
    constructor() { log.instances.push(this); }
    start() { log.starts += 1; }
    stop() { setTimeout(() => this.onend?.(), 0); }
    abort() { log.aborted = true; }
    say(chunks) { this.onresult({ results: chunks.map((c) => [{ transcript: c }]) }); }
  };
}

test('speech session keeps listening through a pause and joins text across a browser restart', async () => {
  const log = { instances: [], starts: 0 };
  const ended = [];
  const s = createSpeechSession({
    Recognition: fakeRecognition(log), lang: 'en-IN', onEnd: (e) => ended.push(e),
    options: { silenceMs: 80, shortSilenceMs: 80, incompleteBonusMs: 0, noSpeechMs: 500 },
  });
  s.start();
  log.instances[0].say(['what is the leave rule']);
  log.instances[0].onend();                       // the browser stops by itself after a pause
  assert.equal(log.instances.length, 2, 'it listens again');
  assert.equal(ended.length, 0);
  log.instances[1].say(['for casual leave']);
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(ended.length, 1);
  assert.equal(ended[0].text, 'what is the leave rule for casual leave');
  assert.equal(ended[0].reason, 'silence');
});

test('speech session: tapping stop ends with what was heard; abort ends with nothing; silence ends as nospeech', async () => {
  let log = { instances: [], starts: 0 };
  let ended = [];
  let s = createSpeechSession({ Recognition: fakeRecognition(log), lang: 'gu-IN', onEnd: (e) => ended.push(e) });
  s.start();
  log.instances[0].say(['પંચવટી યોજના']);
  s.stop();
  await new Promise((r) => setTimeout(r, 50));
  assert.deepEqual(ended, [{ text: 'પંચવટી યોજના', reason: 'stopped' }]);

  log = { instances: [], starts: 0 }; ended = [];
  s = createSpeechSession({ Recognition: fakeRecognition(log), lang: 'en-IN', onEnd: (e) => ended.push(e) });
  s.start();
  log.instances[0].say(['hello']);
  s.abort();
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(ended.length, 0);

  log = { instances: [], starts: 0 }; ended = [];
  s = createSpeechSession({ Recognition: fakeRecognition(log), lang: 'en-IN', onEnd: (e) => ended.push(e), options: { noSpeechMs: 60 } });
  s.start();
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(ended[0]?.reason, 'nospeech');
  assert.equal(ended[0]?.text, '');
});

test('reply language: a fixed choice wins; auto follows the language of the question', () => {
  const gu = { question: 'પંચવટી યોજના શું છે' };
  const en = { question: 'What is the leave rule?' };
  assert.equal(replyTargetLang(gu, 'auto'), 'gu');
  assert.equal(replyTargetLang(en, 'auto'), 'en');
  assert.equal(replyTargetLang(en, 'gu'), 'gu');
  assert.equal(replyTargetLang(gu, 'en'), 'en');
  assert.equal(replyTargetLang({ question: 'leave ketla male che' }, 'auto'), 'gu'); // Gujlish gets a Gujarati answer
});

test('the two Gujlish questions that slipped through are recognised as Gujlish (so Auto answers them in Gujarati)', async () => {
  const { detectChatLanguage } = await import('./lib/chat.js');
  assert.equal(detectChatLanguage('Covid vaccine certificate na hoy to sarkari kacheri ma pravesh mate shu chalse?'), 'gujlish');
  assert.equal(detectChatLanguage("Gujarat Minister's Travelling Allowances (Amendment) Rules 2022 kya divas thi amal ma gana jashe?"), 'gujlish');
  // plain English must stay English, including questions with words that look Indian ("PAN card")
  assert.equal(detectChatLanguage('What documents are required for a PAN card under the leave rules?'), 'en');
  assert.equal(detectChatLanguage('From which date do the Minister travelling allowance rules apply?'), 'en');
});

test('a model refusing to translate is never shown as the translation', async () => {
  const { looksLikeModelRefusal } = await import('./api.js');
  assert.equal(looksLikeModelRefusal('I’m sorry, but I can’t provide a translation because the referenced Gujarati text is not available.'), true);
  assert.equal(looksLikeModelRefusal("I'm unable to translate this."), true);
  assert.equal(looksLikeModelRefusal('Sorry, no text was provided.'), true);
  assert.equal(looksLikeModelRefusal('The rules come into force on 22 March 2022.'), false);
  assert.equal(looksLikeModelRefusal('સરકારી કચેરીમાં પ્રવેશ'), false);
  assert.equal(looksLikeModelRefusal(''), false);
});
