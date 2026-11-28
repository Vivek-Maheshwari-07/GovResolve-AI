// Browser speech recognition (Web Speech API) that does not cut you off at the first pause.
//
// The browser's own end-of-speech detection is short, so a breath in the middle of a sentence ends the recognition.
// This keeps listening (continuous mode, restarting if the browser stops by itself) and ends only after a silence that
// suits what has been said so far (see endpointing.js). Text from before a browser restart is kept.
import { ENDPOINT_DEFAULTS, looksIncomplete } from './endpointing.js';

const joinText = (a, b) => `${a}${a && b ? ' ' : ''}${b}`.trim();

/**
 * @param {object} p
 * @param {Function} p.Recognition   SpeechRecognition constructor
 * @param {string}   p.lang          e.g. 'gu-IN'
 * @param {Function} p.onInterim     (text) => void, the whole utterance so far
 * @param {Function} p.onEnd         ({ text, reason }) => void, once; reason: 'silence' | 'stopped' | 'nospeech' | 'max' | 'error' | 'ended'
 * @param {Function} p.onError       (code) => void
 * @param {object}   p.options       endpointing overrides
 * @returns {{ start(): void, stop(): void, abort(): void }}
 */
export function createSpeechSession({ Recognition, lang, onInterim = () => {}, onEnd = () => {}, onError = () => {}, options = {} }) {
  const o = { ...ENDPOINT_DEFAULTS, ...options };
  let rec = null;
  let committed = '';   // text from earlier browser recognitions in this session
  let current = '';     // text of the running recognition
  let heard = false;
  let finishing = null; // reason, once we decided to stop
  let ended = false;
  let discarded = false;
  let silenceTimer = null;
  let maxTimer = null;
  let forceTimer = null;
  let startedAt = 0;

  const fullText = () => joinText(committed, current);

  const emitEnd = (reason) => {
    if (ended) return;
    ended = true;
    clearTimeout(silenceTimer);
    clearTimeout(maxTimer);
    clearTimeout(forceTimer);
    if (!discarded) onEnd({ text: fullText(), reason });
  };

  const finish = (reason) => {
    if (finishing || ended) return;
    finishing = reason;
    clearTimeout(silenceTimer);
    try { rec?.stop(); } catch { /* already stopped */ }
    // `onend` normally follows; do not wait for it forever
    forceTimer = setTimeout(() => emitEnd(reason), 1500);
  };

  const armSilence = () => {
    clearTimeout(silenceTimer);
    if (finishing || ended) return;
    let wait;
    if (!heard) {
      wait = Math.max(0, o.noSpeechMs - (Date.now() - startedAt));
      silenceTimer = setTimeout(() => finish('nospeech'), wait);
      return;
    }
    const text = fullText();
    wait = text.length < 12 ? o.shortSilenceMs : o.silenceMs;
    if (looksIncomplete(text)) wait += o.incompleteBonusMs;
    silenceTimer = setTimeout(() => finish('silence'), wait);
  };

  const open = () => {
    rec = new Recognition();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    current = '';
    rec.onresult = (ev) => {
      let text = '';
      for (let i = 0; i < ev.results.length; i += 1) text += ` ${ev.results[i]?.[0]?.transcript || ''}`;
      current = text.trim();
      if (!current) return;
      heard = true;
      onInterim(fullText());
      armSilence();
    };
    rec.onerror = (ev) => {
      const code = ev?.error || 'error';
      if (code === 'no-speech' || code === 'aborted') return; // not fatal: onend decides whether to restart
      onError(code);
      finish('error');
    };
    rec.onend = () => {
      if (ended) return;
      if (finishing) { emitEnd(finishing); return; }
      // the browser stopped by itself (it does after a while, or at a long quiet): keep what we have and listen again
      committed = fullText();
      current = '';
      if (Date.now() - startedAt >= o.maxMs) { emitEnd('max'); return; }
      try { open(); rec.start(); } catch { emitEnd('ended'); }
    };
  };

  return {
    start() {
      startedAt = Date.now();
      open();
      rec.start();
      maxTimer = setTimeout(() => finish('max'), o.maxMs);
      armSilence();
    },
    /** The person tapped stop: finish now with what was heard. */
    stop() { finish('stopped'); },
    /** Throw it away: no `onEnd`. */
    abort() {
      discarded = true;
      clearTimeout(silenceTimer);
      clearTimeout(maxTimer);
      clearTimeout(forceTimer);
      ended = true;
      if (rec) {
        rec.onresult = null; rec.onerror = null; rec.onend = null;
        try { rec.abort(); } catch { /* ignore */ }
      }
    },
  };
}
