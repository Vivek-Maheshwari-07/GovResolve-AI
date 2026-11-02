import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Sparkles, Keyboard, CornerDownLeft } from 'lucide-react';
import GujaratiKeyboard from './GujaratiKeyboard';
import { SAMPLES, KIND_STYLE } from '../lib/samples';

// Two templates to type into; the sample questions are shared with the landing view.
const TEMPLATES = [
  { label: 'GR No. lookup', text: 'GR No. ' },
  { label: 'Leave rules', text: 'Leave rules: ' },
];

export default function QueryDock({ value, onChange, onSubmit, loading, compact, focusSignal }) {
  const [kb, setKb] = useState(false);
  const ref = useRef(null);
  // focus when asked (the '/' shortcut), also right after this workspace mounts
  useEffect(() => { if (focusSignal) ref.current?.focus(); }, [focusSignal]);
  const submit = () => { if (value.trim() && !loading) onSubmit(value.trim()); };

  return (
    <div className="space-y-2.5" data-tour="ask">
      <div className="glass rounded-2xl p-2 shadow-lift transition-shadow focus-within:shadow-[0_0_0_1px_rgba(79,70,229,0.45),0_10px_30px_-14px_rgba(79,70,229,0.35)]">
        <div className="flex items-start gap-2">
          <Search className="ml-2 mt-3 h-[18px] w-[18px] shrink-0 text-indigo-500" />
          <textarea
            ref={ref}
            id="question-input"
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
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-[#F8F7F4] shadow-[0_8px_20px_-8px_rgba(109,40,217,0.6)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? <Sparkles className="h-4 w-4 animate-pulse" /> : <CornerDownLeft className="h-4 w-4" />}
              {loading ? 'Working' : 'Find'}
            </button>
            <button onClick={() => setKb((v) => !v)} className="gu-text inline-flex items-center gap-1 text-[11px] font-medium text-teal-700 transition hover:text-teal-900" aria-pressed={kb}>
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
          <button key={t.label} onClick={() => { onChange(t.text); ref.current?.focus(); }} className="rounded-full border border-indigo-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-indigo-700 transition hover:bg-indigo-50">
            {t.label}
          </button>
        ))}
        {compact && (
          <>
            <span className="mx-1 h-3 w-px bg-[#E6E4DD]" />
            {SAMPLES.map((s) => (
              <button key={s.label} onClick={() => onSubmit(s.text, true)} disabled={loading} title={s.text} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition hover:brightness-95 disabled:opacity-40 ${KIND_STYLE[s.kind].chip} ${s.kind === 'gu' ? 'gu-text' : ''}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${KIND_STYLE[s.kind].dot}`} />
                {s.label}
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
