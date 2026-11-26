import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import Seal from '../../components/Seal';

// "The page that changes under your eyes": one short scene, played once, then still.
//   0.0s the 2018 order appears like ink on paper
//   1.4s a newer 2021 order slides over it, like a sheet laid on a desk
//   1.9s an arrow draws from the newer order to the older one (links always run newer -> older)
//   2.3s a hairline strike crosses the old clause; the amending sentence sits on the newer sheet, with its page
//   2.8s the Amended seal stamps once
// Every number and order here is invented and labelled as a specimen. Reduced motion shows the final frame.
const EASE = [0.16, 1, 0.3, 1];

export default function Specimen({ className = '' }) {
  const reduce = useReducedMotion();
  const at = (s) => (reduce ? 0 : s);
  const dur = (s) => (reduce ? 0 : s);

  return (
    <div className={`relative ${className}`} role="img" aria-label="Specimen: a 2018 resolution, then a 2021 order that amends its clause; the old words are struck through and the order is stamped Amended">
      {/* the older order */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: dur(0.7), ease: EASE, delay: at(0.15) }}
        className="relative -rotate-[1.2deg] rounded-[6px] bg-[#FEFDFB] px-7 pb-24 pt-6"
        style={{ boxShadow: '0 0 0 1px rgba(30,41,59,.10), 0 2px 3px rgba(30,41,59,.06), 0 38px 60px -28px rgba(30,41,59,.45)' }}
      >
        <div className="flex items-start justify-between">
          <span className="mono-label rounded-[3px] border border-dashed border-[#9A9484] px-1.5 py-0.5 text-[12.5px] text-[#6B6657]">Specimen · invented</span>
          <span className="font-mono text-[12.5px] text-faint">p. 2 of 3</span>
        </div>

        <div className="mt-5 text-center">
          <p className="gu-text text-[12.5px] tracking-[.25em] text-[#6B6657]">ઠરાવ</p>
          <p className="mt-1 font-mono text-[12.5px] text-ink">No. GR/EX/2018/045 · 20 May 2018</p>
          <div className="mx-auto mt-2 h-px w-24 bg-[#CFC9B8]" />
        </div>

        <p className="legal-text mt-4 text-center text-[13.5px] font-bold text-ink" style={{ lineHeight: 1.45 }}>Leave: documents required<br />with an application</p>

        <div className="legal-text mt-4 space-y-2.5 text-[13px] text-[#3A4356]" style={{ lineHeight: 1.7 }}>
          <p><b className="text-ink">1.</b> The Government has considered the documents an employee must submit when applying for leave.</p>
          <p id="specimen-clause">
            <b className="text-ink">2.</b>{' '}
            A medical certificate from{' '}
            {/* the hairline strike: the words the later order replaces (a line-through, so it follows wrapped lines) */}
            <motion.span
              style={{ textDecorationLine: 'line-through', textDecorationThickness: '1px' }}
              initial={{ textDecorationColor: 'rgba(159,18,57,0)' }}
              animate={{ textDecorationColor: 'rgba(159,18,57,1)' }}
              transition={{ duration: dur(0.45), ease: EASE, delay: at(2.3) }}
            >
              any registered practitioner
            </motion.span>{' '}
            shall be submitted with the leave application.
          </p>
          <p><b className="text-ink">3.</b> This Resolution comes into force from the date of issue.</p>
        </div>

        <div className="absolute bottom-5 left-6">
          <Seal status="amended" size={86} stamped delay={at(2.8)} />
        </div>
      </motion.div>

      {/* the newer order, laid over the older one */}
      <motion.div
        initial={{ opacity: 0, x: 48, y: -6, rotate: 5 }}
        animate={{ opacity: 1, x: 0, y: 0, rotate: 2.2 }}
        transition={{ duration: dur(0.6), ease: EASE, delay: at(1.4) }}
        className="absolute -right-4 top-[38%] z-10 w-[15.5rem] rounded-[6px] bg-white px-4 py-3.5 sm:-right-10"
        style={{ boxShadow: '0 0 0 1px rgba(30,41,59,.12), 0 24px 40px -20px rgba(30,41,59,.45)' }}
      >
        {/* newer -> older: drawn from this sheet's edge back to the clause it changes */}
        <svg aria-hidden viewBox="0 0 64 48" className="pointer-events-none absolute -left-[60px] top-9 h-12 w-16 overflow-visible">
          <motion.path d="M 62 6 C 40 8, 22 22, 6 40" fill="none" stroke="#4F46E5" strokeWidth="1.8" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: dur(0.45), ease: EASE, delay: at(1.9) }} />
          <motion.path d="M 4 30 L 6 41 L 16 37" fill="none" stroke="#4F46E5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: dur(0.15), delay: at(2.3) }} />
        </svg>
        <div className="flex items-center justify-between">
          <p className="font-mono text-[12.5px] font-bold text-ink">GR/EX/2021/130</p>
          <p className="font-mono text-[12.5px] text-faint">2 Aug 2021</p>
        </div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: dur(0.4), delay: at(2.4) }}
          className="legal-text mt-2 text-[13px] leading-snug text-ink"
        >
          “In para 2 of GR/EX/2018/045, for <span className="text-[#9F1239] line-through decoration-1">any registered practitioner</span> read{' '}
          <span className="rounded-[2px] bg-[#F5B83D]/50 px-0.5">a Government Medical Officer</span>.”
        </motion.p>
        <motion.span
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: dur(0.25), delay: at(2.6) }}
          className="mt-2 inline-block rounded-[3px] bg-[#B45309] px-1.5 py-0.5 font-mono text-[12.5px] font-bold text-white"
        >
          verbatim · p.2
        </motion.span>
      </motion.div>

      {/* what the answer says about it */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: dur(0.5), ease: EASE, delay: at(3.0) }}
        className="sheet absolute -bottom-9 right-0 z-10 w-[17.5rem] p-3.5"
      >
        <p className="display text-[14px] leading-snug text-ink">A certificate from a Government Medical Officer is now required.</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[#FDE68A] bg-[#FFFBEB] px-2 py-0.5 text-[12.5px] font-bold text-[#92400E]">Found + Amended</span>
          <span className="font-mono text-[12.5px] text-faint">read with GR/EX/2021/130</span>
        </div>
      </motion.div>
    </div>
  );
}
