import React from 'react';
import { motion } from 'framer-motion';
import { Globe } from 'lucide-react';
import { useLanguage, useT } from '../lib/LanguageContext';

const OPTIONS = [
  { id: 'auto', tk: 'topbar.ui_auto' },
  { id: 'en', tk: 'topbar.lang_en' },
  { id: 'gu', tk: 'topbar.lang_gu', gu: true },
];

/** Single across-platform language switch (`Auto | English | ગુજરાતી`). */
export default function LanguageSwitch({ pillId = 'platform-lang-pill', compact = false }) {
  const t = useT();
  const { mode, detectedLang, setLang } = useLanguage();
  const autoTag = detectedLang === 'gu' ? 'ગુ' : 'EN';

  return (
    <div
      role="group"
      aria-label={t('topbar.ui_lang_label')}
      title={t('topbar.ui_lang_title')}
      className="flex items-center gap-0.5 rounded-xl border border-[#E6E4DD] bg-[#F1EFEA] p-0.5"
    >
      <Globe className="ml-1.5 mr-0.5 h-3.5 w-3.5 shrink-0 text-[#4F46E5]" aria-hidden="true" />
      {OPTIONS.map((opt) => {
        const on = mode === opt.id;
        const lbl = opt.id === 'auto' ? `${t(opt.tk)} · ${autoTag}` : t(opt.tk);
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => setLang(opt.id)}
            aria-pressed={on}
            className={`relative rounded-[9px] ${compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-[11.5px]'} font-semibold transition-colors ${
              on ? 'text-[#4F46E5]' : 'text-[#64748B] hover:text-[#1E293B]'
            } ${opt.gu || (opt.id === 'auto' && detectedLang === 'gu') ? 'gu-text' : ''}`}
          >
            {on && (
              <motion.span
                layoutId={pillId}
                className="absolute inset-0 rounded-[9px] border border-[#E6E4DD] bg-[rgba(255,255,255,0.95)] shadow-sm"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative z-10">{lbl}</span>
          </button>
        );
      })}
    </div>
  );
}
