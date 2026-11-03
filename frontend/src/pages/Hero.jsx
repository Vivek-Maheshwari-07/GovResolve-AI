import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';
import { Scale, ArrowRight, ArrowDown } from 'lucide-react';
import Specimen from './hero/Specimen';
import TimeDemo from './hero/TimeDemo';
import { Costs, HowItWorks, Limits, ForWhom, Eyebrow, Reveal } from './hero/Sections';

/**
 * Introductory landing page, shown on a visitor's first visit.
 *   onGetStarted: leave the page and start the guided tour inside the application
 *   onSkip:       go straight to the application without the tour
 */
const NAV = [['why', 'The problem'], ['how', 'How it works'], ['limits', 'Limits']];

export default function Hero({ onGetStarted, onSkip }) {
  const scroller = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  const { scrollYProgress } = useScroll({ container: scroller });
  const bar = useSpring(scrollYProgress, { stiffness: 140, damping: 26, mass: 0.4 });

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
              <button key={id} type="button" onClick={() => go(id)} className="text-[13px] font-medium text-mist transition hover:text-ink">{label}</button>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onSkip} className="hidden text-[12.5px] font-medium text-mist underline decoration-stone underline-offset-4 transition hover:text-ink sm:block">Skip to the app</button>
            <button type="button" onClick={onGetStarted} className="btn-primary group inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold text-white transition hover:brightness-110">
              Get Started <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        {/* masthead */}
        <section className="relative mx-auto grid max-w-[1180px] items-center gap-12 px-5 pb-20 pt-10 sm:px-8 lg:min-h-[calc(100vh-64px)] lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-8 lg:pt-4">
          <div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="h-px w-8 bg-iris-600" />
              <span className="mono-label text-iris-700">Problem PS000230 · Seva First Innovation Challenge</span>
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 120, damping: 22, delay: 0.08 }} className="display mt-6 text-[40px] font-bold leading-[1.1] text-ink [text-wrap:balance] sm:text-[58px]">
              The rule you found <span className="italic text-iris-600">may not be</span> the rule that{' '}
              <span className="relative inline-block whitespace-nowrap">
                <motion.span aria-hidden className="absolute inset-x-[-.08em] bottom-[.08em] -z-0 h-[.46em] origin-left -rotate-[.8deg] rounded-[2px] bg-[#F5B83D]/70" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.95, duration: 0.7, ease: [0.6, 0, 0.2, 1] }} />
                <span className="relative">applies.</span>
              </span>
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.6 }} className="mt-6 max-w-[34rem] text-[16.5px] leading-[1.65] text-mist">
              GovResolve-AI answers questions about Gujarat Government Resolutions in Gujarati, English, or a mix of both. Every answer comes with the page it came from, the exact words, and whether a later order has changed them.
            </motion.p>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="gu-text mt-2 max-w-[34rem] text-[14.5px] font-medium text-iris-700">
              તમે જે ઠરાવ વાંચ્યો તે હજુ લાગુ પડે છે કે કેમ, પાનાં, મૂળ શબ્દો અને પછીના સુધારા સાથે જાણો.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-3">
              <button type="button" onClick={onGetStarted} className="btn-primary group inline-flex items-center gap-2.5 rounded-[14px] px-6 py-3.5 text-[15px] font-semibold text-white transition hover:brightness-110 active:scale-[.98]">
                Get Started
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
              <button type="button" onClick={() => go('why')} className="inline-flex items-center gap-2 text-[14px] font-semibold text-ink transition hover:text-iris-700">
                See why it matters <ArrowDown className="h-3.5 w-3.5" />
              </button>
              <span className="hidden items-center gap-1.5 text-[11.5px] text-faint sm:flex"><kbd className="kbd">Enter</kbd> to begin</span>
            </motion.div>

            <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.75 }} className="mt-10 flex flex-wrap gap-x-5 gap-y-1.5 border-t border-hair pt-4 text-[12px] text-mist">
              <li>Gujarati · English · Gujlish</li>
              <li>Quotes copied, never retyped</li>
              <li>Says “insufficient evidence” instead of guessing</li>
            </motion.ul>
          </div>

          <Specimen className="mx-auto mb-10 w-full max-w-[400px] lg:mb-0" />
        </section>

        {/* problem */}
        <section id="hero-why" className="border-t border-hair bg-ivory/50 py-20 sm:py-24">
          <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
            <Reveal><Eyebrow num="01">Why this exists</Eyebrow></Reveal>
            <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-12">
              <Reveal as="h2" className="display text-[30px] font-bold leading-[1.15] text-ink [text-wrap:balance] sm:text-[38px]">One rule, three different answers, depending on the day you read it.</Reveal>
              <Reveal delay={0.08} className="text-[15px] leading-[1.7] text-mist">
                Resolutions are amended and replaced quietly. A 2018 order can be superseded in 2021 while the old copy stays in the file. A keyword search finds the old copy just as happily as the new one, and nothing on the page says which to trust.
              </Reveal>
            </div>
            <Reveal className="mt-10"><TimeDemo /></Reveal>
            <Costs />
          </div>
        </section>

        {/* how */}
        <section id="hero-how" className="py-20 sm:py-24">
          <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
            <Reveal><Eyebrow num="02">How an answer is made</Eyebrow></Reveal>
            <Reveal as="h2" className="display mt-4 max-w-[24ch] text-[30px] font-bold leading-[1.15] text-ink [text-wrap:balance] sm:text-[38px]">Four steps, and you can inspect every one of them.</Reveal>
            <HowItWorks />
          </div>
        </section>

        {/* limits */}
        <section id="hero-limits" className="border-t border-hair bg-ivory/50 py-20 sm:py-24">
          <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
            <Reveal><Eyebrow num="03">Where it stops</Eyebrow></Reveal>
            <Reveal as="h2" className="display mt-4 max-w-[26ch] text-[30px] font-bold leading-[1.15] text-ink [text-wrap:balance] sm:text-[38px]">It would rather say “I can’t establish that” than guess.</Reveal>
            <Limits />
          </div>
        </section>

        {/* audience */}
        <section className="py-20 sm:py-24">
          <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
            <Reveal><Eyebrow num="04">Who asks</Eyebrow></Reveal>
            <Reveal as="h2" className="display mt-4 max-w-[24ch] text-[30px] font-bold leading-[1.15] text-ink [text-wrap:balance] sm:text-[38px]">Built for the people who have to act on the rule.</Reveal>
            <ForWhom />
          </div>
        </section>

        {/* call to action */}
        <section className="relative overflow-hidden border-t border-hair py-24 text-center sm:py-28">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-iris-300 to-transparent" />
          <Reveal className="mx-auto max-w-[760px] px-5">
            <h2 className="display text-[34px] font-bold leading-[1.12] text-ink [text-wrap:balance] sm:text-[46px]">Ask your first question.</h2>
            <p className="mx-auto mt-4 max-w-[30rem] text-[15.5px] leading-relaxed text-mist">We will walk you through one real answer in about two minutes: the verdict, the exact page, and the amendment chain behind it.</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-5">
              <button type="button" onClick={onGetStarted} className="btn-primary group inline-flex items-center gap-2.5 rounded-[14px] px-7 py-4 text-[16px] font-semibold text-white transition hover:brightness-110 active:scale-[.98]">
                Get Started <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
              <button type="button" onClick={onSkip} className="text-[13.5px] font-medium text-mist underline decoration-stone underline-offset-4 transition hover:text-ink">Skip the tour and open the app</button>
            </div>
          </Reveal>
        </section>

        <footer className="border-t border-hair">
          <div className="mx-auto flex max-w-[1180px] flex-col gap-2 px-5 py-6 text-[11.5px] leading-relaxed text-faint sm:px-8 md:flex-row md:items-start md:justify-between">
            <p className="max-w-[44rem]">Specimens on this page are invented for illustration. Inside the app, answers come only from the indexed official resolutions and are quoted verbatim. This is not legal advice.</p>
            <p className="mono-label text-[9.5px]">PS000230 · Seva First Innovation Challenge</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
