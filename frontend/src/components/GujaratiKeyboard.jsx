import React from 'react';
import { Delete, X, Space } from 'lucide-react';
import { useT } from '../lib/LanguageContext';

const SECTIONS = [
  { tk: 'kb.sec_numerals', keys: ['૧', '૨', '૩', '૪', '૫', '૬', '૭', '૮', '૯', '૦'] },
  { tk: 'kb.sec_vowels', keys: ['અ', 'આ', 'ઇ', 'ઈ', 'ઉ', 'ઊ', 'ઋ', 'એ', 'ઐ', 'ઓ', 'ઔ'] },
  {
    tk: 'kb.sec_consonants',
    keys: [
      'ક', 'ખ', 'ગ', 'ઘ', 'ચ', 'છ', 'જ', 'ઝ', 'ટ', 'ઠ',
      'ડ', 'ઢ', 'ણ', 'ત', 'થ', 'દ', 'ધ', 'ન', 'પ', 'ફ',
      'બ', 'ભ', 'મ', 'ય', 'ર', 'લ', 'વ', 'શ', 'ષ', 'સ',
      'હ', 'ળ', 'ક્ષ', 'જ્ઞ',
    ],
  },
  { tk: 'kb.sec_matras', keys: ['ા', 'િ', 'ી', 'ુ', 'ૂ', 'ે', 'ૈ', 'ો', 'ૌ', 'ં', 'ઃ', '્', '?', ',', '.'] },
];

// Keycap with comfortable touch/click hitbox (h-9, min-w-[2.5rem]) and tactile feedback
const KEY =
  'gu-text h-9 min-w-[2.5rem] rounded-lg border border-[#E6E4DD] bg-[rgba(255,255,255,0.92)] px-2 text-[14.5px] font-medium text-[#1E293B] transition-all hover:bg-[#EEF2FF] hover:text-[#4F46E5] hover:border-[#C7D2FE] active:scale-95 active:bg-[#E0E7FF] shadow-[0_1px_2px_rgba(15,23,42,0.04)]';

export default function GujaratiKeyboard({ onInsert, onClose }) {
  const t = useT();
  return (
    <div className="select-none space-y-3 rounded-xl border border-[#E6E4DD] bg-[#F1EFEA]/80 p-3.5 shadow-sm">
      <div className="flex items-center justify-between border-b border-[#E6E4DD] pb-2">
        <div className="flex items-center gap-2">
          <span className="gu-text text-[13px] font-semibold text-[#1E293B]">{t('kb.title')}</span>
          <span className="mono-label text-[9.5px] text-[#64748B]">{t('kb.subtitle')}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('kb.close')}
          className="rounded-lg p-1 text-[#64748B] transition hover:bg-[rgba(255,255,255,0.88)] hover:text-[#1E293B]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3">
        {SECTIONS.map((sec) => (
          <div key={sec.tk} className="space-y-1.5">
            <p className="mono-label px-0.5 text-[9px] text-[#64748B]">{t(sec.tk)}</p>
            <div className="flex flex-wrap gap-1.5">
              {sec.keys.map((ch) => (
                <button key={ch} type="button" onClick={() => onInsert(ch)} className={KEY}>
                  {ch}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-[#E6E4DD] pt-3">
        <button type="button" onClick={() => onInsert(' ')} className={`${KEY} flex flex-1 items-center justify-center gap-2 text-[12.5px] text-[#64748B]`}>
          <Space className="h-4 w-4" /> {t('kb.space')}
        </button>
        <button
          type="button"
          onClick={() => onInsert('\b')}
          aria-label={t('kb.backspace')}
          title={t('kb.backspace')}
          className={`${KEY} inline-flex w-16 items-center justify-center text-[#64748B] hover:text-[#9F1239] hover:border-[#FECDD3] hover:bg-[#FFF1F2]`}
        >
          <Delete className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
