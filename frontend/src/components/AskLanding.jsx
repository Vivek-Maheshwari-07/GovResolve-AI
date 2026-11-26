import React from 'react';
import { motion } from 'framer-motion';
import { Languages, Quote, GitBranch, ShieldQuestion, ArrowUpRight } from 'lucide-react';
import Seal from './Seal';
import { SAMPLES, KIND_STYLE } from '../lib/samples';
import { STATUS, TONES } from '../lib/status';
import { useUiLanguage } from '../lib/i18n';

const FEATURES = [
  { icon: Languages, titleKey: 'featureLanguages', textKey: 'featureLanguagesText' },
  { icon: Quote, titleKey: 'featureProof', textKey: 'featureProofText' },
  { icon: GitBranch, titleKey: 'featureLineage', textKey: 'featureLineageText' },
  { icon: ShieldQuestion, titleKey: 'featureRefusal', textKey: 'featureRefusalText' },
];

const rise = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 240, damping: 26 } },
};

/** Masthead: left-aligned editorial headline above the question box. */
export function HeroHeader() {
  const { t } = useUiLanguage();
  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.08 } } }}>
      <motion.div variants={rise} className="flex items-center gap-3">
        <span className="h-px w-8 bg-[#4F46E5]" />
        <span className="mono-label text-[#4F46E5]">{t('governmentResolutionIntelligence')}</span>
      </motion.div>

      <motion.h1 variants={rise} className="display mt-5 text-[36px] font-bold leading-[1.13] text-[#1E293B] [text-wrap:balance] sm:text-[50px]">
        {t('askLandingHeadline')}
      </motion.h1>

      <motion.p variants={rise} className="mt-5 max-w-[34rem] text-[16px] leading-relaxed text-[#64748B]">
        {t('askLandingDescription')}
      </motion.p>
      <motion.p variants={rise} className="gu-text mt-1 max-w-[34rem] text-[14px] font-medium text-[#4F46E5]">
        કોઈપણ ઠરાવ વિશે પૂછો: અધિકૃત જવાબ, પાનું, મૂળ લખાણ અને પછીના સુધારા સાથે.
      </motion.p>
    </motion.div>
  );
}

/** Case files, capabilities and the five seals, shown below the masthead. */
export default function Hero({ onAsk, disabled }) {
  const { t } = useUiLanguage();
  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.07, delayChildren: 0.3 } } }} className="space-y-14 pb-10 pt-14">
      <motion.section variants={rise} aria-label={t('tryExample')}>
        <div className="mb-3 flex items-end justify-between px-0.5">
          <div>
            <h2 className="eyebrow">{t('caseFiles')}</h2>
            <p className="display mt-1 text-[20px] font-bold text-[#1E293B]">{t('openExampleToAnswer')}</p>
          </div>
          <span className="mono-label hidden text-[#64748B] sm:block">{t('oneClickRealCorpus')}</span>
        </div>
        <ol className="sheet ledger overflow-hidden">
          {SAMPLES.map((s, i) => (
            <li key={s.label}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onAsk(s.text)}
                className="group relative grid w-full grid-cols-[2.4rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[#EEF2FF]/60 disabled:opacity-50"
              >
                <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] origin-top scale-y-0 bg-[#4F46E5] transition-transform duration-300 group-hover:scale-y-100" />
                <span className="font-mono text-[12.5px] font-semibold text-[#64748B]">{String(i + 1).padStart(2, '0')}</span>
                <span className="min-w-0">
                  <span className={`block truncate text-[14.5px] font-semibold text-[#1E293B] ${s.kind === 'gu' ? 'gu-text' : ''}`}>{s.label}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[#64748B]">
                    <span className={`h-1.5 w-1.5 rounded-full ${KIND_STYLE[s.kind].dot}`} />
                    <span className={s.kind === 'gu' ? 'gu-text' : ''}>{s.badge}</span>
                  </span>
                </span>
                <ArrowUpRight className="h-4 w-4 text-[#E6E4DD] transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#4F46E5]" />
              </button>
            </li>
          ))}
        </ol>
      </motion.section>

      <motion.section variants={rise} aria-label={t('howItWorks')} className="grid grid-cols-1 overflow-hidden rounded-2xl border border-[#E6E4DD] sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f, i) => (
          <div key={f.titleKey} className={`bg-[rgba(255,255,255,0.88)] backdrop-blur-md p-5 ${i > 0 ? 'border-t border-[#E6E4DD] sm:border-t-0 sm:border-l' : ''} ${i === 2 ? 'sm:border-t sm:border-l-0 lg:border-t-0 lg:border-l' : ''}`}>
            <f.icon className="h-[18px] w-[18px] text-[#4F46E5]" strokeWidth={2} />
            <h3 className="mt-3 text-[14px] font-bold text-[#1E293B]">{t(f.titleKey)}</h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[#64748B]">{t(f.textKey)}</p>
          </div>
        ))}
      </motion.section>

      <motion.section variants={rise} aria-label={t('statusMeanings')}>
        <h2 className="eyebrow">{t('statusMeanings')}</h2>
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
          {Object.values(STATUS).map((s) => {
            const tone = TONES[s.tone];
            const statusKey = s.key === 'no_change' ? 'noChange' : s.key;
            return (
              <div key={s.key} title={t(`${statusKey}Note`)} className="flex flex-col items-start gap-2.5">
                <Seal status={s.key} size={62} />
                <div>
                  <p className={`text-[12.5px] font-bold leading-tight ${tone.text}`}>{t(statusKey)}</p>
                  {s.reserved && <p className="mono-label mt-1 text-[12.5px] text-[#64748B]">{t('reservedNotEmitted')}</p>}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-5 max-w-2xl text-[12.5px] leading-relaxed text-[#64748B]">
          {t('noChangeExplainer')}
        </p>
      </motion.section>
    </motion.div>
  );
}
