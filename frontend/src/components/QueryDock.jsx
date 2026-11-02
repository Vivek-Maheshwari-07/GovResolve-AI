import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Sparkles, Keyboard, CornerDownLeft } from 'lucide-react';
import GujaratiKeyboard from './GujaratiKeyboard';

// Starters: a few real questions from the demo set, and two templates to type into.
const SAMPLES = [
  { label: 'Mobile tariff date', text: 'From which date did the new mobile phone tariff for government use apply, and whose offer was accepted?' },
  { label: 'Age limit relaxed (2022)', text: 'By how much was the upper age limit relaxed for direct selection under the Gujarat Civil Services Classification and Recruitment (General) Rules, 1967, in 2022?' },
  { label: 'ગુજરાતી પ્રશ્ન', text: '૨૬ નવેમ્બર ૨૦૨૦ના રોજ બંધારણના આમુખના વાંચનનો રાજ્ય સરકારનો કાર્યક્રમ સચિવાલયમાં ક્યાં યોજાશે?', gu: true },
  { label: 'Gujlish', text: 'Government na mobile phone mate navo tariff kya divas thi lagu thayo ane kai company ni offer swikari?' },
  { label: 'Not in the corpus', text: 'How many days of maternity leave are allowed to women government employees?' },
];
const TEMPLATES = [
  { label: 'GR No. lookup', text: 'GR No. ' },
  { label: 'Leave rules', text: 'Leave rules: ' },
];

export default function QueryDock({ value, onChange, onSubmit, loading }) {
  const [kb, setKb] = useState(false);
  const ref = useRef(null);
  const submit = () => { if (value.trim() && !loading) onSubmit(value.trim()); };

  return (
    <div className="space-y-2.5">
      <div className="glass rounded-2xl p-2 shadow-lift transition-shadow focus-within:shadow-[0_0_0_1px_rgba(79,70,229,0.45),0_10px_30px_-14px_rgba(79,70,229,0.35)]">
        <div className="flex items-start gap-2">
          <Search className="ml-2 mt-3 h-[18px] w-[18px] shrink-0 text-mist" />
          <textarea
            ref={ref}
            rows={2}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder="Ask in Gujarati, English or Gujlish — e.g. “પ્રસૂતિ રજા માટે કયા documents જોઈએ?”"
            aria-label="Your question"
            maxLength={2000}
            className="gu-text max-h-40 min-h-[3rem] flex-1 resize-none bg-transparent py-2 text-[15px] text-legal placeholder:text-[#8A94A6] outline-none"
          />
          <div className="flex shrink-0 flex-col items-end gap-1.5 pb-0.5">
            <button
              onClick={submit}
              disabled={!value.trim() || loading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-iris-500 to-iris-400 px-3.5 py-2 text-sm font-semibold text-[#F8F7F4] shadow-[0_6px_16px_-6px_rgba(79,70,229,0.5)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? <Sparkles className="h-4 w-4 animate-pulse" /> : <CornerDownLeft className="h-4 w-4" />}
              {loading ? 'Working' : 'Find'}
            </button>
            <button onClick={() => setKb((v) => !v)} className="inline-flex items-center gap-1 text-[11px] text-mist transition hover:text-legal" aria-pressed={kb}>
              <Keyboard className="h-3.5 w-3.5" /> ગુજરાતી
            </button>
          </div>
        </div>
        <AnimatePresence initial={false}>
          {kb && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 36 }} className="overflow-hidden">
              <div className="pt-2">
                <GujaratiKeyboard onInsert={(ch) => { onChange(ch === '\b' ? [...value].slice(0, -1).join('') : value + ch); ref.current?.focus(); }} onClose={() => setKb(false)} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {TEMPLATES.map((t) => (
          <button key={t.label} onClick={() => { onChange(t.text); ref.current?.focus(); }} className="rounded-full border border-[rgba(79,70,229,0.3)] bg-[rgba(79,70,229,0.1)] px-2.5 py-1 text-[11px] font-medium text-iris-700 transition hover:bg-iris-100">
            {t.label}
          </button>
        ))}
        <span className="mx-1 h-3 w-px bg-[#E6E4DD]" />
        <span className="text-[11px] text-[#8A94A6]">Try</span>
        {SAMPLES.map((s) => (
          <button key={s.label} onClick={() => onSubmit(s.text, true)} disabled={loading} className={`rounded-full border border-hair bg-sand/60 px-2.5 py-1 text-[11px] text-mist transition hover:border-[rgba(79,70,229,0.35)] hover:text-legal disabled:opacity-40 ${s.gu ? 'gu-text' : ''}`}>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
