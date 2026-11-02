import React from 'react';
import { motion } from 'framer-motion';
import { FileText, Quote, TriangleAlert, Sparkles, ListChecks, MessageSquareWarning, ExternalLink, ArrowRight } from 'lucide-react';

export const citeKey = (c) => (c ? `${c.gr_id}|${c.page}|${c.passage || ''}` : '');

const LABELS = {
  Established: 'border-iris-300 bg-iris-50/90 text-iris-800 font-semibold',
  Inferred: 'border-amber-300 bg-amber-50/90 text-amber-800 font-semibold',
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
      className={`inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[11px] transition-all ${
        active
          ? 'border-amber-400 bg-amber-50 text-amber-900 shadow-[0_2px_10px_-2px_rgba(217,119,6,0.35)] ring-1 ring-amber-300'
          : 'border-hair bg-white text-mist hover:border-iris-400 hover:bg-iris-50/80 hover:text-iris-800 shadow-sm'
      }`}
    >
      <FileText className="h-3 w-3 shrink-0 text-iris-600" />
      <span className="truncate font-medium">{cit.gr_number || cit.gr_id}</span>
      <span className="text-[#8A94A6]">·</span>
      <span className="shrink-0 font-semibold">p.{cit.page}</span>
    </motion.button>
  );
}

export default function AnswerCard({ response, active, onSelect }) {
  const answered = response.verdict === 'answered';
  const warnings = response.warnings || [];
  const isGu = /[઀-૿]/.test(response.summary || response.insufficient_reason || '');

  return (
    <div className="space-y-3">
      {/* Warnings Panel */}
      {warnings.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          role="alert"
          className="space-y-1.5 rounded-2xl border border-amber-300 bg-amber-50/90 p-3.5 shadow-sm"
        >
          {warnings.map((w, i) => (
            <p key={i} className="flex items-start gap-2 text-xs leading-relaxed text-amber-900 font-medium">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
              <span>{w}</span>
            </p>
          ))}
        </motion.div>
      )}

      {/* Primary Executive Summary / Reason Card */}
      <section
        className={`relative overflow-hidden rounded-2xl border p-4 shadow-card ${
          answered
            ? 'border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-white to-white'
            : 'border-rose-100 bg-gradient-to-br from-rose-50/70 via-white to-white'
        }`}
      >
        <div className="mb-2 flex items-center justify-between">
          <h2
            className={`flex items-center gap-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] ${
              answered ? 'text-indigo-700' : 'text-rose-700'
            }`}
          >
            {answered ? <Sparkles className="h-3.5 w-3.5" /> : <MessageSquareWarning className="h-3.5 w-3.5" />}
            {answered ? 'Executive Finding' : 'Definitive Limitation / Reason'}
          </h2>
          {answered && (
            <span className="rounded-md border border-hair bg-white px-2 py-0.5 font-mono text-[10px] text-mist">
              Verified from official text
            </span>
          )}
        </div>
        <p className={`${isGu ? 'gu-text' : ''} text-[15px] leading-relaxed text-legal font-normal`}>
          {answered ? response.summary : response.insufficient_reason}
        </p>
      </section>

      {/* Statements and Proof Sources */}
      {answered && (response.statements || []).length > 0 && (
        <section className="glass-card space-y-2.5 rounded-2xl p-4 shadow-lift">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-violet-700">
              <ListChecks className="h-3.5 w-3.5" /> Verified Statements & Sources
            </h2>
            <span className="font-mono text-[10px] text-mist">
              {response.statements.length} verified {response.statements.length === 1 ? 'clause' : 'clauses'}
            </span>
          </div>

          <div className="space-y-2">
            {response.statements.map((st, i) => {
              const label = labelOf(st.label);
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="space-y-2 rounded-xl border border-hair/90 bg-sand/40 p-3 transition-colors hover:border-iris-300 hover:bg-white"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="gu-text text-[13.5px] leading-relaxed text-legal font-normal">{st.text}</p>
                    <span
                      className={`shrink-0 rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                        LABELS[label] || LABELS.Unverified
                      }`}
                    >
                      {label}
                    </span>
                  </div>

                  {st.citations.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-hair/60">
                      <span className="font-mono text-[10px] text-mist mr-1">Cited in:</span>
                      {st.citations.map((c, j) => (
                        <CitationChip
                          key={j}
                          cit={c}
                          active={citeKey(c) === citeKey(active)}
                          onSelect={onSelect}
                        />
                      ))}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      {/* Verbatim Legal Quotes Section */}
      {answered && response.citations.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="flex items-center gap-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-amber-800">
              <Quote className="h-3.5 w-3.5" /> Verbatim Page Passages
            </h2>
            <span className="font-mono text-[10px] text-mist">Click to inspect original PDF</span>
          </div>

          <div className="space-y-2">
            {response.citations.map((c, i) => {
              const on = citeKey(c) === citeKey(active);
              return (
                <motion.button
                  key={i}
                  type="button"
                  onClick={() => onSelect(c)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 + i * 0.04 }}
                  className={`group relative block w-full rounded-2xl p-4 text-left transition-all border ${
                    on
                      ? 'border-amber-400 bg-amber-50/70 shadow-[0_6px_22px_-6px_rgba(217,119,6,0.3)] ring-1 ring-amber-300'
                      : 'glass-card hover:border-iris-300 hover:bg-iris-50/40'
                  }`}
                >
                  <p className="legal-text text-[13.5px] text-legal font-normal leading-relaxed">
                    “{c.passage}”
                  </p>

                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-hair/60 pt-2 font-mono text-[11px] text-mist">
                    <div className="flex flex-wrap items-center gap-x-2.5">
                      <span className="font-semibold text-legal">{c.gr_number || c.gr_id}</span>
                      {c.issue_date && <span>· {c.issue_date}</span>}
                      <span>· Page {c.page}</span>
                      {c.lineage?.status &&
                        c.lineage.status !== 'no_later_amendment_found' &&
                        c.lineage.status !== 'unknown' && (
                          <span
                            className={`font-semibold ${
                              c.lineage.status === 'superseded' ? 'text-rose-700' : 'text-amber-700'
                            }`}
                          >
                            · {c.lineage.status}
                          </span>
                        )}
                    </div>

                    <span className="inline-flex items-center gap-1 text-[10.5px] text-iris-600 font-semibold group-hover:translate-x-0.5 transition-transform">
                      Inspect <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
