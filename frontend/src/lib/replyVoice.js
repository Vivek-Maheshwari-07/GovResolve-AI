// Reads a chat reply aloud: the server's neural voice (Gujarati and English) when it is available, the browser's own
// voice otherwise. One reply plays at a time; `stop()` cancels either.
import { speakAudio } from '../api.js';
import { loadSpeechVoices, speechLocale, speechVoiceForLocale } from './speech.js';

let current = null; // { stop() }

export function stopSpeaking() {
  current?.stop();
  current = null;
}

function playBlob(blob, onEnd) {
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  let finished = false;
  const done = (ok) => {
    if (finished) return;
    finished = true;
    URL.revokeObjectURL(url);
    onEnd(ok);
  };
  audio.onended = () => done(true);
  audio.onerror = () => done(false);
  const started = audio.play().catch(() => done(false));
  return { stop: () => { audio.pause(); done(true); }, started };
}

async function speakWithBrowser(text, lang, onEnd) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
    onEnd(false);
    return { stop() {} };
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const locale = speechLocale(lang, text);
  const voices = await loadSpeechVoices(synth);
  const voice = speechVoiceForLocale(voices, locale);
  if (!voice && lang === 'gu') { onEnd(false); return { stop() {} }; } // no Gujarati voice installed: say nothing rather than read it wrongly
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = locale;
  if (voice) utter.voice = voice;
  utter.onend = () => onEnd(true);
  utter.onerror = () => onEnd(false);
  synth.speak(utter);
  return { stop: () => { synth.cancel(); onEnd(true); } };
}

/**
 * Speak `text`. `onState('loading' | 'playing' | 'idle' | 'failed')` reports progress.
 * Returns a handle with `stop()`.
 */
export function speakReply(text, lang, onState = () => {}) {
  stopSpeaking();
  const ctl = new AbortController();
  let stopped = false;
  const handle = {
    stop() {
      stopped = true;
      ctl.abort();
      inner?.stop();
      onState('idle');
    },
  };
  let inner = null;
  current = handle;
  onState('loading');

  (async () => {
    try {
      const blob = await speakAudio(text, lang, ctl.signal);
      if (stopped) return;
      inner = playBlob(blob, (ok) => { if (!stopped) { stopped = true; onState(ok ? 'idle' : 'failed'); } });
      onState('playing');
      await inner.started;
    } catch {
      if (stopped) return;
      inner = await speakWithBrowser(text, lang, (ok) => { if (!stopped) { stopped = true; onState(ok ? 'idle' : 'failed'); } });
      if (!stopped) onState('playing');
    }
  })();
  return handle;
}
