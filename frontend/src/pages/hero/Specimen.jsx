import React, { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import Seal from '../../components/Seal';

// An invented resolution page, drawn in CSS. It plays one short scene: the clause the answer relies on gets highlighted and
// locked, then the seal for the order's status is stamped on. Everything here is labelled as a specimen.
function Bracket({ pos, delay }) {
  const top = pos.includes('t');
  const left = pos.includes('l');
  return (
    <motion.span
      aria-hidden
      className="absolute h-2.5 w-2.5"
      style={{
        [top ? 'top' : 'bottom']: -5,
        [left ? 'left' : 'right']: -6,
        [top ? 'borderTop' : 'borderBottom']: '2px solid #B45309',
        [left ? 'borderLeft' : 'borderRight']: '2px solid #B45309',
      }}
      initial={{ opacity: 0, x: left ? -8 : 8, y: top ? -8 : 8 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22, delay }}
    />
  );
}

export default function Specimen({ className = '' }) {
  const ref = useRef(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotX = useSpring(useTransform(my, [-0.5, 0.5], [3.5, -3.5]), { stiffness: 110, damping: 16 });
  const rotY = useSpring(useTransform(mx, [-0.5, 0.5], [-4.5, 4.5]), { stiffness: 110, damping: 16 });

  const onMove = (e) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const onLeave = () => {
    mx.set(0);
    my.set(0);
  };

  return (
    <div ref={ref} onPointerMove={onMove} onPointerLeave={onLeave} className={`relative ${className}`} style={{ perspective: 1400 }} role="img" aria-label="Specimen resolution: the clause an answer relies on is highlighted, and the order is stamped Superseded">
      {/* loose sheets underneath */}
      <div aria-hidden className="absolute inset-x-2 top-4 h-full -rotate-[4deg] rounded-[6px] bg-ivory" style={{ boxShadow: '0 0 0 1px rgba(30,41,59,.08), 0 20px 30px -20px rgba(30,41,59,.35)' }} />
      <div aria-hidden className="absolute inset-x-1 top-2 h-full rotate-[2deg] rounded-[6px] bg-ivory" style={{ boxShadow: '0 0 0 1px rgba(30,41,59,.08), 0 20px 30px -20px rgba(30,41,59,.35)' }} />

      <motion.div
        initial={{ opacity: 0, y: 40, rotate: 2 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.25 }}
        style={{ rotateX: rotX, rotateY: rotY, rotate: -1.2, transformStyle: 'preserve-3d' }}
        className="relative rounded-[6px] bg-[#FEFDFB] px-7 pb-24 pt-6"
      >
        <div aria-hidden className="absolute inset-0 rounded-[6px]" style={{ boxShadow: '0 0 0 1px rgba(30,41,59,.10), 0 2px 3px rgba(30,41,59,.06), 0 38px 60px -28px rgba(30,41,59,.45)' }} />

        <div className="relative flex items-start justify-between">
          <span className="mono-label rounded-[3px] border border-dashed border-[#9A9484] px-1.5 py-0.5 text-[8px] text-[#6B6657]">Specimen · invented for illustration</span>
          <span className="font-mono text-[9px] text-faint">p. 2 of 3</span>
        </div>

        <div className="relative mt-5 text-center">
          <p className="gu-text text-[11px] tracking-[.25em] text-[#6B6657]">ઠરાવ</p>
          <p className="mono-label mt-0.5 text-[8.5px] tracking-[.3em] text-[#6B6657]">Resolution</p>
          <p className="mt-2 font-mono text-[9.5px] text-ink">No. GR/EX/2018/045 · dated 20 May 2018</p>
          <div className="mx-auto mt-2 h-px w-24 bg-[#CFC9B8]" />
        </div>

        <p className="legal-text relative mt-4 text-center text-[13px] font-bold text-ink" style={{ lineHeight: 1.45 }}>Leave: documents required<br />with an application</p>

        <div className="legal-text relative mt-4 space-y-2.5 text-[10.5px] text-[#3A4356]" style={{ lineHeight: 1.7 }}>
          <p>
            <b className="text-ink">1.</b> The Government has considered the documents an employee must submit when applying for leave, and resolves as follows.
          </p>

          <div className="relative !mt-5">
            <p>
              <b className="text-ink">2.</b> In partial modification of GR No. GR/EX/2014/001 dated 12/03/2014,{' '}
              <motion.span
                className="rounded-[2px] px-0.5 text-ink"
                style={{ backgroundImage: 'linear-gradient(rgba(245,184,61,.55), rgba(245,184,61,.55))', backgroundRepeat: 'no-repeat', backgroundPosition: 'left center' }}
                initial={{ backgroundSize: '0% 100%' }}
                animate={{ backgroundSize: '100% 100%' }}
                transition={{ delay: 1.15, duration: 0.9, ease: [0.6, 0, 0.2, 1] }}
              >
                a medical certificate shall be submitted with the leave application.
              </motion.span>
            </p>
            {/* the lock */}
            <Bracket pos="tl" delay={1.9} />
            <Bracket pos="tr" delay={1.95} />
            <Bracket pos="bl" delay={2.0} />
            <Bracket pos="br" delay={2.05} />
            <motion.span
              className="mono-label absolute -right-1 -top-[17px] rounded-[2px] bg-[#B45309] px-1.5 py-0.5 text-[7.5px] text-white"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2.15 }}
            >
              Verbatim lock · p.2
            </motion.span>
          </div>

          <p>
            <b className="text-ink">3.</b> This Resolution comes into force from the date of issue.
          </p>
          <p className="gu-text text-[10px]" style={{ lineHeight: 1.8 }}>આ ઠરાવ તેની બહાર પાડ્યાની તારીખથી અમલમાં આવશે.</p>
        </div>

        {/* seal, stamped late */}
        <div className="absolute bottom-5 right-5">
          <Seal status="superseded" size={92} stamped delay={2.7} />
        </div>
        <motion.p
          className="mono-label absolute bottom-7 left-7 max-w-[11rem] text-[8px] leading-relaxed text-[#8E1F3A]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 3.1 }}
        >
          Replaced by GR/EX/2021/130<br />dated 2 Aug 2021
        </motion.p>
      </motion.div>

      {/* the answer that came with it */}
      <motion.div
        initial={{ opacity: 0, y: 26 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 160, damping: 20, delay: 3.0 }}
        className="sheet absolute -bottom-9 -left-6 z-10 w-[17.5rem] p-3.5 sm:-left-12"
      >
        <p className="eyebrow !text-iris-700">Answer</p>
        <p className="display mt-1 text-[13.5px] leading-snug text-ink">A medical certificate must be submitted with the leave application.</p>
        <div className="mt-2 flex items-center gap-2">
          <span className="rounded-full border border-[#F0C4CF] bg-[#FDF0F3] px-2 py-0.5 text-[9.5px] font-bold text-[#8E1F3A]">Found + Superseded</span>
          <span className="font-mono text-[9px] text-faint">do not act on this order</span>
        </div>
      </motion.div>
    </div>
  );
}
