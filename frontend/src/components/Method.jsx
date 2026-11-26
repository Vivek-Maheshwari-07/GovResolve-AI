import React from 'react';
import { motion } from 'framer-motion';
import { Languages, DatabaseZap, Filter, PenLine, ShieldCheck } from 'lucide-react';
import CountUp from './CountUp';
import { useT } from '../lib/LanguageContext';

const STEPS = [
  { icon: Languages, tk: 'method.s1_t', dk: 'method.s1_b' },
  { icon: DatabaseZap, tk: 'method.s2_t', dk: 'method.s2_b' },
  { icon: Filter, tk: 'method.s3_t', dk: 'method.s3_b' },
  { icon: PenLine, tk: 'method.s4_t', dk: 'method.s4_b' },
  { icon: ShieldCheck, tk: 'method.s5_t', dk: 'method.s5_b' },
];

const ROWS = [
  { mk: 'method.r1', dev: '82.9%', held: '72.7%' },
  { mk: 'method.r2', dev: '94.3%', held: '72.7%' },
  { mk: 'method.r3', dev: '24 / 35', held: '6 / 11', strong: true },
  { mk: 'method.r4', dev: '83.0%', held: '71.4%' },
  { mk: 'method.r5', dev: '100%', held: '100%', strong: true },
  { mk: 'method.r6', dev: '15 / 15', held: '5 / 5', strong: true },
  { mk: 'method.r7', dev: '45 / 66', held: '48 / 76' },
];

const ARTICLES = [
  ['method.a1_t', 'method.a1_b'],
  ['method.a2_t', 'method.a2_b'],
  ['method.a3_t', 'method.a3_b'],
  ['method.a4_t', 'method.a4_b'],
  ['method.a5_t', 'method.a5_b'],
];

const roman = ['I', 'II', 'III', 'IV', 'V'];
const rise = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 26 } } };

export default function Method({ stats }) {
  const t = useT();
  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.07 } } }} className="mx-auto max-w-5xl space-y-12 pb-12 pt-2">
      <motion.header variants={rise} className="max-w-3xl">
        <p className="mono-label flex items-center gap-2 text-iris-700"><span className="h-px w-6 bg-iris-600" />{t('method.eyebrow')}</p>
        <h2 className="display mt-3 text-[34px] font-bold leading-[1.15] text-ink sm:text-[40px]">{t('method.title')}</h2>
        <p className="mt-3 text-[14.5px] leading-relaxed text-mist">
          {t('method.subtitle')}
        </p>
      </motion.header>

      {/* pipeline */}
      <motion.section variants={rise} aria-label="Pipeline">
        <ol className="relative grid grid-cols-1 gap-y-6 md:grid-cols-5 md:gap-x-5">
          <span aria-hidden className="absolute left-[19px] top-5 hidden h-px w-[calc(100%-38px)] bg-rule md:block" />
          {STEPS.map((s, i) => (
            <li key={s.tk} className="relative">
              <span className="relative z-10 grid h-10 w-10 place-items-center rounded-full bg-ink text-white" style={{ boxShadow: '0 0 0 4px #F8F7F4, 0 6px 14px -6px rgba(15,23,42,.6)' }}>
                <s.icon className="h-[17px] w-[17px]" strokeWidth={1.9} />
              </span>
              <p className="mono-label mt-4 text-[9px] text-faint">{t('method.stage', { n: i + 1 })}</p>
              <h3 className="display mt-0.5 text-[16px] font-bold text-ink">{t(s.tk)}</h3>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-mist">{t(s.dk)}</p>
            </li>
          ))}
        </ol>
      </motion.section>

      {/* scorecard */}
      <motion.section variants={rise} aria-label="Scorecard" className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div>
          <div className="mb-3">
            <h3 className="display text-[20px] font-bold text-ink">{t('method.scorecard')}</h3>
            <p className="mt-1 text-[12.5px] text-mist">
              {t('method.scorecard_sub')}
            </p>
          </div>
          <div className="sheet overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="mono-label border-b border-hair bg-sand/60 text-[9px] text-faint">
                  <th className="px-4 py-2 font-medium">{t('method.col_metric')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('method.col_dev')}</th>
                  <th className="px-4 py-2 text-right font-medium">{t('method.col_held')}</th>
                </tr>
              </thead>
              <tbody className="ledger">
                {ROWS.map((r) => (
                  <tr key={r.mk} className="border-t border-hair first:border-0">
                    <td className="px-4 py-2.5 text-[13px] text-legal">{t(r.mk)}</td>
                    <td className={`px-3 py-2.5 text-right font-mono text-[13px] tabular-nums ${r.strong ? 'font-bold text-ink' : 'text-mist'}`}>{r.dev}</td>
                    <td className={`px-4 py-2.5 text-right font-mono text-[13px] tabular-nums ${r.strong ? 'font-bold text-ink' : 'text-mist'}`}>{r.held}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2.5 text-[11.5px] leading-relaxed text-faint">
            {t('method.scorecard_foot')}
          </p>
        </div>

        <div className="sheet h-fit p-5">
          <h3 className="eyebrow">{t('method.indexed_kb')}</h3>
          <dl className="mt-3 space-y-3.5">
            {[[t('method.grs'), stats?.total_grs], [t('method.passages'), stats?.chunks], [t('method.links'), stats?.edges]].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between border-b border-hair pb-3 last:border-0 last:pb-0">
                <dt className="text-[12.5px] text-mist">{k}</dt>
                <dd className="font-mono text-[24px] font-bold tabular-nums text-iris-700"><CountUp value={v} /></dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-[11.5px] leading-relaxed text-faint">{t('method.kb_foot')}</p>
        </div>
      </motion.section>

      {/* invariants */}
      <motion.section variants={rise} aria-label="Invariants">
        <h3 className="display text-[20px] font-bold text-ink">{t('method.invariants')}</h3>
        <ol className="sheet ledger mt-3 overflow-hidden">
          {ARTICLES.map(([tk, bk], i) => (
            <li key={tk} className="grid grid-cols-[3.2rem_minmax(0,1fr)] items-baseline gap-2 px-5 py-4">
              <span className="display text-[17px] font-bold italic text-iris-600">{roman[i]}.</span>
              <div>
                <p className="text-[14px] font-bold text-ink">{t(tk)}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-mist">{t(bk)}</p>
              </div>
            </li>
          ))}
        </ol>
      </motion.section>
    </motion.div>
  );
}
