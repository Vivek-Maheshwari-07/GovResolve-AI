/**
 * LanguageContext.jsx — Platform-wide UI language state.
 *
 * Supports `mode` ∈ { 'auto', 'en', 'gu' } (defaults to 'auto'):
 *  - 'auto': follows the most recently detected query/voice/answer language
 *            (`detectedLang`, starting at 'en').
 *  - 'en' / 'gu': explicitly pinned by the user.
 *
 * Persists `mode` in localStorage under 'govresolve.ui.lang.mode' and keeps
 * `document.documentElement.lang` synchronized for fonts & accessibility.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { translate } from './i18n';

const STORAGE_KEY = 'govresolve.ui.lang.mode';

function readStoredMode() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return (v === 'en' || v === 'gu' || v === 'auto') ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export function normalizeDetectedLang(code) {
  if (!code) return null;
  const s = String(code).trim().toLowerCase();
  if (s === 'gu' || s === 'gujlish' || s === 'mixed' || s === 'gujarati') return 'gu';
  if (s === 'en' || s === 'english') return 'en';
  return null;
}

export const LanguageContext = createContext({
  lang: 'en',
  mode: 'auto',
  detectedLang: 'en',
  setLang: () => {},
  setDetectedLang: () => {},
});

export function LanguageProvider({ children }) {
  const [mode, setModeState] = useState(readStoredMode);
  const [detectedLang, setDetectedLangState] = useState('en');

  const lang = mode === 'auto' ? detectedLang : mode;

  useEffect(() => {
    try {
      if (typeof document !== 'undefined') {
        document.documentElement.lang = lang === 'gu' ? 'gu' : 'en';
      }
    } catch { /* ignore non-DOM environments */ }
  }, [lang]);

  const setLang = useCallback((next) => {
    const value = (next === 'en' || next === 'gu' || next === 'auto') ? next : 'auto';
    setModeState(value);
    try { localStorage.setItem(STORAGE_KEY, value); } catch { /* private mode */ }
  }, []);

  const setDetectedLang = useCallback((code) => {
    const norm = normalizeDetectedLang(code);
    if (norm) setDetectedLangState(norm);
  }, []);

  return (
    <LanguageContext.Provider value={{ lang, mode, detectedLang, setLang, setDetectedLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

/** Returns `{ lang, mode, detectedLang, setLang, setDetectedLang, isGu }`. */
export function useLanguage() {
  const ctx = useContext(LanguageContext);
  return { ...ctx, isGu: ctx.lang === 'gu' };
}

/** Returns `t(key, vars)` bound to the current UI language. */
export function useT() {
  const { lang } = useContext(LanguageContext);
  return useCallback((key, vars) => translate(key, lang, vars), [lang]);
}
