// Decides when a person has really finished speaking, so a short pause in the middle of a sentence does not end the recording.
// Pure functions with explicit timestamps: no browser APIs, so `node --test` covers them.

export const ENDPOINT_DEFAULTS = {
  calibrateMs: 350,        // listen to the room first to learn the background noise
  minThreshold: 0.02,      // never treat anything quieter than this (RMS 0-1) as speech
  maxThreshold: 0.06,      // a noisy room must not make the threshold so high that normal speech is missed
  noiseMultiplier: 3,
  minSpeechMs: 150,        // a click or a cough is shorter than this
  silenceMs: 1800,         // silence that ends a normal-length utterance
  shortUtteranceMs: 2500,  // a very short utterance is often a person still thinking: wait longer
  shortSilenceMs: 2600,
  incompleteBonusMs: 1000, // extra wait when the words so far end mid-sentence ("... and", "... ના")
  noSpeechMs: 8000,        // nothing was said at all
  maxMs: 60000,            // safety cap
};

// A sentence that ends on one of these (or on a comma) is probably not finished.
const TRAILING_WORDS = new Set([
  'and', 'or', 'but', 'the', 'a', 'an', 'of', 'for', 'to', 'in', 'on', 'at', 'by', 'with', 'about', 'under', 'that', 'which',
  'if', 'because', 'when', 'what', 'is', 'are', 'was', 'were', 'who', 'how', 'whether', 'also', 'then', 'so',
  'અને', 'કે', 'તો', 'માટે', 'ની', 'નો', 'નું', 'ના', 'માં', 'થી', 'પર', 'જો', 'કારણ', 'તથા', 'પણ', 'અથવા', 'એટલે', 'જે',
  'che', 'chhe', 'ane', 'ke', 'to', 'mate', 'ni', 'no', 'nu', 'na', 'ma', 'thi', 'par', 'jo',
]);

/** True when the transcript so far looks like a sentence that has not finished yet. */
export function looksIncomplete(text) {
  const s = String(text || '').trim();
  if (!s) return false;
  if (/[,;:…-]$|\.\.\.$/.test(s)) return true;
  if (/[.?!।]$/.test(s)) return false;
  const last = s.toLowerCase().split(/\s+/).pop().replace(/[^\p{L}\p{M}]+/gu, '');
  return TRAILING_WORDS.has(last);
}

/**
 * Feed it one loudness reading (RMS 0-1) at a time with the current time in ms.
 * `push(rms, now, { incomplete })` returns null while recording should go on, otherwise why it should stop:
 *   'end' (finished speaking) | 'nospeech' (nothing was said) | 'max' (time cap).
 */
export function createEndpointer(options = {}) {
  const o = { ...ENDPOINT_DEFAULTS, ...options };
  let start = null;
  let lastTick = null;
  let threshold = null;
  const calibration = [];
  let run = 0;
  let speechStart = null;
  let lastVoiced = null;
  let done = false;

  return {
    get threshold() { return threshold; },
    get speechStarted() { return speechStart !== null; },
    push(rms, now, hint = {}) {
      if (done) return null;
      if (start === null) { start = now; lastTick = now; }
      const dt = now - lastTick;
      lastTick = now;
      if (now - start >= o.maxMs) { done = true; return 'max'; }

      if (threshold === null) {
        calibration.push(rms);
        if (now - start < o.calibrateMs) return null;
        // the quietest quarter of readings is the room, even if the person began speaking straight away
        const sorted = [...calibration].sort((a, b) => a - b);
        const noise = sorted[Math.floor(sorted.length * 0.25)] ?? 0;
        threshold = Math.min(o.maxThreshold, Math.max(o.minThreshold, noise * o.noiseMultiplier));
        return null;
      }

      if (rms > threshold) {
        run += dt;
        lastVoiced = now;
        if (speechStart === null && run >= o.minSpeechMs) speechStart = now - run;
      } else {
        run = Math.max(0, run - dt);
      }

      if (speechStart === null) {
        if (now - start >= o.noSpeechMs) { done = true; return 'nospeech'; }
        return null;
      }
      const spoken = lastVoiced - speechStart;
      let need = spoken < o.shortUtteranceMs ? o.shortSilenceMs : o.silenceMs;
      if (hint.incomplete) need += o.incompleteBonusMs;
      if (now - lastVoiced >= need) { done = true; return 'end'; }
      return null;
    },
  };
}
