import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, X, Loader2, RotateCcw } from 'lucide-react';
import { ask } from '../api';
import { STAGE_PINS, loadCache, saveCache, pinState, answeredAt, preflight } from '../lib/stage';

const storage = () => {
  try { return window.sessionStorage; } catch { return null; }
};

/**
 * Presenter strip for ?stage=1. Checks the server, then answers the pinned questions once (in order) and keeps
 * the real responses in this browser session. Keys 1 2 3 (handled by the app) open them instantly.
 */
export default function StageBar({ onOpen, onCache }) {
  const [health, setHealth] = useState(undefined);
  const [cache, setCache] = useState(() => loadCache(storage()));
  const [busy, setBusy] = useState(null);
  const running = useRef(false);

  useEffect(() => {
    fetch('/health').then((r) => r.json()).then(setHealth).catch(() => setHealth(null));
  }, []);

  useEffect(() => { onCache?.(cache); }, [cache, onCache]);

  const warm = useCallback(async (force = false) => {
    if (running.current) return;
    running.current = true;
    let next = force ? {} : { ...loadCache(storage()) };
    for (const pin of STAGE_PINS) {
      if (!force && next[pin.id]?.response) continue;
      setBusy(pin.id);
      try {
        const response = await ask(pin.question, null);
        next = { ...next, [pin.id]: { at: Date.now(), response } };
      } catch (e) {
        next = { ...next, [pin.id]: { at: Date.now(), error: e.message || 'request failed' } };
      }
      saveCache(storage(), next);
      setCache(next);
    }
    setBusy(null);
    running.current = false;
  }, []);

  useEffect(() => {
    if (health && health.status === 'ok') warm(false);
  }, [health, warm]);

  const checks = health === undefined ? [] : preflight(health);

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-[#E6E4DD] bg-[#FFFBEB] px-4 py-2 text-[13px] text-[#1E293B] print:hidden" role="region" aria-label="Stage mode">
      <span className="font-bold text-[#92400E]">Stage mode</span>
      <span className="flex flex-wrap items-center gap-3" aria-label="Preflight">
        {health === undefined && <span className="text-[#64748B]">checking the server…</span>}
        {checks.map((c) => (
          <span key={c.label} className="inline-flex items-center gap-1">
            {c.ok ? <Check className="h-3.5 w-3.5 text-[#065F46]" /> : <X className="h-3.5 w-3.5 text-[#9F1239]" />}
            {c.label} <b className="font-mono">{c.detail}</b>
          </span>
        ))}
      </span>
      <span className="flex flex-wrap items-center gap-2" aria-label="Pinned questions">
        {STAGE_PINS.map((pin, i) => {
          const entry = cache[pin.id];
          const state = busy === pin.id ? 'busy' : pinState(entry);
          return (
            <button
              key={pin.id}
              type="button"
              disabled={state !== 'ready'}
              onClick={() => onOpen(entry.response, pin)}
              title={pin.question}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-semibold transition ${state === 'ready' ? 'border-[#C7D2FE] bg-white text-[#4338CA] hover:bg-[#EEF2FF]' : state === 'error' ? 'border-[#FECDD3] bg-[#FFF1F2] text-[#9F1239]' : 'border-[#E6E4DD] bg-white text-[#64748B]'}`}
            >
              <kbd className="kbd">{i + 1}</kbd>
              <span className={pin.gu ? 'gu-text' : ''}>{pin.label}</span>
              {state === 'busy' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {state === 'ready' && <span className="font-mono text-[12.5px] font-normal text-[#64748B]">{answeredAt(entry.at)}</span>}
              {state === 'error' && <span className="font-normal">failed</span>}
            </button>
          );
        })}
      </span>
      <button type="button" onClick={() => warm(true)} disabled={!!busy} className="ml-auto inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#92400E] hover:text-[#1E293B] disabled:opacity-50" title="Ask the pinned questions again now">
        <RotateCcw className="h-3.5 w-3.5" /> Refresh answers
      </button>
    </div>
  );
}
