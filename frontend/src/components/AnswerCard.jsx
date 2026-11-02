import React from 'react';
import { motion } from 'framer-motion';
import { FileText, Quote, TriangleAlert, Sparkles, ListChecks, MessageSquareWarning } from 'lucide-react';

export const citeKey = (c) => (c ? `${c.gr_id}|${c.page}|${c.passage || ''}` : '');

const LABELS = {
  Established: 'border-[rgba(79,70,229,0.35)] bg-[rgba(79,70,229,0.14)] text-iris-700',
  Inferred: 'border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.1)] text-[#92400E]',
  Unverified: 'border-hair bg-sand text-mist',
};
const labelOf = (l) => (l === 'Not found' ? 'Unverified' : l);

export function CitationChip({ cit, active, onSelect }) {
  return (
    <motion.button
      type="button"
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onSelect(cit)}
      aria-pressed={active}
      title={cit.subject || cit.gr_number}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2 py-1 font-mono text-[11px] transition-all ${
        active
          ? 'border-[rgba(245,158,11,0.55)] bg-[rgba(245,158,11,0.14)] text-[#92400E] shadow-[0_4px_14px_-6px_rgba(217,119,6,0.4)]'
          : 'border-hair bg-sand text-mist hover:border-[rgba(79,70,229,0.4)] hover:bg-iris-50 hover:text-iris-700 hover:shadow-[0_4px_14px_-6px_rgba(79,70,229,0.35)]'
      }`}
    >
      <FileText className="h-3 w-3 shrink-0" />
      <span className="truncate">{cit.gr_number || cit.gr_id}</span>
      <span className="text-[#8A94A6]">·</span>
      <span className="shrink-0">p.{cit.page}</span>
    </motion.button>
  );
}

export default function AnswerCard({ response, active, onSelect }) {
  const answered = response.verdict === 'answered';
  const warnings = response.warnings || [];
  const isGu = /[઀-૿]/.test(response.summary || response.insufficient_reason || '');

  return (
    <div className="space-y-3">
      {warnings.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} role="alert" className="space-y-1 rounded-xl border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.08)] p-3">
          {warnings.map((w, i) => (
            <p key={i} className="flex gap-2 text-xs leading-relaxed text-[#92400E]">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span>{w}</span>
            </p>
          ))}
        </motion.div>
      )}

      <section className={`relative overflow-hidden rounded-2xl border p-4 ${answered ? 'border-indigo-100 bg-gradient-to-br from-indigo-50/80 via-white to-white' : 'border-rose-100 bg-gradient-to-br from-rose-50/80 via-white to-white'}`}>
        <h2 className={`mb-1.5 flex items-center gap-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] ${answered ? 'text-indigo-600' : 'text-rose-600'}`}>
          {answered ? <Sparkles className="h-3.5 w-3.5" /> : <MessageSquareWarning className="h-3.5 w-3.5" />}
          {answered ? 'Answer' : 'Why there is no answer'}
        </h2>
        <p className={`${isGu ? 'gu-text' : ''} text-[15px] leading-relaxed text-legal`}>{answered ? response.summary : response.insufficient_reason}</p>
      </section>

      {answered && (response.statements || []).length > 0 && (
        <section className="glass space-y-2 rounded-2xl p-4">
          <h2 className="flex items-center gap-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-violet-600"><ListChecks className="h-3.5 w-3.5" /> Statements and their sources</h2>
          {response.statements.map((st, i) => {
            const label = labelOf(st.label);
            return (
              <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="space-y-2 rounded-xl border border-hair bg-sand/50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="gu-text text-sm leading-relaxed text-legal">{st.text}</p>
                  <span className={`shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-medium ${LABELS[label] || LABELS.Unverified}`}>[{label}]</span>
                </div>
                {st.citations.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {st.citations.map((c, j) => <CitationChip key={j} cit={c} active={citeKey(c) === citeKey(active)} onSelect={onSelect} />)}
                  </div>
                )}
              </motion.div>
            );
          })}
        </section>
      )}

      {answered && response.citations.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-1.5 px-1 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-amber-700">
            <Quote className="h-3.5 w-3.5" /> Verbatim legal quotes
          </h2>
          {response.citations.map((c, i) => {
            const on = citeKey(c) === citeKey(active);
            return (
              <motion.button
                key={i}
                type="button"
                onClick={() => onSelect(c)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className={`glass block w-full rounded-2xl p-3.5 text-left transition-all ${on ? 'border-l-[3px] !border-l-[#D97706] bg-[#FFFBEB] shadow-[0_6px_22px_-10px_rgba(217,119,6,0.35)]' : 'border-l-[3px] !border-l-iris-500/60 hover:bg-iris-50/70'}`}
              >
                <p className="legal-text text-[13.5px] text-legal">“{c.passage}”</p>
                <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-mist">
                  <span>{c.gr_number || c.gr_id}</span>
                  {c.issue_date && <span>· {c.issue_date}</span>}
                  <span>· page {c.page}</span>
                  {c.lineage?.status && c.lineage.status !== 'no_later_amendment_found' && c.lineage.status !== 'unknown' && (
                    <span className={c.lineage.status === 'superseded' ? 'text-[#9F1239]' : 'text-[#92400E]'}>· {c.lineage.status}</span>
                  )}
                </p>
              </motion.button>
            );
          })}
        </section>
      )}
    </div>
  );
}
