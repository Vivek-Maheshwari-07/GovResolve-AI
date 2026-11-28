import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Loader2, ListChecks, FileText, SendHorizontal } from 'lucide-react';
import { explainResolution } from '../api';
import { useUiLanguage } from '../lib/i18n';

const CHIPS = [['explainChipSteps'], ['explainChipDocs'], ['explainChipDate']];
const isGu = (s) => /[઀-૿]/.test(s || '');

/**
 * "Explain in simple words" under an answer. Nothing is requested until the button is pressed (each request is one call to the hosted
 * model, which has a small free quota). The text is written by the server from the selected resolution's own stored text and checked
 * against it; if that is not possible the box says so instead of guessing. Follow-up questions are answered from the same resolution.
 */
export default function SimpleExplain({ response, active, language }) {
  const { t } = useUiLanguage();
  const citations = response.citations || [];
  const target = active?.gr_id ? active : citations[0];
  const docId = target?.gr_id;
  const pages = [...new Set(citations.filter((c) => c.gr_id === docId).map((c) => c.page).concat(target?.page || []))].filter(Boolean).slice(0, 3);
  const lang = ['en', 'gu', 'gujlish'].includes(language) ? language : (isGu(response.summary) ? 'gu' : 'en');

  const [byDoc, setByDoc] = useState({});   // docId -> { summary, followups: [{ q, res }], busy }
  const [text, setText] = useState('');
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  useEffect(() => { setByDoc({}); setText(''); }, [response]);   // a new answer starts clean

  if (!docId || !pages.length || response.verdict !== 'answered') return null;
  const st = byDoc[docId] || { summary: null, followups: [], busy: false };
  const patch = (fn) => setByDoc((m) => ({ ...m, [docId]: fn(m[docId] || { summary: null, followups: [], busy: false }) }));

  const run = async (followup) => {
    if (st.busy) return;
    patch((s) => ({ ...s, busy: followup || 'summary' }));
    let res;
    try {
      res = await explainResolution({ question: response.question || '', language: lang, docId, pages, followup });
    } catch {
      res = { available: false, reason: 'busy' };
    }
    if (!alive.current) return;
    patch((s) => (followup
      ? { ...s, busy: false, followups: [{ q: followup, res }, ...s.followups] }
      : { ...s, busy: false, summary: res }));
  };

  const reasonText = (res) => (res.reason === 'busy' ? t('explainBusy') : res.reason === 'no_text' ? t('explainNoText') : t('explainUnverified'));
  const ask = (e) => {
    e.preventDefault();
    const q = text.trim();
    if (!q || st.busy) return;
    setText('');
    run(q);
  };

  const s = st.summary;
  return (
    <section className="sheet p-4 print:hidden sm:p-5" aria-label={t('explainSimple')}>
      {!s?.available && (
        <button
          type="button"
          onClick={() => run('')}
          disabled={!!st.busy}
          className="inline-flex items-center gap-2 rounded-xl border border-[#C7D2FE] bg-[#EEF2FF] px-3.5 py-2 text-[13px] font-semibold text-[#4338CA] transition-colors hover:bg-[#E0E7FF] disabled:opacity-60"
        >
          {st.busy === 'summary' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {st.busy === 'summary' ? t('explainWorking') : t('explainSimple')}
        </button>
      )}
      {s && !s.available && <p role="status" className="mt-3 text-[12.5px] leading-relaxed text-[#92400E]">{reasonText(s)}</p>}

      {s?.available && (
        <div>
          <p className="mono-label text-[10px] text-[#64748B]">{t('explainAbout', { gr: target.gr_number || docId })} · {t('explainLabel')}</p>
          <p className={`${isGu(s.simple) ? 'gu-text' : ''} mt-2 text-[15.5px] leading-[1.7] text-[#1E293B]`}>{s.simple}</p>
          {s.steps?.length > 0 && (
            <div className="mt-4">
              <h3 className="eyebrow flex items-center gap-1.5"><ListChecks className="h-3.5 w-3.5" />{t('explainNextSteps')}</h3>
              <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-[14px] leading-relaxed text-[#1E293B]">{s.steps.map((x) => <li key={x} className={isGu(x) ? 'gu-text' : ''}>{x}</li>)}</ol>
            </div>
          )}
          {s.documents?.length > 0 && (
            <div className="mt-4">
              <h3 className="eyebrow flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />{t('explainDocuments')}</h3>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[14px] leading-relaxed text-[#1E293B]">{s.documents.map((x) => <li key={x} className={isGu(x) ? 'gu-text' : ''}>{x}</li>)}</ul>
            </div>
          )}
          {!s.steps?.length && !s.documents?.length && <p className="mt-3 text-[12.5px] text-[#64748B]">{t('explainNotStated')}</p>}

          <div className="mt-5 border-t border-[#E6E4DD] pt-4">
            <h3 className="eyebrow">{t('explainAskTitle')}</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {CHIPS.map(([k]) => (
                <button key={k} type="button" disabled={!!st.busy} onClick={() => run(t(k))} className="rounded-full border border-[#E6E4DD] bg-white px-3 py-1 text-[12px] font-semibold text-[#1E293B] transition-colors hover:border-[#4F46E5] hover:bg-[#EEF2FF]/60 disabled:opacity-60">
                  {t(k)}
                </button>
              ))}
            </div>
            <form onSubmit={ask} className="mt-3 flex gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={300}
                placeholder={t('explainAskPlaceholder')}
                aria-label={t('explainAskTitle')}
                className="min-w-0 flex-1 rounded-xl border border-[#E6E4DD] bg-white px-3 py-2 text-[13.5px] text-[#1E293B] outline-none focus:border-[#4F46E5] focus:ring-4 focus:ring-[#4F46E5]/15"
              />
              <button type="submit" disabled={!text.trim() || !!st.busy} className="inline-flex items-center gap-1.5 rounded-xl bg-[#4F46E5] px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#4338CA] disabled:opacity-50">
                {st.busy && st.busy !== 'summary' ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />} {t('explainAskButton')}
              </button>
            </form>
            {st.followups.length > 0 && (
              <ul className="mt-4 space-y-3">
                {st.followups.map((f, i) => (
                  <li key={`${f.q}-${i}`} className="rounded-xl bg-[#F1EFEA]/60 p-3">
                    <p className="text-[12px] font-semibold text-[#64748B]">{f.q}</p>
                    {f.res.available ? (
                      <p className={`${isGu(f.res.answer) ? 'gu-text' : ''} mt-1 text-[14px] leading-relaxed ${f.res.stated ? 'text-[#1E293B]' : 'text-[#64748B]'}`}>
                        {f.res.stated ? f.res.answer : t('explainNotSaid')}
                      </p>
                    ) : (
                      <p className="mt-1 text-[12.5px] text-[#92400E]">{reasonText(f.res)}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
