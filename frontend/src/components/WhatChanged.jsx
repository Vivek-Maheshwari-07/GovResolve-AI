import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { whatChanged } from '../lib/whatChanged';

/** The cited passage next to the newer order's verbatim amending sentence. Renders nothing without an explicit link. */
export default function WhatChanged({ citation, chain, onOpenNewer }) {
  const w = whatChanged(citation, chain);
  if (!w) return null;
  const superseded = w.newer.relation !== 'amends';
  const tone = superseded
    ? { ring: 'border-[#FECDD3]', head: 'text-[#9F1239]', wash: 'bg-[#FFF1F2]' }
    : { ring: 'border-[#FDE68A]', head: 'text-[#92400E]', wash: 'bg-[#FFFBEB]' };

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={`sheet overflow-hidden border ${tone.ring}`}
      aria-label="What changed"
      data-testid="what-changed"
    >
      <div className={`flex flex-wrap items-baseline justify-between gap-2 border-b ${tone.ring} ${tone.wash} px-5 py-3`}>
        <h2 className={`display text-[17px] font-bold ${tone.head}`}>What changed</h2>
        <p className="text-[13px] text-[#64748B]">
          {w.label} <b className="font-mono text-[#1E293B]">{w.newer.gr_number}</b>{w.newer.date ? ` on ${w.newer.date}` : ''}
          {w.others > 0 ? ` · ${w.others} more ${w.others === 1 ? 'order acts' : 'orders act'} on it` : ''}
        </p>
      </div>
      <div className="grid gap-0 md:grid-cols-2">
        <div className="border-b border-[#E6E4DD] p-5 md:border-b-0 md:border-r">
          <p className="text-[12.5px] font-semibold text-[#64748B]">
            The passage you were given · <span className="font-mono text-[#1E293B]">{w.older.gr_number}</span>{w.older.page != null ? `, p.${w.older.page}` : ''}
          </p>
          {w.older.quote ? (
            <p className="legal-text mt-2 text-[15px] text-[#64748B] line-through decoration-[#9F1239]/60 decoration-1">“{w.older.quote}”</p>
          ) : (
            <p className="mt-2 text-[14px] text-[#64748B]">No quoted passage for this citation.</p>
          )}
        </div>
        <div className="p-5">
          <p className="text-[12.5px] font-semibold text-[#64748B]">
            What the newer order says · <span className="font-mono text-[#1E293B]">{w.newer.gr_number}</span>{w.newer.page != null ? `, p.${w.newer.page}` : ''}
          </p>
          {w.newer.quote ? (
            <p className="legal-text mt-2 text-[15px] text-[#1E293B]">“{w.newer.quote}”</p>
          ) : (
            <p className="mt-2 text-[14px] text-[#64748B]">The link is recorded, but no sentence was stored for it.</p>
          )}
          {onOpenNewer && (
            <button type="button" onClick={() => onOpenNewer(w.newer)} className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#4F46E5] hover:text-[#4338CA]">
              <ArrowLeft className="h-3.5 w-3.5 rotate-180" /> Open {w.newer.gr_number} on its page
            </button>
          )}
        </div>
      </div>
    </motion.section>
  );
}
