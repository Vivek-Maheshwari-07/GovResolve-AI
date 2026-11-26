const HAS_GUJARATI = /[\u0A80-\u0AFF]/;

export function speechLocale(language, text = '') {
  if (language === 'gu' || HAS_GUJARATI.test(text)) return 'gu-IN';
  return 'en-IN';
}

export function speechVoiceForLocale(voices, locale) {
  const language = String(locale || '').toLowerCase();
  if (!language) return undefined;
  const baseLanguage = language.split('-')[0];
  const available = Array.isArray(voices) ? voices : [];
  return available.find((voice) => String(voice.lang || '').toLowerCase() === language)
    || available.find((voice) => String(voice.lang || '').toLowerCase().split('-')[0] === baseLanguage);
}

export function loadSpeechVoices(synthesis, timeoutMs = 1200) {
  const current = synthesis.getVoices();
  if (current.length) return Promise.resolve(current);

  return new Promise((resolve) => {
    let settled = false;
    let timer;
    const finish = (voices) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      synthesis.removeEventListener?.('voiceschanged', onVoicesChanged);
      resolve(voices);
    };
    const onVoicesChanged = () => {
      const voices = synthesis.getVoices();
      if (voices.length) finish(voices);
    };

    synthesis.addEventListener?.('voiceschanged', onVoicesChanged);
    timer = setTimeout(() => finish(synthesis.getVoices()), timeoutMs);
  });
}
