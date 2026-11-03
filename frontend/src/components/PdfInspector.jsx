import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, ExternalLink,
  ClipboardCheck, Flag, ScanLine, AlignLeft, Check, FileX2,
} from 'lucide-react';
import { pdfUrl, pageBlocks } from '../api';
import { courtCitation, reportText } from '../lib/lineage';

// Bundled worker for offline resilience
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();

function MetaField({ label, children, mono }) {
  return (
    <div className="min-w-0">
      <dt className="mono-label text-[9px] text-faint">{label}</dt>
      <dd className={`mt-0.5 truncate text-[12.5px] font-semibold text-ink ${mono ? 'font-mono' : 'gu-text'}`}>{children || '—'}</dd>
    </div>
  );
}

const KEYCAP = { boxShadow: '0 0 0 1px rgba(30,41,59,.12), 0 1.5px 0 0 rgba(30,41,59,.1), inset 0 1px 0 #fff' };

function ToolbarBtn({ onClick, title, active, disabled, children, href }) {
  const cls = `grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-b from-white to-[#F3F1EB] text-mist transition active:translate-y-px hover:text-iris-700 disabled:cursor-not-allowed disabled:opacity-35 ${active ? '!from-iris-50 !to-iris-100 !text-iris-800' : ''}`;
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" title={title} aria-label={title} className={cls} style={KEYCAP}>
      {children}
    </a>
  ) : (
    <button type="button" onClick={onClick} title={title} aria-label={title} aria-pressed={active} disabled={disabled} className={cls} style={KEYCAP}>
      {children}
    </button>
  );
}

function Bracket({ pos, delay }) {
  // four corner brackets that converge onto the locked paragraph
  const base = { top: pos.includes('t'), left: pos.includes('l') };
  const from = { x: base.left ? -10 : 10, y: base.top ? -10 : 10 };
  return (
    <motion.span
      aria-hidden
      className="absolute h-3 w-3"
      style={{
        [base.top ? 'top' : 'bottom']: -4,
        [base.left ? 'left' : 'right']: -4,
        [base.top ? 'borderTop' : 'borderBottom']: '2.5px solid #B45309',
        [base.left ? 'borderLeft' : 'borderRight']: '2.5px solid #B45309',
      }}
      initial={{ opacity: 0, ...from }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22, delay }}
    />
  );
}

