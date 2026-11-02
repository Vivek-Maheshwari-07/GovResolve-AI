import React from 'react';
import { Delete, X } from 'lucide-react';

const ROWS = [
  ['૧', '૨', '૩', '૪', '૫', '૬', '૭', '૮', '૯', '૦'],
  ['અ', 'આ', 'ઇ', 'ઈ', 'ઉ', 'ઊ', 'ઋ', 'એ', 'ઐ', 'ઓ', 'ઔ'],
  ['ક', 'ખ', 'ગ', 'ઘ', 'ચ', 'છ', 'જ', 'ઝ', 'ટ', 'ઠ'],
  ['ડ', 'ઢ', 'ણ', 'ત', 'થ', 'દ', 'ધ', 'ન', 'પ', 'ફ'],
  ['બ', 'ભ', 'મ', 'ય', 'ર', 'લ', 'વ', 'શ', 'ષ', 'સ'],
  ['હ', 'ળ', 'ક્ષ', 'જ્ઞ', 'ા', 'િ', 'ી', 'ુ', 'ૂ', 'ે', 'ૈ', 'ો', 'ૌ', 'ં', 'ઃ'],
];

export default function GujaratiKeyboard({ onInsert, onClose }) {
  return (
    <div className="select-none space-y-1.5 rounded-xl border border-hair bg-sand/60 p-2.5">
      <div className="flex items-center justify-between">
        <span className="gu-text text-[11px] font-medium text-mist">ગુજરાતી કીબોર્ડ સહાયક · Gujarati input helper</span>
        <button onClick={onClose} aria-label="Close keyboard" className="rounded p-0.5 text-mist transition hover:text-legal"><X className="h-3.5 w-3.5" /></button>
      </div>
      {ROWS.map((row, i) => (
        <div key={i} className="flex flex-wrap gap-1">
          {row.map((ch) => (
            <button key={ch} onClick={() => onInsert(ch)} className="gu-text h-8 min-w-[2rem] rounded-md border border-hair bg-sand px-1.5 text-sm text-legal transition hover:border-[rgba(79,70,229,0.4)] hover:bg-[rgba(79,70,229,0.15)]">
              {ch}
            </button>
          ))}
        </div>
      ))}
      <div className="flex gap-1 pt-0.5">
        <button onClick={() => onInsert(' ')} className="h-8 flex-1 rounded-md border border-hair bg-sand text-[11px] text-mist transition hover:text-legal">space</button>
        <button onClick={() => onInsert('\b')} aria-label="Backspace" className="inline-flex h-8 w-12 items-center justify-center rounded-md border border-hair bg-sand text-mist transition hover:text-legal"><Delete className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
