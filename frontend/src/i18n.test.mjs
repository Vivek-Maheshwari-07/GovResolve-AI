import test from 'node:test';
import assert from 'node:assert/strict';
import { hasTranslation, translate, TRANSLATION_KEYS, UI_LANGUAGES } from './lib/translations.js';
import { appendTranscript, recognitionLocale, speechRecognitionConstructor } from './lib/speechInput.js';

test('site language translations cover all supported languages and preserve fallback behavior', () => {
  assert.deepEqual(UI_LANGUAGES, ['en', 'gu', 'gujlish']);
  for (const language of UI_LANGUAGES) {
    for (const key of TRANSLATION_KEYS) {
      assert.equal(hasTranslation(language, key), true, `${language} is missing ${key}`);
    }
  }
  assert.equal(translate('not-supported', 'ask'), 'Ask');
  assert.equal(translate('en', 'asOf', { date: '2026-01-02' }), 'As of 2026-01-02:');
  assert.equal(translate('gu', 'asOf', { date: '2026-01-02' }), '2026-01-02ની સ્થિતિએ:');
  assert.match(translate('en', 'librarySearch'), /leave/);
  assert.doesNotMatch(translate('en', 'librarySearch'), /[\u0A80-\u0AFF]/);
});

test('speech input locale follows selected dictation language', () => {
  assert.equal(recognitionLocale('en'), 'en-IN');
  assert.equal(recognitionLocale('gu'), 'gu-IN');
  assert.equal(recognitionLocale('gujlish'), 'gu-IN');
});

test('speech input supports standard and webkit-prefixed browser implementations', () => {
  class StandardRecognition {}
  class WebkitRecognition {}
  assert.equal(speechRecognitionConstructor({ SpeechRecognition: StandardRecognition }), StandardRecognition);
  assert.equal(speechRecognitionConstructor({ webkitSpeechRecognition: WebkitRecognition }), WebkitRecognition);
  assert.equal(speechRecognitionConstructor({}), null);
});

test('dictated text appends to the existing question with clean spacing', () => {
  assert.equal(appendTranscript('What is the rule?', 'How long does it apply?'), 'What is the rule? How long does it apply?');
  assert.equal(appendTranscript('Question ', ' more details '), 'Question more details');
  assert.equal(appendTranscript('Question', '   '), 'Question');
});
