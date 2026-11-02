import React from 'react';
import { motion } from 'framer-motion';
import { MessagesSquare, Library, FlaskConical, Lightbulb, Keyboard } from 'lucide-react';

export const WORKSPACES = [
  { id: 'ask', label: 'Ask', icon: MessagesSquare, key: '1', tint: 'text-indigo-700 bg-indigo-50 ring-indigo-200' },
  { id: 'library', label: 'Library', icon: Library, key: '2', tint: 'text-teal-700 bg-teal-50 ring-teal-200' },
  { id: 'method', label: 'Method', icon: FlaskConical, key: '3', tint: 'text-violet-700 bg-violet-50 ring-violet-200' },
];

function RailButton({ active, onClick, icon: Icon, label, tint, hint }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      title={hint}
      className={`group relative flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10.5px] font-semibold transition-colors ${active ? '' : 'text-mist hover:bg-sand hover:text-legal'}`}
    >
      {active && <motion.span layoutId="rail-active" className={`absolute inset-0 rounded-xl ring-1 ${tint}`} transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
      <Icon className={`relative h-[18px] w-[18px] ${active ? tint.split(' ')[0] : ''}`} />
      <span className={`relative ${active ? tint.split(' ')[0] : ''}`}>{label}</span>
    </button>
  );
}

export default function Rail({ active, onChange, onTour, onShortcuts }) {
  return (
    <nav aria-label="Workspaces" data-tour="rail" className="hidden w-[76px] shrink-0 flex-col justify-between border-r border-hair bg-white/70 px-2 py-3 backdrop-blur-md md:flex">
      <div className="space-y-1.5">
        {WORKSPACES.map((w) => (
          <RailButton key={w.id} active={active === w.id} onClick={() => onChange(w.id)} icon={w.icon} label={w.label} tint={w.tint} hint={`${w.label} (${w.key})`} />
        ))}
      </div>
      <div className="space-y-1.5">
        <RailButton onClick={onTour} icon={Lightbulb} label="Tour" tint="" hint="Guided tour (?)" />
        <RailButton onClick={onShortcuts} icon={Keyboard} label="Keys" tint="" hint="Keyboard shortcuts" />
      </div>
    </nav>
  );
}

/** Same workspaces as a bottom bar on narrow screens. */
export function MobileTabs({ active, onChange }) {
  return (
    <nav aria-label="Workspaces" className="flex border-t border-hair bg-white/90 backdrop-blur-md md:hidden">
      {WORKSPACES.map((w) => (
        <button key={w.id} onClick={() => onChange(w.id)} className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10.5px] font-semibold ${active === w.id ? w.tint.split(' ')[0] : 'text-mist'}`}>
          <w.icon className="h-[18px] w-[18px]" />
          {w.label}
        </button>
      ))}
    </nav>
  );
}
