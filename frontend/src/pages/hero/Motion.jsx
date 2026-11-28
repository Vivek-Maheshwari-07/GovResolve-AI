import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';
import { ArrowRight, Search } from 'lucide-react';
import CountUp from '../../components/CountUp';
import { SAMPLES } from '../../lib/samples';
import { useUiLanguage } from '../../lib/i18n';

/* Motion pieces for the landing page. Everything honours prefers-reduced-motion and keeps the page's palette. */

/** Headline whose words rise out of a soft blur one after another. */
export function SplitWords({ text, className = '', delay = 0.1, as = 'h1' }) {
  const reduce = useReducedMotion();
  const Tag = motion[as];
  const words = String(text).split(' ');
  if (reduce) return <Tag className={className}>{text}</Tag>;
  return (
    <Tag className={className} aria-label={text}>
      {words.map((w, i) => (
        <motion.span
          key={`${w}-${i}`}
          aria-hidden
          className="inline-block"
          initial={{ opacity: 0, y: 22, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ type: 'spring', stiffness: 130, damping: 22, delay: delay + i * 0.06 }}
        >
          {w}{i < words.length - 1 ? ' ' : ''}
        </motion.span>
      ))}
    </Tag>
  );
}

/** Slowly drifting indigo light over a faint dot grid, behind the masthead. Pure CSS, no scripting cost. */
export function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[min(900px,100%)] overflow-hidden">
      <div className="hero-grid absolute inset-0" />
      <div className="hero-glow hero-glow-a" />
      <div className="hero-glow hero-glow-b" />
    </div>
  );
}

const graphemes = (s) => (typeof Intl !== 'undefined' && Intl.Segmenter
  ? Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s), (x) => x.segment)
  : Array.from(s));

const DEMO = SAMPLES.filter((s) => ['en', 'gu', 'mixed'].includes(s.kind));

/** A search bar that types real sample questions (English, Gujarati, Gujlish) one after another. Clicking it opens the app. */
export function LiveAsk({ onOpen }) {
  const { t } = useUiLanguage();
  const reduce = useReducedMotion();
  const box = useRef(null);
  const visible = useInView(box, { margin: '0px' });
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(reduce ? DEMO[0].text : '');
  const [done, setDone] = useState(Boolean(reduce));

  useEffect(() => {
    if (reduce || !visible) return undefined;
    const parts = graphemes(DEMO[index].text);
    let n = 0;
    let timer;
    setDone(false);
    setShown('');
    const type = () => {
      n += 1;
      setShown(parts.slice(0, n).join(''));
      if (n < parts.length) {
        timer = setTimeout(type, 26 + Math.random() * 38);
      } else {
        setDone(true);
        timer = setTimeout(() => setIndex((i) => (i + 1) % DEMO.length), 3200);
      }
    };
    timer = setTimeout(type, 500);
    return () => clearTimeout(timer);
  }, [index, visible, reduce]);

  const current = DEMO[index];
  return (
    <motion.button
      ref={box}
      type="button"
      onClick={onOpen}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45 }}
      aria-label={t('heroLiveCta')}
      className="glass-dock group mt-8 flex w-full max-w-[34rem] items-start gap-3 rounded-2xl p-3.5 text-left transition hover:border-iris-300 hover:[box-shadow:0_10px_32px_-6px_rgba(79,70,229,0.22)]"
    >
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-iris-50 text-iris-600"><Search className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="mono-label flex items-center justify-between gap-2 text-[9.5px]">
          <span>{t('heroTryAsking')}</span>
          <span className="rounded-full border border-hair bg-canvas px-2 py-0.5 text-[9px] normal-case tracking-normal text-mist">{current.badge}</span>
        </span>
        <span className="gu-text mt-1 block min-h-[3.1rem] text-[14.5px] leading-snug text-ink">
          {shown}
          {!reduce && <span aria-hidden className={`ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[3px] bg-iris-600 ${done ? 'animate-pulse' : ''}`} />}
        </span>
      </span>
      <span className="mt-1 hidden shrink-0 items-center gap-1 text-[12px] font-semibold text-iris-700 sm:inline-flex">
        {t('heroLiveCta')} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </motion.button>
  );
}

/** Three live numbers from the running collection, counting up when they scroll into view. Hidden when the server is not reachable. */
export function StatsStrip({ stats }) {
  const { t } = useUiLanguage();
  if (!stats || !stats.total_grs) return null;
  const items = [
    [stats.total_grs, 'heroStatDocs'],
    [stats.chunks, 'heroStatPassages'],
    [stats.edges, 'heroStatLinks'],
  ].filter(([n]) => Number.isFinite(Number(n)) && Number(n) > 0);
  return (
    <motion.dl
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.7 }}
      className="mt-9 grid max-w-[34rem] grid-cols-3 gap-4 border-t border-hair pt-5"
    >
      {items.map(([n, key]) => (
        <div key={key}>
          <dt className="display text-[26px] font-bold leading-none tabular-nums text-ink sm:text-[30px]"><CountUp value={n} duration={1400} /></dt>
          <dd className="mt-1.5 text-[11.5px] leading-snug text-mist">{t(key)}</dd>
        </div>
      ))}
    </motion.dl>
  );
}

/** Wrapper that leans a little towards the pointer (buttons). Off for reduced motion and touch. */
export function Magnetic({ children, strength = 0.22, className = '' }) {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const x = useSpring(useMotionValue(0), { stiffness: 220, damping: 16, mass: 0.4 });
  const y = useSpring(useMotionValue(0), { stiffness: 220, damping: 16, mass: 0.4 });
  if (reduce) return <span className={className}>{children}</span>;
  const move = (e) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength);
  };
  const leave = () => { x.set(0); y.set(0); };
  return (
    <motion.span ref={ref} onPointerMove={move} onPointerLeave={leave} style={{ x, y }} className={`inline-block ${className}`}>
      {children}
    </motion.span>
  );
}

/** `onPointerMove` handler for cards with the `spotlight` class: a soft light follows the pointer (see index.css). */
export function spotlightMove(e) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
}
