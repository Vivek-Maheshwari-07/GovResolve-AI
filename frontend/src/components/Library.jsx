import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, Loader2, ArrowUpDown, X } from 'lucide-react';
import { listGrs, lineageChain } from '../api';
import { STATUS, TONES } from '../lib/status';
import LineageGraph from './LineageGraph';
import Seal from './Seal';
import CountUp from './CountUp';
import GujaratiKeyboard from './GujaratiKeyboard';
import { useUiLanguage } from '../lib/i18n';
import { useLanguage } from '../lib/LanguageContext';
import { pickSubject } from '../lib/bilingualStrings';
import { displayNumber } from '../lib/grnumber';

const UNKNOWN = { key: 'insufficient', label: 'Status unknown', short: 'Unknown', tone: 'slate' };

const STATUS_FILTERS = [
  { id: 'all', labelKey: 'all' },
  { id: 'amended', labelKey: 'amended' },
  { id: 'superseded', labelKey: 'superseded' },
  { id: 'no_change', labelKey: 'noLaterChange' },
];

const LANG_FILTERS = [
  { id: 'all', labelKey: 'allLanguages' },
  { id: 'gu', label: 'ગુજરાતી' },
  { id: 'en', label: 'English' },
];

const MAX_ROWS = 150;
const norm = (s) => String(s || '').toLowerCase().replace(/[\s/._-]+/g, '');

function Seg({ on, onClick, children, gu, ...attributes }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      {...attributes}
      className={`rounded-[9px] px-2.5 py-1 text-[11.5px] font-semibold transition ${on ? 'border border-[#E6E4DD] bg-[rgba(255,255,255,0.88)] text-[#4F46E5] shadow-card' : 'text-[#64748B] hover:text-[#1E293B]'} ${gu ? 'gu-text' : ''}`}
    >
      {children}
    </button>
  );
}

