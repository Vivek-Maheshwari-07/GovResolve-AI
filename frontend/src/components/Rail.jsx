import React from 'react';
import { motion } from 'framer-motion';
import { MessagesSquare, Library, FlaskConical, Lightbulb, Keyboard } from 'lucide-react';
import { useT } from '../lib/LanguageContext';

const WORKSPACE_DEFS = [
  { id: 'ask', tk: 'rail.inquiry', icon: MessagesSquare, key: '1' },
  { id: 'library', tk: 'rail.library', icon: Library, key: '2' },
  { id: 'method', tk: 'rail.method', icon: FlaskConical, key: '3' },
];

function RailButton({ active, onClick, icon: Icon, label, hint, keyHint }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      title={hint}
      className={`group relative flex w-full flex-col items-center gap-1.5 rounded-xl px-1 py-2.5 text-[11px] font-semibold transition-colors ${active ? 'text-[#4F46E5]' : 'text-[#64748B] hover:text-[#1E293B]'}`}
    >
      {active && (
        <>
          <motion.span
            layoutId="rail-active"
            className="absolute inset-0 rounded-xl border border-[#E6E4DD] bg-[rgba(255,255,255,0.88)] shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)]"
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          />
          <motion.span layoutId="rail-bar" className="absolute -left-2 top-3 bottom-3 w-[3px] rounded-r-full bg-[#4F46E5]" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
        </>
      )}
      <Icon className="relative z-10 h-[19px] w-[19px] transition-transform group-hover:scale-110" strokeWidth={active ? 2.2 : 1.9} />
      <span className="relative z-10">{label}</span>
      {keyHint && <kbd className="kbd absolute right-1 top-1 z-10 scale-[.8] opacity-0 transition-opacity group-hover:opacity-100">{keyHint}</kbd>}
    </button>
  );
}

export default function Rail({ active, onChange, onTour, onShortcuts }) {
  const t = useT();
  const workspaces = WORKSPACE_DEFS.map((w) => ({ ...w, label: t(w.tk) }));
  return (
    <nav aria-label={t('rail.workspaces_aria')} data-tour="rail" className="hidden w-[76px] shrink-0 flex-col justify-between border-r border-[#E6E4DD] bg-[#F8F7F4]/80 px-2.5 py-4 backdrop-blur-md md:flex print:hidden">
      <div className="space-y-1.5">
        {workspaces.map((w) => (
          <RailButton key={w.id} active={active === w.id} onClick={() => onChange(w.id)} icon={w.icon} label={w.label} keyHint={w.key} hint={`${w.label} (${w.key})`} />
        ))}
      </div>
      <div className="space-y-1 border-t border-[#E6E4DD] pt-3">
        <RailButton onClick={onTour} icon={Lightbulb} label={t('rail.tour')} keyHint="?" hint={t('rail.tour_hint')} />
        <RailButton onClick={onShortcuts} icon={Keyboard} label={t('rail.keys')} hint={t('rail.keys_hint')} />
      </div>
    </nav>
  );
}

/** Same workspaces as a bottom bar on narrow mobile viewports. */
export function MobileTabs({ active, onChange }) {
  const t = useT();
  const workspaces = WORKSPACE_DEFS.map((w) => ({ ...w, label: t(w.tk) }));
  return (
    <nav aria-label={t('rail.workspaces_aria')} className="flex border-t border-[#E6E4DD] bg-[#F8F7F4]/95 px-2 py-1 backdrop-blur-md md:hidden print:hidden">
      {workspaces.map((w) => {
        const on = active === w.id;
        return (
          <button key={w.id} type="button" onClick={() => onChange(w.id)} className={`flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[10.5px] font-semibold transition-colors ${on ? 'text-[#4F46E5]' : 'text-[#64748B] hover:text-[#1E293B]'}`}>
            <w.icon className="h-[18px] w-[18px]" strokeWidth={on ? 2.3 : 1.9} />
            <span>{w.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