export default function PdfInspector({ citation, question }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const boxRef = useRef(null);
  const [width, setWidth] = useState(560);
  const [doc, setDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [dims, setDims] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('pdf'); // 'pdf' | 'text'
  const [blocks, setBlocks] = useState([]);
  const [note, setNote] = useState('');

  const grId = citation?.gr_id;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [grId]);

  // Load the PDF
  useEffect(() => {
    if (!grId) return undefined;
    let alive = true;
    setDoc(null);
    setError(null);
    setLoading(true);
    setDims(null);
    const task = pdfjsLib.getDocument(pdfUrl(grId));
    task.promise
      .then((d) => {
        if (alive) {
          setDoc(d);
          setNumPages(d.numPages);
          setLoading(false);
        }
      })
      .catch(() => {
        if (alive) {
          setError('The original PDF document is not cached locally. The verified OCR quote is displayed below.');
          setLoading(false);
        }
      });
    return () => {
      alive = false;
      task.destroy();
    };
  }, [grId]);

  // Jump to cited page
  useEffect(() => {
    if (citation) {
      setPage(citation.page || 1);
      setMode('pdf');
    }
  }, [grId, citation?.page, citation?.passage]);

  // Render canvas page
  useEffect(() => {
    if (!doc || mode !== 'pdf' || !canvasRef.current) return undefined;
    let task;
    let alive = true;
    doc.getPage(Math.min(Math.max(page, 1), doc.numPages)).then((p) => {
      if (!alive) return;
      const unit = p.getViewport({ scale: 1 });
      const scale = Math.max(0.4, ((width - 32) / unit.width) * zoom);
      const vp = p.getViewport({ scale });
      const dpr = window.devicePixelRatio || 1;
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = Math.floor(vp.width * dpr);
      canvas.height = Math.floor(vp.height * dpr);
      canvas.style.width = `${vp.width}px`;
      canvas.style.height = `${vp.height}px`;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      task = p.render({ canvasContext: ctx, viewport: vp });
      task.promise
        .then(() => {
          if (alive) setDims({ w: unit.width, h: unit.height, cssW: vp.width, cssH: vp.height });
        })
        .catch(() => {});
    });
    return () => {
      alive = false;
      task?.cancel();
    };
  }, [doc, page, zoom, width, mode]);

  const showBox = !!(citation?.bbox && dims && page === citation.page && mode === 'pdf');

  useEffect(() => {
    if (showBox) {
      boxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [showBox, grId, citation?.passage, dims?.cssW]);

  // Load OCR blocks for text mode
  useEffect(() => {
    if (mode !== 'text' || !grId) return undefined;
    let alive = true;
    pageBlocks(grId, page)
      .then((b) => {
        if (alive) setBlocks(b);
      })
      .catch(() => {
        if (alive) setBlocks([]);
      });
    return () => {
      alive = false;
    };
  }, [mode, grId, page]);

  const quote = useMemo(() => norm(citation?.passage).slice(0, 60), [citation?.passage]);

  const flash = (msg) => {
    setNote(msg);
    setTimeout(() => setNote(''), 2400);
  };

  const copy = async (text, msg) => {
    try {
      await navigator.clipboard.writeText(text);
      flash(msg);
    } catch {
      flash('Clipboard action not permitted');
    }
  };

  if (!citation) {
    return (
      <div className="sheet relative grid h-full place-items-center overflow-hidden p-8 text-center">
        <div aria-hidden className="dotgrid absolute inset-0 opacity-60" />
        <div className="relative max-w-sm">
          {/* scanner reticle over a stack of pages */}
          <div className="relative mx-auto h-36 w-28 animate-floatY">
            <span aria-hidden className="absolute inset-0 translate-x-2 -rotate-6 rounded-md bg-ivory" style={{ boxShadow: '0 0 0 1px rgba(30,41,59,.1)' }} />
            <span aria-hidden className="absolute inset-0 rotate-3 rounded-md bg-ivory" style={{ boxShadow: '0 0 0 1px rgba(30,41,59,.1), 0 10px 20px -10px rgba(30,41,59,.25)' }} />
            <div className="absolute inset-0 space-y-2 rounded-md bg-ivory p-3.5" style={{ boxShadow: '0 0 0 1px rgba(30,41,59,.12), 0 18px 30px -14px rgba(30,41,59,.3)' }}>
              {[70, 100, 88, 100, 54].map((w, i) => (
                <span key={i} className="block h-1.5 rounded-full bg-stone" style={{ width: `${w}%` }} />
              ))}
              <span className="block h-5 rounded-sm bg-[#FFF1CC]" style={{ boxShadow: '0 0 0 1.5px #D98A1F' }} />
              <span className="block h-1.5 w-3/5 rounded-full bg-stone" />
            </div>
            <span aria-hidden className="pointer-events-none absolute -inset-2 overflow-hidden rounded-lg">
              <span className="absolute inset-x-0 h-8 animate-sweep bg-gradient-to-b from-transparent via-iris-500/25 to-transparent [animation-iteration-count:infinite] [animation-duration:2.6s]" />
            </span>
          </div>
          <h3 className="display mt-7 text-[18px] font-bold text-ink">Evidence inspector</h3>
          <p className="mt-2 text-[13px] leading-relaxed text-mist">
            Choose a citation and the source page opens here with the exact paragraph locked in an amber frame.
          </p>
          <p className="mt-4 flex items-center justify-center gap-2 text-[11.5px] text-faint">
            <kbd className="kbd">[</kbd><kbd className="kbd">]</kbd> step through citations
          </p>
        </div>
      </div>
    );
  }

  const labelInside = showBox && (citation.bbox[1] / dims.h) * dims.cssH < 26;

  return (
    <div className="sheet flex h-full min-h-0 flex-col overflow-hidden">
      {/* Specimen header */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={grId} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 360, damping: 30 }} className="border-b border-hair px-4 pb-3 pt-3.5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="gu-text line-clamp-2 text-[14px] font-semibold leading-snug text-ink">{citation.subject || citation.gr_number}</h3>
            <span className="mono-label shrink-0 rounded bg-sand px-1.5 py-0.5 text-[9px] text-mist">
              {citation.language === 'gu' ? 'ગુજરાતી' : citation.language === 'en' ? 'English' : citation.language || 'Official GR'}
            </span>
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-3">
            <MetaField label="GR No." mono>{citation.gr_number}</MetaField>
            <MetaField label="Issued" mono>{citation.issue_date}</MetaField>
            <MetaField label="Department">{citation.department}</MetaField>
          </dl>
        </motion.div>
      </AnimatePresence>

      {/* Verbatim lock strip */}
      {citation.passage && (
        <div className="relative border-b border-[#F1D6A0] bg-gradient-to-r from-[#FFF3D6] to-[#FFF9EA] py-2.5 pl-4 pr-3.5">
          <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-[#D98A1F]" />
          <div className="mb-1 flex items-center justify-between">
            <p className="mono-label flex items-center gap-1.5 text-[9.5px] text-[#8A4B0B]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#D98A1F]" /> Verbatim lock · page {citation.page}
            </p>
            <span className="mono-label text-[9px] text-[#B45309]">exact text match</span>
          </div>
          <p className="legal-text line-clamp-3 text-[12.5px] text-ink">“{citation.passage}”</p>
        </div>
      )}

      {/* Instrument toolbar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-hair bg-canvas/70 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <ToolbarBtn title="Previous page" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft className="h-4 w-4" /></ToolbarBtn>
          <span className="min-w-[3.6rem] text-center font-mono text-[11.5px] font-bold tabular-nums text-ink">{page} / {numPages || '–'}</span>
          <ToolbarBtn title="Next page" disabled={!numPages || page >= numPages} onClick={() => setPage((p) => Math.min(numPages, p + 1))}><ChevronRight className="h-4 w-4" /></ToolbarBtn>
        </div>

        <div className="flex items-center gap-1.5">
          <ToolbarBtn title="Zoom out" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))}><ZoomOut className="h-4 w-4" /></ToolbarBtn>
          <button type="button" onClick={() => setZoom(1)} title="Reset zoom to 100%" className="min-w-[3.1rem] rounded-lg bg-ivory px-2 py-1.5 font-mono text-[10.5px] font-bold tabular-nums text-mist hover:text-ink" style={KEYCAP}>
            {Math.round(zoom * 100)}%
          </button>
          <ToolbarBtn title="Zoom in" onClick={() => setZoom((z) => Math.min(2.4, +(z + 0.15).toFixed(2)))}><ZoomIn className="h-4 w-4" /></ToolbarBtn>
        </div>

        <div className="well flex p-0.5" role="group" aria-label="View">
          {[['pdf', 'Scan', ScanLine, 'Scanned PDF view'], ['text', 'Text', AlignLeft, 'Raw OCR text view']].map(([k, label, Icon, title]) => (
            <button key={k} type="button" title={title} aria-pressed={mode === k} onClick={() => setMode(k)} className={`inline-flex items-center gap-1.5 rounded-[9px] px-2.5 py-1 text-[11.5px] font-semibold transition ${mode === k ? 'bg-ivory text-iris-800 shadow-card' : 'text-mist hover:text-ink'}`}>
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <AnimatePresence>
            {note && (
              <motion.span initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="mr-1 inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#2F5D4E]">
                <Check className="h-3.5 w-3.5" /> {note}
              </motion.span>
            )}
          </AnimatePresence>
          <ToolbarBtn title="Copy court-ready citation" onClick={() => copy(courtCitation(citation), 'Court citation copied')}><ClipboardCheck className="h-4 w-4" /></ToolbarBtn>
          <ToolbarBtn title="Report wrong citation to engineers" onClick={() => copy(reportText(citation, question), 'Audit report copied')}><Flag className="h-4 w-4" /></ToolbarBtn>
          <ToolbarBtn title="Open raw PDF in new browser tab" href={pdfUrl(grId)}><ExternalLink className="h-4 w-4" /></ToolbarBtn>
        </div>
      </div>

      {/* Scanner tray */}
      <div ref={wrapRef} className="dotgrid relative min-h-0 flex-1 overflow-auto p-5" style={{ boxShadow: 'inset 0 6px 12px -8px rgba(30,41,59,.25)' }}>
        {loading && mode === 'pdf' && <div className="skeleton mx-auto h-80 max-w-md animate-shimmer rounded-lg" aria-label="Loading document" />}

        {error && mode === 'pdf' && (
          <div className="sheet mx-auto mt-6 max-w-sm space-y-3 p-6 text-center">
            <FileX2 className="mx-auto h-7 w-7 text-[#B45309]" />
            <p className="display text-[15px] font-bold text-ink">Source scan unavailable</p>
            <p className="text-[12.5px] leading-relaxed text-mist">{error}</p>
            <button type="button" onClick={() => setMode('text')} className="btn-primary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white">
              <AlignLeft className="h-3.5 w-3.5" /> Read the OCR text
            </button>
          </div>
        )}

        {mode === 'pdf' && !error && (
          <div className="relative mx-auto w-max" style={{ display: doc ? 'block' : 'none' }}>
            {/* crop marks */}
            {['-left-3 -top-3 border-l border-t', '-right-3 -top-3 border-r border-t', '-bottom-3 -left-3 border-b border-l', '-bottom-3 -right-3 border-b border-r'].map((c) => (
              <span key={c} aria-hidden className={`absolute h-3 w-3 border-rule ${c}`} style={{ borderColor: '#9A9484' }} />
            ))}
            <div className="relative overflow-hidden rounded-[3px]" style={{ boxShadow: '0 1px 2px rgba(30,41,59,.15), 0 22px 44px -14px rgba(30,41,59,.38)' }}>
              <canvas ref={canvasRef} className="block bg-white" />

              {/* scan sweep once per page render */}
              {dims && <div key={`sweep-${grId}-${page}-${mode}`} aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-full"><div className="h-14 animate-sweep bg-gradient-to-b from-transparent via-iris-500/20 to-transparent" style={{ height: '18%' }} /></div>}

              <AnimatePresence>
                {showBox && (
                  <motion.div
                    key={`${grId}|${page}|${citation.passage}`}
                    ref={boxRef}
                    data-testid="citation-box"
                    title="Verified paragraph containing quoted sentence"
                    initial={{ opacity: 0, scale: 1.06 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 24, delay: 0.5 }}
                    className="pointer-events-none absolute rounded-[3px]"
                    style={{
                      left: `${(citation.bbox[0] / dims.w) * 100}%`,
                      top: `${(citation.bbox[1] / dims.h) * 100}%`,
                      width: `${((citation.bbox[2] - citation.bbox[0]) / dims.w) * 100}%`,
                      height: `${((citation.bbox[3] - citation.bbox[1]) / dims.h) * 100}%`,
                      background: 'rgba(245, 184, 61, 0.22)',
                      boxShadow: '0 0 0 1.5px #D97706, 0 0 0 9999px rgba(30,41,59,0.10), 0 0 24px 2px rgba(217,119,6,0.35)',
                      mixBlendMode: 'multiply',
                    }}
                  >
                    <Bracket pos="tl" delay={0.55} />
                    <Bracket pos="tr" delay={0.6} />
                    <Bracket pos="bl" delay={0.65} />
                    <Bracket pos="br" delay={0.7} />
                    <span className={`mono-label absolute right-0 whitespace-nowrap rounded-sm bg-[#B45309] px-1.5 py-0.5 text-[8.5px] text-white ${labelInside ? 'top-0' : '-top-[18px]'}`} style={{ mixBlendMode: 'normal' }}>
                      Verbatim lock · p.{citation.page}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {mode === 'text' && (
          <div className="mx-auto max-w-prose space-y-2.5 py-1">
            <div className="flex items-center justify-between border-b border-rule pb-1.5">
              <p className="mono-label text-[9.5px] text-mist">Raw OCR text · page {page}</p>
              <span className="mono-label text-[9px] text-faint">{blocks.length} blocks</span>
            </div>
            {blocks.length === 0 && <p className="py-4 text-center text-xs text-mist">No OCR blocks found for this page.</p>}
            {blocks.map((b) => {
              const hit = quote && norm(b.text).includes(quote);
              return (
                <p key={b.id} className={`legal-text rounded-xl p-3 text-[12.5px] leading-relaxed transition-colors ${hit ? 'bg-[#FFF3D6] font-medium text-ink' : 'bg-ivory text-mist'}`} style={{ boxShadow: hit ? '0 0 0 1.5px #D97706' : '0 0 0 1px rgba(30,41,59,.07)' }}>
                  {b.text}
                </p>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
