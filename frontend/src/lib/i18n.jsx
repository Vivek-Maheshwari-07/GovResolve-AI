import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { translate, UI_LANGUAGES } from './translations';

const STORAGE_KEY = 'govresolve.ui-language';
const LanguageContext = createContext(null);

function storedLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return UI_LANGUAGES.includes(saved) ? saved : 'en';
  } catch {
    return 'en';
  }
}

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(storedLanguage);

  useEffect(() => {
    document.documentElement.lang = language === 'gujlish' ? 'en' : language;
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // The selected language still applies for this session when storage is unavailable.
    }
  }, [language]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    t: (key, values) => translate(language, key, values),
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useUiLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useUiLanguage must be used within LanguageProvider');
  return context;
}
