/**
 * LanguageContext.jsx: the language hooks of the chat helpline (`useLanguage`, `useT`), backed by the one interface-language
 * state of `lib/i18n.jsx` (`useUiLanguage`). There is a single language selector (TopBar); the chat helpline and the meaning
 * translations read and set the same state through these hooks.
 *
 *  - `lang` is 'gu' or 'en' (Gujlish reads the English strings of the chat's own table, `bilingualStrings.js`).
 *  - `mode` is always 'auto' for the chat: a chat turn follows the language of the question unless the user asks for another.
 *  - `detectedLang` is the language of the last question or reply (see `LanguageBridge`).
 *  - `useT()` looks a key up in `translations.js` first (camelCase keys) and then in `bilingualStrings.js` (dotted keys).
 */
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useUiLanguage } from './i18n.jsx';
import { hasTranslation, translate as uiTranslate } from './translations';
import { translate as bilingualTranslate } from './bilingualStrings';

export function normalizeDetectedLang(code) {
  if (!code) return null;
  const s = String(code).trim().toLowerCase();
  if (s === 'gu' || s === 'gujlish' || s === 'mixed' || s === 'gujarati') return 'gu';
  if (s === 'en' || s === 'english') return 'en';
  return null;
}

const DetectedContext = createContext(null);

/** Holds the language detected from the last question or reply; mount it inside `LanguageProvider` (lib/i18n.jsx). */
export function LanguageBridge({ children }) {
  const [detectedLang, setDetected] = useState('en');
  const setDetectedLang = useCallback((code) => {
    const norm = normalizeDetectedLang(code);
    if (norm) setDetected(norm);
  }, []);
  const value = useMemo(() => ({ detectedLang, setDetectedLang }), [detectedLang, setDetectedLang]);
  return <DetectedContext.Provider value={value}>{children}</DetectedContext.Provider>;
}

const noop = () => {};

/** `{ lang, mode, uiLanguage, detectedLang, setLang, setDetectedLang, isGu }` over the shared interface language. */
export function useLanguage() {
  const { language, setLanguage } = useUiLanguage();
  const detected = useContext(DetectedContext);
  const lang = language === 'gu' ? 'gu' : 'en';
  const setLang = useCallback((next) => {
    if (next === 'en' || next === 'gu' || next === 'gujlish') setLanguage(next);
  }, [setLanguage]);
  return {
    lang,
    mode: 'auto',
    uiLanguage: language,
    detectedLang: detected?.detectedLang || lang,
    setLang,
    setDetectedLang: detected?.setDetectedLang || noop,
    isGu: lang === 'gu',
  };
}

/** `t(key, vars)` in the current interface language, for keys of either string table. */
export function useT() {
  const { language } = useUiLanguage();
  return useCallback((key, vars) => (
    hasTranslation(language, key) || hasTranslation('en', key)
      ? uiTranslate(language, key, vars)
      : bilingualTranslate(key, language === 'gu' ? 'gu' : 'en', vars)
  ), [language]);
}
