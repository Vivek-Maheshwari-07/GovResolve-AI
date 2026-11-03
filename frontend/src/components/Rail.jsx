import React from 'react';
import { motion } from 'framer-motion';
import { MessagesSquare, Library, FlaskConical, Lightbulb, Keyboard } from 'lucide-react';

export const WORKSPACES = [
  { id: 'ask', label: 'Inquiry', icon: MessagesSquare, key: '1', tint: 'text-iris-700 bg-iris-50 ring-iris-200 border-iris-200' },
  { id: 'library', label: 'Library', icon: Library, key: '2', tint: 'text-iris-700 bg-iris-50 ring-iris-200 border-iris-200' },
  { id: 'method', label: 'Method', icon: FlaskConical, key: '3', tint: 'text-iris-700 bg-iris-50 ring-iris-200 border-iris-200' },
];

function RailButton({ active, onClick, icon: Icon, label, tint, hint }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      title={hint}
      className={`group relative flex w-full flex-col items-center gap-1.5 rounded-xl px-1 py-2.5 text-[11px] font-bold transition-all ${
        active ? '' : 'text-mist hover:bg-sand hover:text-legal'
      }`}
    >
      {active && (
        <motion.span
          layoutId="rail-active"
          className={`absolute inset-0 rounded-xl ring-1 shadow-sm ${tint}`}
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        />
      )}
      <Icon className={`relative z-10 h-5 w-5 ${active ? tint.split(' ')[0] : 'transition-transform group-hover:scale-105'}`} />
      <span className={`relative z-10 ${active ? tint.split(' ')[0] : ''}`}>{label}</span>
    </button>
  );
}

export default function Rail({ active, onChange, onTour, onShortcuts }) {
  return (
    <nav
      aria-label="Workspaces"
      data-tour="rail"
      className="hidden w-[76px] shrink-0 flex-col justify-between border-r border-hair bg-white/70 px-2 py-4 backdrop-blur-md md:flex"
    >
      <div className="space-y-2">
        {WORKSPACES.map((w) => (
          <RailButton
            key={w.id}
            active={active === w.id}
            onClick={() => onChange(w.id)}
            icon={w.icon}
            label={w.label}
            tint={w.tint}
            hint={`${w.label} workspace (${w.key})`}
          />
        ))}
      </div>

      <div className="space-y-1.5 pt-2 border-t border-hair/70">
        <RailButton onClick={onTour} icon={Lightbulb} label="Tour" tint="" hint="Interactive Guided Tour (?)" />
        <RailButton onClick={onShortcuts} icon={Keyboard} label="Keys" tint="" hint="Keyboard Shortcuts" />
      </div>
    </nav>
  );
}

/** Same workspaces as a bottom bar on narrow mobile viewports. */
export function MobileTabs({ active, onChange }) {
  return (
    <nav
      aria-label="Workspaces"
      className="flex border-t border-hair bg-white/95 px-2 py-1 backdrop-blur-md md:hidden shadow-float"
    >
      {WORKSPACES.map((w) => {
        const on = active === w.id;
        return (
          <button
            key={w.id}
            type="button"
            onClick={() => onChange(w.id)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[10.5px] font-bold transition-colors ${
              on ? w.tint.split(' ')[0] : 'text-mist hover:text-legal'
            }`}
          >
            <w.icon className="h-[18px] w-[18px]" />
            <span>{w.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
