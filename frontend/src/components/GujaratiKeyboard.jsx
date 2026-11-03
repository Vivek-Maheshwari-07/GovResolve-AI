import React from 'react';
import { Delete, X, Space } from 'lucide-react';

const SECTIONS = [
  {
    title: 'Numerals · અંકો',
    keys: ['૧', '૨', '૩', '૪', '૫', '૬', '૭', '૮', '૯', '૦'],
  },
  {
    title: 'Vowels · સ્વર',
    keys: ['અ', 'આ', 'ઇ', 'ઈ', 'ઉ', 'ઊ', 'ઋ', 'એ', 'ઐ', 'ઓ', 'ઔ'],
  },
  {
    title: 'Consonants · વ્યંજન',
    keys: [
      'ક', 'ખ', 'ગ', 'ઘ', 'ચ', 'છ', 'જ', 'ઝ', 'ટ', 'ઠ',
      'ડ', 'ઢ', 'ણ', 'ત', 'થ', 'દ', 'ધ', 'ન', 'પ', 'ફ',
      'બ', 'ભ', 'મ', 'ય', 'ર', 'લ', 'વ', 'શ', 'ષ', 'સ',
      'હ', 'ળ', 'ક્ષ', 'જ્ઞ',
    ],
  },
  {
    title: 'Matras & Signs · માત્રાઓ અને ચિહ્નો',
    keys: ['ા', 'િ', 'ી', 'ુ', 'ૂ', 'ે', 'ૈ', 'ો', 'ૌ', 'ં', 'ઃ', '્', '?', ',', '.'],
  },
];

export default function GujaratiKeyboard({ onInsert, onClose }) {
  return (
    <div className="select-none space-y-2 rounded-2xl border border-hair/90 bg-sand/70 p-3 shadow-card backdrop-blur-sm">
      <div className="flex items-center justify-between pb-1 border-b border-hair/70">
        <div className="flex items-center gap-2">
          <span className="gu-text text-xs font-semibold text-legal">ગુજરાતી કીબોર્ડ સહાયક</span>
          <span className="text-[10.5px] font-mono text-mist">· Gujarati Virtual Keypad</span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close keyboard"
          className="rounded-lg p-1 text-mist transition hover:bg-sand hover:text-legal"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-2">
        {SECTIONS.map((sec) => (
          <div key={sec.title} className="space-y-1">
            <p className="eyebrow text-mist px-0.5">{sec.title}</p>
            <div className="flex flex-wrap gap-1">
              {sec.keys.map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => onInsert(ch)}
                  className="gu-text h-8 min-w-[2.2rem] rounded-lg border border-hair bg-white px-1.5 text-sm font-medium text-legal shadow-sm transition hover:border-iris-400 hover:bg-iris-50/70 hover:text-iris-700 active:scale-95"
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Control row */}
      <div className="flex items-center gap-1.5 pt-1 border-t border-hair/70">
        <button
          type="button"
          onClick={() => onInsert(' ')}
          className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-hair bg-white text-xs font-medium text-mist shadow-sm transition hover:border-iris-300 hover:text-legal active:scale-98"
        >
          <Space className="h-3.5 w-3.5" /> Space
        </button>
        <button
          type="button"
          onClick={() => onInsert('\b')}
          aria-label="Backspace"
          title="Backspace"
          className="inline-flex h-8 w-14 items-center justify-center rounded-lg border border-hair bg-white text-mist shadow-sm transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 active:scale-95"
        >
          <Delete className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
