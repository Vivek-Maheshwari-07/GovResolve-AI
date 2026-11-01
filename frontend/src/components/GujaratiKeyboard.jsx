import React from 'react';
import { Delete, X } from 'lucide-react';

export default function GujaratiKeyboard({ onInsert, onClose }) {
  const characters = [
    // Numerals
    ['૧', '૨', '૩', '૪', '૫', '૬', '૭', '૮', '૯', '૦'],
    // Vowels
    ['અ', 'આ', 'ઇ', 'ઈ', 'ઉ', 'ઊ', 'ઋ', 'એ', 'ઐ', 'ઓ', 'ઔ'],
    // Consonants 1
    ['ક', 'ખ', 'ગ', 'ઘ', 'ચ', 'છ', 'જ', 'ઝ', 'ટ', 'ઠ'],
    // Consonants 2
    ['ડ', 'ઢ', 'ણ', 'ત', 'થ', 'દ', 'ધ', 'ન', 'પ', 'ફ'],
    // Consonants 3
    ['બ', 'ભ', 'મ', 'ય', 'ર', 'લ', 'વ', 'શ', 'ષ', 'સ'],
    // Consonants 4 & Signs
    ['હ', 'ળ', 'ક્ષ', 'જ્ઞ', 'ા', 'િ', 'ી', 'ુ', 'ૂ', 'ે', 'ૈ', 'ો', 'ૌ', 'ં', 'ઃ']
  ];

  return (
    <div className="bg-white border border-slate-300 rounded-xl p-3 shadow-lg space-y-2 select-none animate-in fade-in duration-150">
      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
        <span className="text-[11px] font-bold text-slate-700 font-gujarati flex items-center">
          ગુજરાતી કીબોર્ડ સહાયક (Gujarati Input Helper)
        </span>
        <button 
          onClick={onClose} 
          className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-1">
        {characters.map((row, rIdx) => (
          <div key={rIdx} className="flex flex-wrap gap-1">
            {row.map((char) => (
              <button
                key={char}
                type="button"
                onClick={() => onInsert(char)}
                className="w-7 h-7 flex items-center justify-center text-xs font-semibold rounded bg-slate-50 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-300 border border-slate-200 transition font-gujarati"
              >
                {char}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

