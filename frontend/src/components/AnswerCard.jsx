import React from 'react';
import { motion } from 'framer-motion';
import { FileText, TriangleAlert, ShieldCheck, MessageSquareWarning, ArrowRight } from 'lucide-react';
import Seal from './Seal';
import TrustShield from './TrustShield';

export const citeKey = (c) => (c ? `${c.gr_id}|${c.page}|${c.passage || ''}` : '');

const LABELS = {
  Established: { cls: 'bg-iris-50 text-iris-800 ring-1 ring-iris-200', dot: 'bg-iris-600', note: 'Directly supported by a cited passage' },
  Inferred: { cls: 'bg-[#FFF6E3] text-[#8A4B0B] ring-1 ring-[#E8C47A]', dot: 'bg-[#D98A1F]', note: 'Reasoned from the passages, not stated in them' },
  Unverified: { cls: 'bg-sand text-mist ring-1 ring-stone', dot: 'bg-faint', note: 'Not found in the documents' },
};
const labelOf = (l) => (l === 'Not found' ? 'Unverified' : l);
const sealOf = (c) => (c?.lineage?.status === 'superseded' ? 'superseded' : c?.lineage?.status === 'amended' ? 'amended' : 'no_change');

export function CitationChip({ cit, active, onSelect }) {
  return (
    <motion.button
      type="button"
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onSelect(cit)}
      aria-pressed={active}
      title={cit.subject || cit.gr_number}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-lg px-2 py-1 text-[11.5px] transition-all ${active ? 'bg-[#FFF6E3] text-[#8A4B0B]' : 'bg-ivory text-mist hover:text-iris-800'}`}
      style={{ boxShadow: active ? '0 0 0 1.5px #D98A1F, 0 6px 14px -6px rgba(217,138,31,.55)' : '0 0 0 1px rgba(30,41,59,.1), inset 0 1px 0 #fff' }}
    >
      <FileText className={`h-3 w-3 shrink-0 ${active ? 'text-[#B45309]' : 'text-iris-600'}`} />
      <span className="truncate font-mono font-semibold">{cit.gr_number || cit.gr_id}</span>
      <span className="opacity-40">·</span>
      <span className="shrink-0 font-mono font-semibold">p.{cit.page}</span>
    </motion.button>
  );
}

export default function AnswerCard({ response, active, onSelect }) {
  const answered = response.verdict === 'answered';
  const warnings = response.warnings || [];
  const isGu = /[઀-૿]/.test(response.summary || response.insufficient_reason || '');

  return (
    <div className="space-y-3.5">
      {warnings.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} role="alert" className="overflow-hidden rounded-xl border border-[#F1D6A0] border-l-[3px] border-l-[#D98A1F] bg-[#FFF6E3]">
          {warnings.map((w, i) => (
            <p key={i} className="flex items-start gap-2 px-3.5 py-2 text-[12.5px] font-medium leading-relaxed text-[#6F3D08] [&:not(:first-child)]:border-t [&:not(:first-child)]:border-[#F1D6A0]">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#B45309]" />
              <span>{w}</span>
            </p>
          ))}
        </motion.div>
      )}

      {/* The finding: first thing read, set large in serif */}
      <section data-tour="finding" className="sheet px-5 pb-5 pt-4 sm:px-7 sm:pb-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className={`eyebrow flex items-center gap-1.5 ${answered ? '!text-iris-700' : '!text-[#475569]'}`}>
            {answered ? <span className="h-1.5 w-1.5 rounded-full bg-iris-600" /> : <MessageSquareWarning className="h-3.5 w-3.5" />}
            {answered ? 'Answer' : 'Why no answer'}
          </h2>
          {answered && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#C5DDD1] bg-[#EEF5F1] px-2.5 py-0.5 text-[11px] font-semibold text-[#2F5D4E]">
              <ShieldCheck className="h-3 w-3" /> Verified from official text
            </span>
          )}
        </div>
        <p className={`${isGu ? 'gu-text' : 'display'} text-[20px] font-normal leading-[1.62] text-ink sm:text-[22px]`}>
          {answered ? response.summary : response.insufficient_reason}
        </p>
        <TrustShield response={response} />
      </section>

      {/* Statements: footnote ledger */}
      {answered && (response.statements || []).length > 0 && (
        <section className="sheet p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <h2 className="eyebrow">Statements &amp; sources</h2>
            <span className="mono-label text-faint">{response.statements.length} {response.statements.length === 1 ? 'statement' : 'statements'}</span>
          </div>
          <ol className="ledger mt-2">
            {response.statements.map((st, i) => {
              const label = labelOf(st.label);
              const L = LABELS[label] || LABELS.Unverified;
              return (
                <motion.li key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="grid grid-cols-[1.7rem_minmax(0,1fr)] gap-2 py-3">
                  <span className="pt-0.5 font-mono text-[11px] font-bold text-faint">¶{i + 1}</span>
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <p className="gu-text text-[14.5px] leading-relaxed text-legal">{st.text}</p>
                      <span title={L.note} className={`mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${L.cls}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${L.dot}`} />
                        {label}
                      </span>
                    </div>
                    {st.citations.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="mr-0.5 text-[11.5px] text-faint">Cited in</span>
                        {st.citations.map((c, j) => (
                          <CitationChip key={j} cit={c} active={citeKey(c) === citeKey(active)} onSelect={onSelect} />
                        ))}
                      </div>
                    )}
                  </div>
                </motion.li>
              );
            })}
          </ol>
        </section>
      )}

      {/* Verbatim passages: block quotes */}
      {answered && response.citations.length > 0 && (
        <section data-tour="passages" className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h2 className="eyebrow">Verbatim passages</h2>
            <span className="text-[11.5px] text-faint">Select one to lock it on the page</span>
          </div>
          {response.citations.map((c, i) => {
            const on = citeKey(c) === citeKey(active);
            return (
              <motion.button
                key={i}
                type="button"
                onClick={() => onSelect(c)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + i * 0.05 }}
                aria-pressed={on}
                className={`group relative block w-full overflow-hidden rounded-2xl p-4 pl-5 text-left transition-all ${on ? 'bg-[#FFF8E8]' : 'bg-ivory hover:bg-white'}`}
                style={{ boxShadow: on ? '0 0 0 1.5px #D98A1F, 0 14px 28px -14px rgba(217,138,31,.5)' : '0 0 0 1px rgba(30,41,59,.08), 0 1px 2px rgba(30,41,59,.04)' }}
              >
                <span aria-hidden className={`absolute inset-y-0 left-0 w-[3px] transition-colors ${on ? 'bg-[#D98A1F]' : 'bg-stone group-hover:bg-iris-500'}`} />
                <span aria-hidden className="display pointer-events-none absolute -top-2 right-3 select-none text-[68px] leading-none text-ink/[.045]">”</span>
                <p className="legal-text relative text-[14.5px] text-ink">“{c.passage}”</p>
                {(c.subject || c.department) && (
                  <p className="gu-text relative mt-2 text-[11.5px] leading-snug text-mist">
                    {c.subject}{c.subject && c.department ? ' · ' : ''}{c.department}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-hair pt-2.5">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[11px] text-mist">
                    <Seal status={sealOf(c)} size={22} />
                    <span className="font-bold text-ink">{c.gr_number || c.gr_id}</span>
                    {c.issue_date && <span>{c.issue_date}</span>}
                    <span>p.{c.page}</span>
                    {c.lineage?.status === 'superseded' && <span className="font-bold text-[#8E1F3A]">superseded</span>}
                    {c.lineage?.status === 'amended' && <span className="font-bold text-[#8A4B0B]">amended</span>}
                  </div>
                  <span className={`inline-flex items-center gap-1.5 text-[11.5px] font-semibold ${on ? 'text-[#8A4B0B]' : 'text-iris-600 transition-transform group-hover:translate-x-0.5'}`}>
                    {on ? (
                      <>
                        <span className="relative flex h-1.5 w-1.5"><span className="absolute inset-0 animate-pingSoft rounded-full bg-[#D98A1F]" /><span className="relative h-1.5 w-1.5 rounded-full bg-[#D98A1F]" /></span>
                        Locked on page
                      </>
                    ) : (
                      <>Lock on page <ArrowRight className="h-3 w-3" /></>
                    )}
                  </span>
                </div>
              </motion.button>
            );
          })}
        </section>
      )}
    </div>
  );
}
