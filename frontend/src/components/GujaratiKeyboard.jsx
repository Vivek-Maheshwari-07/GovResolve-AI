import React from 'react';
import { Delete, X, Space } from 'lucide-react';

const SECTIONS = [
  { title: 'Numerals · અંકો', keys: ['૧', '૨', '૩', '૪', '૫', '૬', '૭', '૮', '૯', '૦'] },
  { title: 'Vowels · સ્વર', keys: ['અ', 'આ', 'ઇ', 'ઈ', 'ઉ', 'ઊ', 'ઋ', 'એ', 'ઐ', 'ઓ', 'ઔ'] },
  {
    title: 'Consonants · વ્યંજન',
    keys: [
      'ક', 'ખ', 'ગ', 'ઘ', 'ચ', 'છ', 'જ', 'ઝ', 'ટ', 'ઠ',
      'ડ', 'ઢ', 'ણ', 'ત', 'થ', 'દ', 'ધ', 'ન', 'પ', 'ફ',
      'બ', 'ભ', 'મ', 'ય', 'ર', 'લ', 'વ', 'શ', 'ષ', 'સ',
      'હ', 'ળ', 'ક્ષ', 'જ્ઞ',
    ],
  },
  { title: 'Matras & Signs · માત્રાઓ અને ચિહ્નો', keys: ['ા', 'િ', 'ી', 'ુ', 'ૂ', 'ે', 'ૈ', 'ો', 'ૌ', 'ં', 'ઃ', '્', '?', ',', '.'] },
];

// keycap: top face, inner highlight, a visible travel edge that collapses on press
const KEY =
  'gu-text h-8 min-w-[2.2rem] rounded-lg bg-gradient-to-b from-white to-[#F3F1EB] px-1.5 text-sm font-medium text-legal transition active:translate-y-px hover:text-iris-700 hover:from-iris-50 hover:to-iris-50 [box-shadow:0_0_0_1px_rgba(30,41,59,.13),0_2px_0_0_rgba(30,41,59,.12),inset_0_1px_0_#fff] active:[box-shadow:0_0_0_1px_rgba(30,41,59,.13),0_0_0_0_rgba(30,41,59,.12),inset_0_1px_2px_rgba(30,41,59,.12)]';

export default function GujaratiKeyboard({ onInsert, onClose }) {
  return (
    <div className="well select-none space-y-2.5 p-3">
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-2">
          <span className="gu-text text-xs font-semibold text-ink">ગુજરાતી કીબોર્ડ સહાયક</span>
          <span className="mono-label text-[9.5px] text-faint">Gujarati virtual keypad</span>
        </div>
        <button onClick={onClose} aria-label="Close keyboard" className="rounded-lg p-1 text-mist transition hover:bg-ivory hover:text-ink">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-2.5">
        {SECTIONS.map((sec) => (
          <div key={sec.title} className="space-y-1.5">
            <p className="mono-label px-0.5 text-[9px] text-faint">{sec.title}</p>
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

      <div className="flex items-center gap-1.5 border-t border-stone pt-2.5">
        <button type="button" onClick={() => onInsert(' ')} className={`${KEY} flex flex-1 items-center justify-center gap-1.5 !text-xs !text-mist`}>
          <Space className="h-3.5 w-3.5" /> Space
        </button>
        <button type="button" onClick={() => onInsert('\b')} aria-label="Backspace" title="Backspace" className={`${KEY} inline-flex w-14 items-center justify-center !text-mist hover:!text-[#8E1F3A]`}>
          <Delete className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
