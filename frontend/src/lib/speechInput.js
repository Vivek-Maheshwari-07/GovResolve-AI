export function speechRecognitionConstructor(scope = globalThis) {
  return scope.SpeechRecognition || scope.webkitSpeechRecognition || null;
}

export function recognitionLocale(language) {
  return language === 'gu' || language === 'gujlish' ? 'gu-IN' : 'en-IN';
}

export function appendTranscript(current, transcript) {
  const text = transcript.trim();
  if (!text) return current;
  return `${current}${current && !/\s$/.test(current) ? ' ' : ''}${text}`;
}
