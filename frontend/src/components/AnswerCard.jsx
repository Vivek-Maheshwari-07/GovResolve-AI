import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, TriangleAlert, ShieldCheck, MessageSquareWarning,
  ArrowRight, ChevronDown, ChevronUp, Quote, Layers, BookOpen,
  Printer,
} from 'lucide-react';
import Seal from './Seal';
import TrustShield from './TrustShield';

export const citeKey = (c) => (c ? `${c.gr_id}|${c.page}|${c.passage || ''}` : '');

const LABELS = {
  Established: { cls: 'badge-safe', dot: 'bg-[#10B981]', note: 'Directly supported by a cited passage' },
  Inferred: { cls: 'badge-caution', dot: 'bg-[#F59E0B]', note: 'Reasoned from the passages, not stated in them' },
  Unverified: { cls: 'badge-danger', dot: 'bg-[#F43F5E]', note: 'Not found in the documents' },
};
const labelOf = (l) => (l === 'Not found' ? 'Unverified' : l);
const sealOf = (c) => (c?.lineage?.status === 'superseded' ? 'superseded' : c?.lineage?.status === 'amended' ? 'amended' : 'no_change');

function CitationChip({ cit, active, onSelect }) {
  return (
    <motion.button
      type="button"
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect(cit)}
      aria-pressed={active}
      title={cit.subject || cit.gr_number}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11.5px] font-medium transition-all ${
        active
          ? 'bg-[#EEF2FF] text-[#4F46E5] ring-1.5 ring-[#4F46E5] shadow-[0_2px_8px_-2px_rgba(79,70,229,0.25)]'
          : 'bg-[rgba(255,255,255,0.92)] text-[#64748B] hover:bg-[#EEF2FF] hover:text-[#4F46E5] border border-[#E6E4DD]'
      }`}
      style={{
        boxShadow: active ? undefined : '0 1px 2px rgba(15,23,42,0.03)',
      }}
    >
      <FileText className={`h-3 w-3 shrink-0 ${active ? 'text-[#4F46E5]' : 'text-[#4F46E5]'}`} />
      <span className="truncate font-mono font-semibold text-[#1E293B]">{cit.gr_number || cit.gr_id}</span>
      <span className="opacity-40 text-[#64748B]">·</span>
      <span className="shrink-0 font-mono font-semibold text-[#64748B]">p.{cit.page}</span>
    </motion.button>
  );
}

export default function AnswerCard({ response, active, onSelect }) {
  const answered = response.verdict === 'answered';
  const warnings = response.warnings || [];
  const isGu = /[઀-૿]/.test(response.summary || response.insufficient_reason || '');
  const citations = response.citations || [];
  const statements = response.statements || [];

  const [activeTab, setActiveTab] = useState('passages');
  const [drawerOpen, setDrawerOpen] = useState(true);

  return (
    <div className="space-y-3">
      {/* Warnings alert */}
      {warnings.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          role="alert"
          className="overflow-hidden rounded-xl border border-[#FDE68A] border-l-[4px] border-l-[#F59E0B] bg-[#FFFBEB] shadow-sm"
        >
          {warnings.map((w, i) => (
            <p key={i} className="flex items-start gap-2 px-4 py-2.5 text-[12.5px] font-medium leading-relaxed text-[#92400E] [&:not(:first-child)]:border-t [&:not(:first-child)]:border-[#FDE68A]">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#F59E0B]" />
              <span>{w}</span>
            </p>
          ))}
        </motion.div>
      )}

      {/* Primary Finding Card */}
      <section data-tour="finding" className="sheet px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className={`eyebrow flex items-center gap-1.5 ${answered ? '!text-[#4F46E5]' : '!text-[#64748B]'}`}>
              {answered ? <span className="h-2 w-2 rounded-full bg-[#4F46E5]" /> : <MessageSquareWarning className="h-3.5 w-3.5 text-[#64748B]" />}
              {answered ? 'Administrative Finding' : 'Why No Finding'}
            </h2>
            <span className="telemetry-tag hidden sm:inline text-[9px] text-[#64748B]">· [LEGAL_EXTRACT]</span>
          </div>
          <div className="flex items-center gap-2">
            {answered && (
              <span className="inline-flex items-center gap-1.5 rounded-full badge-safe px-2.5 py-0.5 text-[11px] font-semibold shadow-sm">
                <ShieldCheck className="h-3.5 w-3.5 text-[#10B981]" /> Verified from official text
              </span>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              title="Export official Secretariat Action Memorandum"
              aria-label="Export Action Memo"
              className="print:hidden inline-flex items-center gap-1.5 rounded-lg border border-[#E6E4DD] bg-[rgba(255,255,255,0.92)] px-2.5 py-1 text-[11.5px] font-semibold text-[#1E293B] shadow-sm hover:border-[#4F46E5] hover:bg-[#EEF2FF] hover:text-[#4F46E5] transition-all"
            >
              <Printer className="h-3.5 w-3.5 text-[#4F46E5]" />
              <span>Export Action Memo</span>
            </button>
          </div>
        </div>
        <p className={`${isGu ? 'gu-text' : 'display'} text-[19px] font-normal leading-[1.62] text-[#1E293B] sm:text-[21px]`}>
          {answered ? response.summary : response.insufficient_reason}
        </p>
        <TrustShield response={response} />
      </section>

      {/* Segmented Collapsible Evidence Drawer */}
      {answered && (citations.length > 0 || statements.length > 0) && (
        <section data-tour="passages" className="sheet overflow-hidden">
          {/* Drawer control bar */}
          <div className="flex items-center justify-between border-b border-[#E6E4DD] bg-[#F1EFEA]/80 px-4 py-2 sm:px-5">
            <div className="flex items-center gap-2">
              <div className="well flex p-0.5" role="tablist" aria-label="Evidence views">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'passages'}
                  onClick={() => { setActiveTab('passages'); setDrawerOpen(true); }}
                  className={`inline-flex items-center gap-1.5 rounded-[9px] px-3 py-1 text-[11.5px] font-semibold transition-all ${
                    activeTab === 'passages'
                      ? 'border border-[#E6E4DD] bg-[rgba(255,255,255,0.92)] text-[#4F46E5] shadow-sm'
                      : 'text-[#64748B] hover:text-[#1E293B]'
                  }`}
                >
                  <Quote className="h-3.5 w-3.5" />
                  <span>Verbatim Passages</span>
                  <span className="rounded-full bg-[#EEF2FF] px-1.5 py-0.2 text-[9.5px] font-bold text-[#4F46E5]">
                    {citations.length}
                  </span>
                </button>

                {statements.length > 0 && (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'statements'}
                    onClick={() => { setActiveTab('statements'); setDrawerOpen(true); }}
                    className={`inline-flex items-center gap-1.5 rounded-[9px] px-3 py-1 text-[11.5px] font-semibold transition-all ${
                      activeTab === 'statements'
                        ? 'border border-[#E6E4DD] bg-[rgba(255,255,255,0.92)] text-[#4F46E5] shadow-sm'
                        : 'text-[#64748B] hover:text-[#1E293B]'
                    }`}
                  >
                    <Layers className="h-3.5 w-3.5" />
                    <span>Statements</span>
                    <span className="rounded-full bg-[#F1EFEA] px-1.5 py-0.2 text-[9.5px] font-bold text-[#64748B]">
                      {statements.length}
                    </span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="telemetry-tag hidden sm:inline text-[9px] text-[#64748B]">
                [EVIDENCE_VAULT]
              </span>
              <button
                type="button"
                onClick={() => setDrawerOpen((v) => !v)}
                aria-expanded={drawerOpen}
                className="inline-flex items-center gap-1 rounded-lg border border-[#E6E4DD] bg-[rgba(255,255,255,0.90)] px-2.5 py-1 text-[11px] font-semibold text-[#64748B] hover:bg-[#EEF2FF] hover:text-[#4F46E5] transition shadow-xs"
              >
                <span>{drawerOpen ? 'Collapse' : 'Expand'}</span>
                {drawerOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {/* Drawer content */}
          <AnimatePresence initial={false}>
            {drawerOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                {/* View 1: Verbatim Legal Excerpt Passages */}
                {activeTab === 'passages' && (
                  <div className="space-y-3 p-3.5 sm:p-5">
                    {citations.map((c, i) => {
                      const on = citeKey(c) === citeKey(active);
                      return (
                        <motion.button
                          key={i}
                          type="button"
                          whileTap={{ scale: 0.99 }}
                          onClick={() => onSelect(c)}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                          aria-pressed={on}
                          className={`legal-quote-block group relative block w-full overflow-hidden p-4 pl-5 text-left transition-all ${
                            on
                              ? 'border-l-[4px] border-l-[#D97706] border-[#FDE68A] bg-[#FFFBEB]/70 ring-1 ring-[#D97706]/30'
                              : 'border-l-[4px] border-l-[#4F46E5]/40 hover:border-l-[#4F46E5] hover:bg-white hover:border-[#C7D2FE]'
                          }`}
                          style={{
                            boxShadow: on
                              ? '0 0 0 1px #D97706, 0 8px 24px -4px rgba(217,119,6,0.18)'
                              : '0 1px 3px rgba(15,23,42,0.03)',
                          }}
                        >
                          <span aria-hidden className="display pointer-events-none absolute -top-3 right-3 select-none text-[64px] leading-none text-[#1E293B]/[0.04]">
                            ”
                          </span>
                          <p className="legal-text relative pl-0.5 text-[14px] leading-relaxed text-[#1E293B]">
                            “{c.passage}”
                          </p>
                          {(c.subject || c.department) && (
                            <p className="gu-text relative mt-2 text-[11.5px] leading-snug text-[#64748B]">
                              {c.subject}{c.subject && c.department ? ' · ' : ''}{c.department}
                            </p>
                          )}

                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#E6E4DD] pt-2.5">
                            <div className="flex flex-wrap items-center gap-x-2.5 font-mono text-[11px] text-[#64748B]">
                              <Seal status={sealOf(c)} size={20} />
                              <span className="font-bold text-[#1E293B]">{c.gr_number || c.gr_id}</span>
                              {c.issue_date && <span>{c.issue_date}</span>}
                              <span className="rounded bg-[#F1EFEA] px-1.5 py-0.5 font-bold text-[#1E293B]">p.{c.page}</span>
                              {c.lineage?.status === 'superseded' && <span className="font-bold text-[#9F1239]">superseded</span>}
                              {c.lineage?.status === 'amended' && <span className="font-bold text-[#92400E]">amended</span>}
                            </div>
                            <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${on ? 'text-[#D97706]' : 'text-[#4F46E5] group-hover:translate-x-0.5 transition-transform'}`}>
                              {on ? (
                                <>
                                  <span className="relative flex h-1.5 w-1.5">
                                    <span className="absolute inset-0 animate-pingSoft rounded-full bg-[#D97706]" />
                                    <span className="relative h-1.5 w-1.5 rounded-full bg-[#D97706]" />
                                  </span>
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
                  </div>
                )}

                {/* View 2: Statements & Sources */}
                {activeTab === 'statements' && (
                  <div className="p-3.5 sm:p-5">
                    <ol className="ledger divide-y divide-[#E6E4DD]">
                      {statements.map((st, i) => {
                        const label = labelOf(st.label);
                        const L = LABELS[label] || LABELS.Unverified;
                        return (
                          <motion.li
                            key={i}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04 }}
                            className="grid grid-cols-[1.8rem_minmax(0,1fr)] gap-2 py-3.5 first:pt-1 last:pb-1"
                          >
                            <span className="pt-0.5 font-mono text-[11px] font-bold text-[#64748B]">¶{i + 1}</span>
                            <div className="space-y-2">
                              <div className="flex items-start justify-between gap-3">
                                <p className="gu-text text-[14px] leading-relaxed text-[#1E293B]">{st.text}</p>
                                <span title={L.note} className={`mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${L.cls}`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${L.dot}`} />
                                  {label}
                                </span>
                              </div>
                              {st.citations.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                  <span className="mr-0.5 text-[11px] text-[#64748B]">Cited in</span>
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
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}
    </div>
  );
}
