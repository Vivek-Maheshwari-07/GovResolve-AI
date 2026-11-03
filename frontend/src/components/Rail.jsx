import React from 'react';
import { motion } from 'framer-motion';
import { MessagesSquare, Library, FlaskConical, Lightbulb, Keyboard } from 'lucide-react';

const WORKSPACES = [
  { id: 'ask', label: 'Inquiry', icon: MessagesSquare, key: '1' },
  { id: 'library', label: 'Library', icon: Library, key: '2' },
  { id: 'method', label: 'Method', icon: FlaskConical, key: '3' },
];

function RailButton({ active, onClick, icon: Icon, label, hint, keyHint }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      title={hint}
      className={`group relative flex w-full flex-col items-center gap-1.5 rounded-xl px-1 py-2.5 text-[11px] font-semibold transition-colors ${active ? 'text-iris-700' : 'text-mist hover:text-ink'}`}
    >
      {active && (
        <>
          <motion.span
            layoutId="rail-active"
            className="absolute inset-0 rounded-xl bg-ivory"
            style={{ boxShadow: '0 0 0 1px rgba(79,70,229,.22), 0 6px 14px -8px rgba(79,70,229,.45), inset 0 1px 0 #fff' }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          />
          <motion.span layoutId="rail-bar" className="absolute -left-2 top-3 bottom-3 w-[3px] rounded-r-full bg-iris-600" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
        </>
      )}
      <Icon className="relative z-10 h-[19px] w-[19px] transition-transform group-hover:scale-110" strokeWidth={active ? 2.2 : 1.9} />
      <span className="relative z-10">{label}</span>
      {keyHint && <kbd className="kbd absolute right-1 top-1 z-10 scale-[.8] opacity-0 transition-opacity group-hover:opacity-100">{keyHint}</kbd>}
    </button>
  );
}

export default function Rail({ active, onChange, onTour, onShortcuts }) {
  return (
    <nav aria-label="Workspaces" data-tour="rail" className="hidden w-[76px] shrink-0 flex-col justify-between border-r border-hair bg-canvas/60 px-2.5 py-4 backdrop-blur-md md:flex">
      <div className="space-y-1.5">
        {WORKSPACES.map((w) => (
          <RailButton key={w.id} active={active === w.id} onClick={() => onChange(w.id)} icon={w.icon} label={w.label} keyHint={w.key} hint={`${w.label} workspace (${w.key})`} />
        ))}
      </div>
      <div className="space-y-1 border-t border-hair pt-3">
        <RailButton onClick={onTour} icon={Lightbulb} label="Tour" keyHint="?" hint="Interactive guided tour (?)" />
        <RailButton onClick={onShortcuts} icon={Keyboard} label="Keys" hint="Keyboard shortcuts" />
      </div>
    </nav>
  );
}

/** Same workspaces as a bottom bar on narrow mobile viewports. */
export function MobileTabs({ active, onChange }) {
  return (
    <nav aria-label="Workspaces" className="flex border-t border-hair bg-canvas/95 px-2 py-1 backdrop-blur-md md:hidden">
      {WORKSPACES.map((w) => {
        const on = active === w.id;
        return (
          <button key={w.id} type="button" onClick={() => onChange(w.id)} className={`flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[10.5px] font-semibold transition-colors ${on ? 'text-iris-700' : 'text-mist hover:text-ink'}`}>
            <w.icon className="h-[18px] w-[18px]" strokeWidth={on ? 2.3 : 1.9} />
            <span>{w.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