export default function Library({ selectedId, onOpen, asOf, onAsOf }) {
  const { t } = useUiLanguage();
  const { lang: uiLang } = useLanguage();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [lang, setLang] = useState('all');
  const [status, setStatus] = useState('all');
  const [dept, setDept] = useState('all');
  const [chain, setChain] = useState([]);
  const [sortOrder, setSortOrder] = useState('newest');
  const searchRef = useRef(null);
  const searchSelection = useRef(null);
  const keyboardDialogRef = useRef(null);

  useEffect(() => {
    if (!keyboardOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    keyboardDialogRef.current?.focus();
    const key = (event) => {
      if (event.key === 'Escape') {
        setKeyboardOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const buttons = keyboardDialogRef.current?.querySelectorAll('button:not([disabled])');
      if (!buttons?.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (document.activeElement === keyboardDialogRef.current) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', key);
      const input = searchRef.current;
      const valueLength = input?.value.length || 0;
      const selection = searchSelection.current || { start: valueLength, end: valueLength };
      requestAnimationFrame(() => {
        input?.focus();
        input?.setSelectionRange(selection.start, selection.end);
      });
    };
  }, [keyboardOpen]);

  useEffect(() => {
    listGrs().then(setRows).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setChain([]);
      return;
    }
    lineageChain(selectedId).then(setChain).catch(() => setChain([]));
  }, [selectedId]);

  const counts = useMemo(() => {
    const c = { all: 0, amended: 0, superseded: 0, no_change: 0 };
    (rows || []).forEach((r) => {
      c.all += 1;
      if (c[r.status] !== undefined) c[r.status] += 1;
    });
    return c;
  }, [rows]);

  const depts = useMemo(() => [...new Set((rows || []).map((r) => r.department).filter(Boolean))].sort(), [rows]);

  const shown = useMemo(() => {
    if (!rows) return [];
    const nq = norm(q);
    let filtered = rows.filter(
      (r) =>
        (lang === 'all' || r.language === lang) &&
        (status === 'all' || r.status === status) &&
        (dept === 'all' || r.department === dept) &&
        (!nq || norm(r.gr_number).includes(nq) || norm(r.subject).includes(nq) || norm(r.subject_en).includes(nq)
          || norm(r.subject_gu).includes(nq) || String(r.issue_date || '').includes(q.trim())),
    );
    if (sortOrder === 'oldest') filtered = [...filtered].reverse();
    return filtered;
  }, [rows, q, lang, status, dept, sortOrder]);

  const open = (r) =>
    onOpen({ gr_id: r.gr_id, gr_number: r.gr_number, page: 1, issue_date: r.issue_date, department: r.department, subject: r.subject, subject_en: r.subject_en, subject_gu: r.subject_gu, language: r.language });

  const openNode = (n) =>
    onOpen({ gr_id: n.gr_id, gr_number: n.gr_number, page: (n.edges_out || [])[0]?.page || 1, issue_date: n.date, department: n.department, subject: n.subject, subject_en: n.subject_en, subject_gu: n.subject_gu, language: n.language });

  const insertGujarati = (character) => {
    const input = searchRef.current;
    const selection = input && document.activeElement === input
      ? { start: input.selectionStart, end: input.selectionEnd }
      : searchSelection.current || { start: q.length, end: q.length };
    const start = selection.start;
    const end = selection.end;
    let next;
    let cursor;

    if (character === '\b') {
      if (start === end && start === 0) return;
      const deleteAt = start === end ? start - 1 : start;
      next = q.slice(0, deleteAt) + q.slice(end);
      cursor = deleteAt;
    } else {
      next = q.slice(0, start) + character + q.slice(end);
      cursor = start + character.length;
    }

    setQ(next);
    searchSelection.current = { start: cursor, end: cursor };
    requestAnimationFrame(() => {
      input?.setSelectionRange(cursor, cursor);
    });
  };

  const keyboardPopup = typeof document === 'undefined' ? null : createPortal(
    <AnimatePresence>
      {keyboardOpen && (
        <motion.div
          key="library-gujarati-keyboard"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) setKeyboardOpen(false);
          }}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-[#0F172A]/40 p-3"
        >
          <motion.div
            ref={keyboardDialogRef}
            id="library-gujarati-keyboard-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={t('gujaratiKeyboard')}
            tabIndex={-1}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-3 shadow-[0_24px_70px_rgba(15,23,42,0.28)]"
          >
            <GujaratiKeyboard onInsert={insertGujarati} onClose={() => setKeyboardOpen(false)} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <header className="px-1">
        <p className="mono-label flex items-center gap-2 text-[#4F46E5]">
          <span className="h-px w-6 bg-[#4F46E5]" />
          {t('libraryWorkspace')} · <span className="tabular-nums"><CountUp value={counts.all} /></span> {t('indexedResolutions')}
        </p>
        <h2 className="display mt-2 text-[28px] font-bold leading-tight text-[#1E293B]">{t('libraryTitle')}</h2>
        <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-[#64748B]">{t('libraryIntro')}</p>
      </header>

      {/* search + filters */}
      <div className="sheet space-y-3 p-3.5">
        <div className="flex items-center gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-[#E6E4DD] bg-[rgba(255,255,255,0.88)] px-3 py-2 transition-all focus-within:border-[#4F46E5] focus-within:[box-shadow:0_0_0_1.5px_#4F46E5,0_4px_16px_-2px_rgba(79,70,229,.15)]" style={{ boxShadow: '0 1px 2px rgba(15,23,42,.04)' }}>
            <Search className="h-4 w-4 shrink-0 text-[#64748B]" />
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onSelect={(e) => {
                searchSelection.current = {
                  start: e.target.selectionStart,
                  end: e.target.selectionEnd,
                };
              }}
              placeholder={t('librarySearch')}
              aria-label={t('searchLibrary')}
              className="gu-text min-w-0 flex-1 bg-transparent text-[13.5px] text-[#1E293B] outline-none placeholder:text-[#64748B]/70"
            />
            {q && (
              <button type="button" onClick={() => setQ('')} aria-label="Clear search" className="rounded p-0.5 text-[#64748B] hover:text-[#1E293B]">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="well flex p-0.5" role="group" aria-label={t('language')}>
              {LANG_FILTERS.map((f) => (
                <Seg
                  key={f.id}
                  on={lang === f.id}
                  onClick={() => {
                    setLang(f.id);
                    setKeyboardOpen(f.id === 'gu' ? (open) => !open : false);
                  }}
                  gu={f.id === 'gu'}
                  aria-expanded={f.id === 'gu' ? keyboardOpen : undefined}
                  aria-haspopup={f.id === 'gu' ? 'dialog' : undefined}
                  aria-controls={f.id === 'gu' ? 'library-gujarati-keyboard-dialog' : undefined}
                >
                  {f.labelKey ? t(f.labelKey) : f.label}
                </Seg>
              ))}
            </div>
            <div className="well flex p-0.5" role="group" aria-label={t('status')}>
              {STATUS_FILTERS.map((f) => (
                <Seg key={f.id} on={status === f.id} onClick={() => setStatus(f.id)}>
                  {t(f.labelKey)} <span className="font-mono text-[10px] opacity-60">{counts[f.id]}</span>
                </Seg>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
          {depts.length > 1 && (
            <label className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[#64748B]">
              <span className="sr-only">{t('department')}</span>
              <select value={dept} onChange={(e) => setDept(e.target.value)} aria-label={t('filterDepartment')} className="max-w-[11rem] truncate rounded-lg border border-[#E6E4DD] bg-[rgba(255,255,255,0.88)] px-2 py-1.5 text-[11.5px] font-semibold text-[#64748B] outline-none hover:text-[#1E293B]">
                <option value="all">{t('allDepartments')}</option>
                {depts.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
          )}
          <button
            type="button"
            onClick={() => setSortOrder((o) => (o === 'newest' ? 'oldest' : 'newest'))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E6E4DD] bg-[rgba(255,255,255,0.88)] px-2.5 py-1.5 text-[11.5px] font-semibold text-[#64748B] hover:text-[#1E293B]"
            style={{ boxShadow: '0 1px 2px rgba(15,23,42,.04)' }}
          >
            <ArrowUpDown className="h-3 w-3" /> {t(sortOrder === 'newest' ? 'newestFirst' : 'oldestFirst')}
          </button>
          </div>
        </div>
      </div>

      {selectedId && chain.length > 1 && <LineageGraph chain={chain} asOf={asOf} onAsOf={onAsOf} activeId={selectedId} onSelectNode={openNode} compact />}

      {/* register */}
      <div className="sheet flex min-h-[16rem] flex-1 flex-col overflow-hidden">
        <div className="mono-label hidden grid-cols-[minmax(0,1fr)_7.5rem_8.5rem] gap-3 border-b border-[#E6E4DD] bg-[#F1EFEA]/80 px-4 py-2 text-[9px] text-[#64748B] md:grid">
          <span>{t('subjectNumber')}</span>
          <span>{t('issued')}</span>
          <span className="text-right">{t('status')}</span>
        </div>

        {!rows && !error && (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-[#64748B]">
            <Loader2 className="h-4 w-4 animate-spin text-[#4F46E5]" /> {t('loadingResolutions')}
          </div>
        )}
        {error && <div className="border-b border-[#FECDD3] bg-[#FFF1F2] p-4 text-sm text-[#9F1239]">{t('couldNotRetrieveIndex')}: {error}</div>}

        {rows && (
          <div className="flex-1 overflow-y-auto">
            <ul className="ledger" aria-label="Resolutions">
              {shown.slice(0, MAX_ROWS).map((r, i) => {
                const s = STATUS[r.status] || UNKNOWN;
                const tone = TONES[s.tone] || TONES.slate;
                const on = r.gr_id === selectedId;
                return (
                  <motion.li key={r.gr_id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 16) * 0.012 }}>
                    <button
                      type="button"
                      onClick={() => open(r)}
                      aria-pressed={on}
                      className={`group relative grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 text-left transition-colors md:grid-cols-[minmax(0,1fr)_7.5rem_8.5rem] ${on ? 'bg-[#EEF2FF]' : 'hover:bg-[#F1EFEA]/70'}`}
                    >
                      <span aria-hidden className={`absolute inset-y-0 left-0 w-[3px] origin-top transition-transform duration-300 ${on ? 'scale-y-100 bg-[#4F46E5]' : 'scale-y-0 bg-[#4F46E5]/70 group-hover:scale-y-100'}`} />
                      <span className="min-w-0">
                        <span className="gu-text block truncate text-[13.5px] font-semibold text-[#1E293B]">{pickSubject(r, uiLang) || displayNumber(r)}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 font-mono text-[11px] text-[#64748B]">
                          <span className="gu-text font-bold text-[#1E293B]">{displayNumber(r)}</span>
                          <span className="hidden truncate sm:inline">{r.department || t('generalAdministration')}</span>
                          <span className="rounded border border-[#E6E4DD] bg-[#F1EFEA] px-1.5 font-semibold text-[#64748B]">{r.language === 'gu' ? 'ગુજ' : r.language === 'en' ? 'EN' : r.language}</span>
                        </span>
                      </span>
                      <span className="hidden font-mono text-[11.5px] tabular-nums text-[#64748B] md:block">{r.issue_date || t('undated')}</span>
                      <span className="flex justify-end">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-[10.5px] font-bold ${tone.ring} ${tone.pill} ${tone.text}`}>
                          <Seal status={s.key} size={20} />
                          {s.key === 'no_change' ? t('noLaterChange') : s.key === 'insufficient' && s.label === UNKNOWN.label ? t('statusUnknown') : t(s.key)}
                        </span>
                      </span>
                    </button>
                  </motion.li>
                );
              })}
              {shown.length === 0 && <li className="p-10 text-center text-sm text-[#64748B]">{t('matchingResolutionEmpty')}</li>}
            </ul>
          </div>
        )}
      </div>

      <p className="px-1 text-[11.5px] text-[#64748B]">{t('statusDerivedExplicit')}</p>
      {keyboardPopup}
    </div>
  );
}
