import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useScroll, useSpring, useTransform } from 'framer-motion';
import { Scale, ArrowRight, ArrowDown } from 'lucide-react';
import Specimen from './hero/Specimen';
import TimeDemo from './hero/TimeDemo';
import { Costs, HowItWorks, Limits, ForWhom, Eyebrow, Reveal } from './hero/Sections';
import { HeroBackdrop, LiveAsk, Magnetic, SplitWords, StatsStrip } from './hero/Motion';
import { useUiLanguage } from '../lib/i18n';

/**
 * Introductory landing page, shown on a visitor's first visit.
 *   onGetStarted: leave the page and start the guided tour inside the application
 *   onSkip:       go straight to the application without the tour
 */
const NAV = [['why', 'problem'], ['how', 'howItWorks'], ['limits', 'limits']];

export default function Hero({ onGetStarted, onSkip, stats = null }) {
  const { t } = useUiLanguage();
  const scroller = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  const { scrollYProgress } = useScroll({ container: scroller });
  const bar = useSpring(scrollYProgress, { stiffness: 140, damping: 26, mass: 0.4 });
  const specimenY = useTransform(scrollYProgress, [0, 0.25], [0, -44]); // the sheet drifts up a little as the page scrolls

  const go = useCallback((id) => {
    const el = document.getElementById(`hero-${id}`);
    const box = scroller.current;
    if (el && box) box.scrollTo({ top: el.offsetTop - 64, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Enter' && document.activeElement === document.body) {
        e.preventDefault();
        onGetStarted();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onGetStarted]);

  return (
    <div ref={scroller} onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 12)} className="fixed inset-0 z-40 overflow-y-auto overflow-x-hidden scroll-smooth" data-page="hero">
      <motion.div aria-hidden className="fixed left-0 right-0 top-0 z-50 h-[2px] origin-left bg-gradient-to-r from-iris-600 to-iris-300" style={{ scaleX: bar }} />

      {/* navigation */}
      <header className={`sticky top-0 z-40 transition-colors duration-300 ${scrolled ? 'border-b border-hair bg-canvas/85 backdrop-blur-xl' : 'border-b border-transparent'}`}>
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <a href="#top" onClick={(e) => { e.preventDefault(); scroller.current?.scrollTo({ top: 0, behavior: 'smooth' }); }} className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-gradient-to-b from-[#5F58F2] to-[#4338CA]" style={{ boxShadow: '0 0 0 1px rgba(55,48,163,.9), inset 0 1px 0 rgba(255,255,255,.28), 0 8px 16px -8px rgba(79,70,229,.8)' }}>
              <Scale className="h-4 w-4 text-white" strokeWidth={2.1} />
            </span>
            <span className="text-[16px] font-extrabold tracking-tight text-ink">GovResolve<span className="text-iris-600">·AI</span></span>
          </a>
          <nav aria-label="Sections" className="hidden items-center gap-7 md:flex">
            {NAV.map(([id, label]) => (
              <button key={id} type="button" onClick={() => go(id)} className="text-[13px] font-medium text-mist transition hover:text-ink">{t(label)}</button>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onSkip} className="hidden text-[12.5px] font-medium text-mist underline decoration-stone underline-offset-4 transition hover:text-ink sm:block">{t('skipToApp')}</button>
            <button type="button" onClick={onGetStarted} className="btn-primary group inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold text-white transition hover:brightness-110">
              {t('getStarted')} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        {/* masthead */}
        <section className="relative mx-auto grid max-w-[1180px] items-center gap-12 px-5 pb-20 pt-10 sm:px-8 lg:min-h-[calc(100vh-64px)] lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-8 lg:pt-4">
          <HeroBackdrop />
          <div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="h-px w-8 bg-iris-600" />
              <span className="mono-label text-iris-700">{t('introChallenge')}</span>
            </motion.div>

            <SplitWords text={t('introHeadline')} delay={0.1} className="display mt-6 text-[40px] font-bold leading-[1.1] text-ink [text-wrap:balance] sm:text-[58px]" />

            <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.6 }} className="mt-6 max-w-[34rem] text-[16.5px] leading-[1.65] text-mist">
              {t('introDescription')}
            </motion.p>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="gu-text mt-2 max-w-[34rem] text-[14.5px] font-medium text-iris-700">
              {t('introGujarati')}
            </motion.p>

            <LiveAsk onOpen={onGetStarted} />

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Magnetic>
                <button type="button" onClick={onGetStarted} className="btn-primary group inline-flex items-center gap-2.5 rounded-[14px] px-6 py-3.5 text-[15px] font-semibold text-white transition hover:brightness-110 active:scale-[.98]">
                  {t('getStarted')}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
              </Magnetic>
              <button type="button" onClick={() => go('why')} className="inline-flex items-center gap-2 text-[14px] font-semibold text-ink transition hover:text-iris-700">
                {t('seeWhy')} <ArrowDown className="h-3.5 w-3.5" />
              </button>
              <span className="hidden items-center gap-1.5 text-[11.5px] text-faint sm:flex"><kbd className="kbd">Enter</kbd> {t('toBegin')}</span>
            </motion.div>

            <StatsStrip stats={stats} />

            <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="mt-6 flex flex-wrap gap-x-5 gap-y-1.5 text-[12px] text-mist">
              <li>{t('heroBullet1')}</li>
              <li>{t('heroBullet2')}</li>
              <li>{t('heroBullet3')}</li>
            </motion.ul>
          </div>

          <motion.div style={{ y: specimenY }} className="mx-auto mb-10 w-full max-w-[400px] lg:mb-0">
            <Specimen className="w-full" />
          </motion.div>
        </section>

        {/* problem */}
        <section id="hero-why" className="border-t border-hair bg-ivory/50 py-20 sm:py-24">
          <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
            <Reveal><Eyebrow num="01">{t('heroWhyEyebrow')}</Eyebrow></Reveal>
            <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-12">
              <Reveal as="h2" className="display text-[30px] font-bold leading-[1.15] text-ink [text-wrap:balance] sm:text-[38px]">{t('heroWhyHeadline')}</Reveal>
              <Reveal delay={0.08} className="text-[15px] leading-[1.7] text-mist">
                {t('heroWhyText')}
              </Reveal>
            </div>
            <Reveal className="mt-10"><TimeDemo /></Reveal>
            <Costs />
          </div>
        </section>

        {/* how */}
        <section id="hero-how" className="py-20 sm:py-24">
          <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
            <Reveal><Eyebrow num="02">{t('heroHowEyebrow')}</Eyebrow></Reveal>
            <Reveal as="h2" className="display mt-4 max-w-[24ch] text-[30px] font-bold leading-[1.15] text-ink [text-wrap:balance] sm:text-[38px]">{t('heroHowHeadline')}</Reveal>
            <HowItWorks />
          </div>
        </section>

        {/* limits */}
        <section id="hero-limits" className="border-t border-hair bg-ivory/50 py-20 sm:py-24">
          <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
            <Reveal><Eyebrow num="03">{t('heroLimitsEyebrow')}</Eyebrow></Reveal>
            <Reveal as="h2" className="display mt-4 max-w-[26ch] text-[30px] font-bold leading-[1.15] text-ink [text-wrap:balance] sm:text-[38px]">{t('heroLimitsHeadline')}</Reveal>
            <Limits />
          </div>
        </section>

        {/* audience */}
        <section className="py-20 sm:py-24">
          <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
            <Reveal><Eyebrow num="04">{t('heroAudienceEyebrow')}</Eyebrow></Reveal>
            <Reveal as="h2" className="display mt-4 max-w-[24ch] text-[30px] font-bold leading-[1.15] text-ink [text-wrap:balance] sm:text-[38px]">{t('heroAudienceHeadline')}</Reveal>
            <ForWhom />
          </div>
        </section>

        {/* call to action */}
        <section className="relative overflow-hidden border-t border-hair py-24 text-center sm:py-28">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-iris-300 to-transparent" />
          <Reveal className="mx-auto max-w-[760px] px-5">
            <h2 className="display text-[34px] font-bold leading-[1.12] text-ink [text-wrap:balance] sm:text-[46px]">{t('heroCtaHeadline')}</h2>
            <p className="mx-auto mt-4 max-w-[30rem] text-[15.5px] leading-relaxed text-mist">{t('heroCtaText')}</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-5">
              <Magnetic strength={0.3}>
                <button type="button" onClick={onGetStarted} className="btn-primary group inline-flex items-center gap-2.5 rounded-[14px] px-7 py-4 text-[16px] font-semibold text-white transition hover:brightness-110 active:scale-[.98]">
                  {t('getStarted')} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
              </Magnetic>
              <button type="button" onClick={onSkip} className="text-[13.5px] font-medium text-mist underline decoration-stone underline-offset-4 transition hover:text-ink">{t('skipTourOpenApp')}</button>
            </div>
          </Reveal>
        </section>

        <footer className="border-t border-hair">
          <div className="mx-auto flex max-w-[1180px] flex-col gap-2 px-5 py-6 text-[11.5px] leading-relaxed text-faint sm:px-8 md:flex-row md:items-start md:justify-between">
            <p className="max-w-[44rem]">{t('heroFooterDisclaimer')}</p>
            <p className="mono-label text-[9.5px]">PS000230 · Seva First Innovation Challenge</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
