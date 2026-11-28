import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Languages, Quote, GitBranch, ShieldQuestion, ArrowUpRight } from 'lucide-react';
import Seal from './Seal';
import { SAMPLES, KIND_STYLE } from '../lib/samples';
import { STATUS, TONES } from '../lib/status';
import { useUiLanguage } from '../lib/i18n';
import { fetchCoverage } from '../api';

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

/** Illustrative dossier (invented GR numbers, labelled as such): shows what an answer looks like before the first question. */
export function Specimen({ className = '' }) {
  const { t } = useUiLanguage();
  const nodes = [
    { x: 48, label: 'GR/EX/2014', tone: '#F59E0B' },
    { x: 160, label: 'GR/EX/2018', tone: '#F59E0B' },
    { x: 272, label: 'GR/EX/2022', tone: '#10B981' },
  ];
  const arc = (a, b) => `M${b.x} 94 C${b.x} 40, ${a.x} 40, ${a.x} 90`;
  return (
    <div className={`relative ${className}`} aria-label={t('illustrativeExample')}>
      {/* paper stack */}
      <div aria-hidden className="sheet absolute inset-x-3 top-5 h-full -rotate-[5deg] opacity-80" />
      <div aria-hidden className="sheet absolute inset-x-1.5 top-2.5 h-full rotate-[2.5deg] opacity-95" />

      <motion.div initial={{ opacity: 0, y: 24, rotate: 1 }} animate={{ opacity: 1, y: 0, rotate: -0.6 }} transition={{ type: 'spring', stiffness: 150, damping: 20, delay: 0.35 }} className="sheet relative overflow-hidden p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="mono-label rounded border border-[#E6E4DD] bg-[#F1EFEA] px-1.5 py-0.5 text-[#64748B]">{t('illustrativeExample')}</span>
            <p className="display mt-3 text-[15px] font-bold leading-snug text-[#1E293B]">Recruitment rules: age relaxation</p>
            <p className="mt-1 font-mono text-[10.5px] text-[#64748B]">DOSSIER № EX-0007 · 3 ORDERS IN CHAIN</p>
          </div>
          <Seal status="amended" size={78} stamped delay={1.0} />
        </div>

        <svg viewBox="0 0 320 120" className="mt-3 w-full" role="img" aria-label={t('threeOrdersAmend')}>
          {[0, 1].map((i) => (
            <g key={i}>
              <motion.path d={arc(nodes[i + 1], nodes[i])} fill="none" stroke={nodes[i + 1].tone} strokeWidth="1.7" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1.1 + i * 0.25, duration: 0.8, ease: 'easeOut' }} />
              <polygon points={`${nodes[i].x - 4},86 ${nodes[i].x + 4},86 ${nodes[i].x},94`} fill={nodes[i + 1].tone} />
            </g>
          ))}
          <line x1="20" x2="300" y1="98" y2="98" stroke="#E6E4DD" strokeDasharray="2 4" />
          {nodes.map((n) => (
            <g key={n.label}>
              <circle cx={n.x} cy="98" r="5" fill="#FAF9F5" stroke={n.tone} strokeWidth="2.2" />
              <text x={n.x} y="114" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8.5" fontWeight="600" fill="#1E293B">{n.label}</text>
            </g>
          ))}
          <text x="104" y="52" textAnchor="middle" fontFamily="Plus Jakarta Sans, sans-serif" fontSize="8.5" fontWeight="700" fill="#92400E">AMENDS</text>
          <text x="216" y="52" textAnchor="middle" fontFamily="Plus Jakarta Sans, sans-serif" fontSize="8.5" fontWeight="700" fill="#92400E">AMENDS</text>
        </svg>

        <blockquote className="legal-text mt-3 border-l-[3px] border-[#D97706] bg-[#FFFBEB] py-2 pl-3 pr-2 text-[12.5px] text-[#1E293B]">
          “…the upper age limit shall stand relaxed by one year…”
          <footer className="mono-label mt-1 text-[9.5px] text-[#92400E]">p.2 · verbatim · illustrative text</footer>
        </blockquote>
      </motion.div>
    </div>
  );
}

const EXAMPLE_PREF = { gu: ['gu', 'mixed', 'en'], gujlish: ['mixed', 'en', 'gu'], en: ['en', 'mixed', 'gu'] };

/** What the collection covers: topics with how many resolutions hold them, each with a question known to give a cited answer. */
function Coverage({ onAsk, disabled }) {
  const { t, language } = useUiLanguage();
  const [cov, setCov] = useState(null);
  useEffect(() => {
    let alive = true;
    fetchCoverage().then((c) => { if (alive) setCov(c); });
    return () => { alive = false; };
  }, []);
  if (!cov || !cov.topics?.length) return null;
  const pref = EXAMPLE_PREF[language] || EXAMPLE_PREF.en;
  const pick = (topic) => [...topic.examples].sort((a, b) => pref.indexOf(a.language) - pref.indexOf(b.language))[0];
  return (
    <section aria-label={t('coverageTitle')}>
      <div className="mb-3 px-0.5">
        <h2 className="eyebrow">{t('coverageTitle')}</h2>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-[#64748B]">{t('coverageNote', { count: cov.total_grs })}</p>
        {cov.first_date && cov.last_date && (
          <p className="mono-label mt-1 text-[10px] text-[#64748B]">{t('coverageRange', { from: cov.first_date.slice(0, 4), to: cov.last_date.slice(0, 4) })}</p>
        )}
      </div>
      <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {cov.topics.map((topic) => {
          const ex = pick(topic);
          return (
            <li key={topic.id}>
              <button
                type="button"
                disabled={disabled || !ex}
                onClick={() => ex && onAsk(ex.text)}
                className="group h-full w-full rounded-xl border border-[#E6E4DD] bg-[rgba(255,255,255,0.92)] px-4 py-3 text-left transition-colors hover:border-[#4F46E5] hover:bg-[#EEF2FF]/60 disabled:opacity-50"
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className={`${language === 'gu' ? 'gu-text' : ''} text-[14px] font-bold text-[#1E293B]`}>{language === 'gu' ? topic.label_gu : topic.label_en}</span>
                  <span className="mono-label shrink-0 text-[10px] text-[#64748B]">{t('coverageDocs', { count: topic.count })}</span>
                </span>
                {ex && <span className={`${/[઀-૿]/.test(ex.text) ? 'gu-text' : ''} mt-1.5 block line-clamp-2 text-[12.5px] leading-snug text-[#64748B] group-hover:text-[#1E293B]`}>{ex.text}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
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
                <span className="font-mono text-[11px] font-semibold text-[#64748B]">{String(i + 1).padStart(2, '0')}</span>
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

      <motion.div variants={rise}><Coverage onAsk={onAsk} disabled={disabled} /></motion.div>

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
                  {s.reserved && <p className="mono-label mt-1 text-[9px] text-[#64748B]">{t('reservedNotEmitted')}</p>}
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
