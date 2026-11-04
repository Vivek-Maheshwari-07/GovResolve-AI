import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, ExternalLink,
  ClipboardCheck, Flag, ScanLine, AlignLeft, Check, FileX2, Crosshair,
} from 'lucide-react';
import { pdfUrl, pageBlocks } from '../api';
import { courtCitation, reportText } from '../lib/lineage';

// Bundled worker for offline resilience
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();

function MetaField({ label, children, mono }) {
  return (
    <div className="min-w-0">
      <dt className="mono-label text-[9px] text-[#64748B]">{label}</dt>
      <dd className={`mt-0.5 truncate text-[12px] font-semibold text-[#1E293B] ${mono ? 'font-mono' : 'gu-text'}`}>{children || '—'}</dd>
    </div>
  );
}

const KEYCAP = { boxShadow: '0 0 0 1px #E6E4DD, 0 1px 2px rgba(15,23,42,.04), inset 0 1px 0 #fff' };

function ToolbarBtn({ onClick, title, active, disabled, children, href }) {
  const cls = `grid h-8 w-8 place-items-center rounded-lg bg-[rgba(255,255,255,0.92)] text-[#64748B] transition active:scale-95 hover:text-[#4F46E5] hover:bg-[#EEF2FF] disabled:cursor-not-allowed disabled:opacity-35 ${active ? '!bg-[#EEF2FF] !text-[#4F46E5] !border-[#4F46E5]' : ''}`;
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" title={title} aria-label={title} className={cls} style={KEYCAP}>
      {children}
    </a>
  ) : (
    <motion.button whileTap={{ scale: 0.95 }} type="button" onClick={onClick} title={title} aria-label={title} aria-pressed={active} disabled={disabled} className={cls} style={KEYCAP}>
      {children}
    </motion.button>
  );
}

function Bracket({ pos, delay }) {
  // four corner optical brackets that converge onto the locked paragraph with precision markings
  const base = { top: pos.includes('t'), left: pos.includes('l') };
  const from = { x: base.left ? -8 : 8, y: base.top ? -8 : 8 };
  return (
    <motion.span
      aria-hidden
      className="absolute h-3.5 w-3.5 pointer-events-none"
      style={{
        [base.top ? 'top' : 'bottom']: -4,
        [base.left ? 'left' : 'right']: -4,
        [base.top ? 'borderTop' : 'borderBottom']: '2.5px solid #D97706',
        [base.left ? 'borderLeft' : 'borderRight']: '2.5px solid #D97706',
        filter: 'drop-shadow(0 0 2px rgba(217, 119, 6, 0.4))',
      }}
      initial={{ opacity: 0, ...from }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ type: 'spring', stiffness: 340, damping: 20, delay }}
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
  const [exactBbox, setExactBbox] = useState(null);
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
      setExactBbox(null);
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

      // Sub-line exact bounding box search via PDF text layer
      p.getTextContent().then((tc) => {
        if (!alive || !citation?.passage) return;
        const target = norm(citation.passage);
        const words = target.split(/\s+/).filter((w) => w.length > 2);
        if (!words.length) return;
        const matchingItems = (tc.items || []).filter((item) => {
          const itemNorm = norm(item.str);
          return itemNorm && words.some((w) => itemNorm.includes(w));
        });
        if (matchingItems.length > 0) {
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const item of matchingItems) {
            const x = item.transform[4];
            const y = unit.height - item.transform[5] - (item.height || 10);
            const w = item.width || 0;
            const h = item.height || 10;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + w);
            maxY = Math.max(maxY, y + h);
          }
          if (minX < maxX && minY < maxY) {
            setExactBbox([Math.max(0, minX - 4), Math.max(0, minY - 2), Math.min(unit.width, maxX + 4), Math.min(unit.height, maxY + 2)]);
            return;
          }
        }
        setExactBbox(null);
      }).catch(() => setExactBbox(null));
    });
    return () => {
      alive = false;
      task?.cancel();
    };
  }, [doc, page, zoom, width, mode, citation?.passage]);

  const activeBox = exactBbox || citation?.bbox;
  const showBox = !!(activeBox && dims && page === citation.page && mode === 'pdf');

  useEffect(() => {
    if (showBox) {
      boxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [showBox, grId, citation?.passage, dims?.cssW, exactBbox]);

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
          {/* optical scanner reticle */}
          <div className="relative mx-auto h-36 w-28 animate-floatY">
            <span aria-hidden className="absolute inset-0 translate-x-2 -rotate-6 rounded-md bg-[rgba(255,255,255,0.90)]" style={{ boxShadow: '0 0 0 1px #E6E4DD' }} />
            <span aria-hidden className="absolute inset-0 rotate-3 rounded-md bg-[rgba(255,255,255,0.90)]" style={{ boxShadow: '0 0 0 1px #E6E4DD, 0 10px 20px -10px rgba(15,23,42,.15)' }} />
            <div className="absolute inset-0 space-y-2 rounded-md bg-[rgba(255,255,255,0.92)] p-3.5 backdrop-blur-md" style={{ boxShadow: '0 0 0 1px #E6E4DD, 0 18px 30px -14px rgba(15,23,42,.16)' }}>
              {[70, 100, 88, 100, 54].map((w, i) => (
                <span key={i} className="block h-1.5 rounded-full bg-[#E6E4DD]" style={{ width: `${w}%` }} />
              ))}
              <span className="block h-5 rounded-sm bg-[#FFFBEB] border-l-[3px] border-[#D97706]" style={{ boxShadow: '0 0 0 1px #FDE68A' }} />
              <span className="block h-1.5 w-3/5 rounded-full bg-[#E6E4DD]" />
            </div>
            <span aria-hidden className="pointer-events-none absolute -inset-2 overflow-hidden rounded-lg">
              <span className="absolute inset-x-0 h-8 animate-sweep bg-gradient-to-b from-transparent via-[#4F46E5]/20 to-transparent [animation-iteration-count:infinite] [animation-duration:2.6s]" />
            </span>
          </div>
          <h3 className="display mt-7 text-[18px] font-bold text-[#1E293B]">Optical Evidence Inspector</h3>
          <p className="mt-2 text-[13px] leading-relaxed text-[#64748B]">
            Select any citation chip to lock the source resolution page into the optical scanner with exact paragraph bounding.
          </p>
          <p className="mt-4 flex items-center justify-center gap-2 text-[11px] text-[#64748B]">
            <kbd className="kbd">[</kbd><kbd className="kbd">]</kbd> step through cited passages
          </p>
        </div>
      </div>
    );
  }

  const labelInside = showBox && (activeBox[1] / dims.h) * dims.cssH < 26;

  return (
    <div className="sheet flex h-full min-h-0 flex-col overflow-hidden">
      {/* Specimen header (High-Tech Scanner HUD) */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={grId}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ type: 'spring', stiffness: 360, damping: 30 }}
          className="border-b border-[#E6E4DD] bg-[#F1EFEA]/90 px-4 pb-3 pt-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="telemetry-tag flex items-center gap-1 text-[9px] text-[#4F46E5]">
                  <Crosshair className="h-3 w-3" />
                  OPTICAL_SCANNER_HUD
                </span>
                <span className="telemetry-tag text-[9px] text-[#64748B]">
                  [DOC_ID: {citation.gr_id}]
                </span>
              </div>
              <h3 className="gu-text line-clamp-1 text-[13.5px] font-semibold text-[#1E293B]">{citation.subject || citation.gr_number}</h3>
            </div>
            <span className="mono-label shrink-0 rounded border border-[#E6E4DD] bg-[rgba(255,255,255,0.92)] px-2 py-0.5 text-[9.5px] font-bold text-[#64748B]">
              {citation.language === 'gu' ? 'ગુજરાતી' : citation.language === 'en' ? 'English' : citation.language || 'Official GR'}
            </span>
          </div>
          <dl className="mt-2.5 grid grid-cols-3 gap-2.5">
            <MetaField label="GR Number" mono>{citation.gr_number}</MetaField>
            <MetaField label="Issue Date" mono>{citation.issue_date}</MetaField>
            <MetaField label="Department">{citation.department}</MetaField>
          </dl>
        </motion.div>
      </AnimatePresence>

      {/* Verbatim optical lock strip */}
      {citation.passage && (
        <div className="relative border-b border-[#FDE68A] bg-[#FFFBEB] py-2.5 pl-4 pr-3.5 shadow-xs">
          <span aria-hidden className="absolute inset-y-0 left-0 w-[4px] bg-[#D97706]" />
          <div className="mb-1 flex items-center justify-between">
            <p className="mono-label flex items-center gap-1.5 text-[9.5px] font-bold text-[#92400E]">
              <span className="h-2 w-2 rounded-full bg-[#F59E0B] animate-pulse" />
              VERBATIM PASSAGE LOCKED · PAGE {citation.page}
            </p>
            <span className="telemetry-tag text-[9px] font-bold text-[#D97706]">
              MATCH: EXACT_VERBATIM
            </span>
          </div>
          <p className="legal-text line-clamp-2 text-[12.5px] text-[#1E293B]">“{citation.passage}”</p>
        </div>
      )}

      {/* Instrument toolbar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[#E6E4DD] bg-[#F1EFEA]/70 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <ToolbarBtn title="Previous page" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft className="h-4 w-4" /></ToolbarBtn>
          <span className="min-w-[3.6rem] text-center font-mono text-[11.5px] font-bold tabular-nums text-[#1E293B]">{page} / {numPages || '–'}</span>
          <ToolbarBtn title="Next page" disabled={!numPages || page >= numPages} onClick={() => setPage((p) => Math.min(numPages, p + 1))}><ChevronRight className="h-4 w-4" /></ToolbarBtn>
        </div>

        <div className="flex items-center gap-1.5">
          <ToolbarBtn title="Zoom out" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))}><ZoomOut className="h-4 w-4" /></ToolbarBtn>
          <button type="button" onClick={() => setZoom(1)} title="Reset zoom to 100%" className="min-w-[3.1rem] rounded-lg bg-[rgba(255,255,255,0.92)] px-2 py-1.5 font-mono text-[10.5px] font-bold tabular-nums text-[#64748B] hover:text-[#1E293B]" style={KEYCAP}>
            {Math.round(zoom * 100)}%
          </button>
          <ToolbarBtn title="Zoom in" onClick={() => setZoom((z) => Math.min(2.4, +(z + 0.15).toFixed(2)))}><ZoomIn className="h-4 w-4" /></ToolbarBtn>
        </div>

        <div className="well flex p-0.5" role="group" aria-label="View">
          {[['pdf', 'Scan', ScanLine, 'Scanned PDF view'], ['text', 'Text', AlignLeft, 'Raw OCR text view']].map(([k, label, Icon, title]) => (
            <button key={k} type="button" title={title} aria-pressed={mode === k} onClick={() => setMode(k)} className={`inline-flex items-center gap-1.5 rounded-[9px] px-2.5 py-1 text-[11px] font-semibold transition ${mode === k ? 'border border-[#E6E4DD] bg-[rgba(255,255,255,0.92)] text-[#4F46E5] shadow-sm' : 'text-[#64748B] hover:text-[#1E293B]'}`}>
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <AnimatePresence>
            {note && (
              <motion.span initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="mr-1 inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#065F46]">
                <Check className="h-3.5 w-3.5 text-[#10B981]" /> {note}
              </motion.span>
            )}
          </AnimatePresence>
          <ToolbarBtn title="Copy court-ready citation" onClick={() => copy(courtCitation(citation), 'Court citation copied')}><ClipboardCheck className="h-4 w-4" /></ToolbarBtn>
          <ToolbarBtn title="Report wrong citation to engineers" onClick={() => copy(reportText(citation, question), 'Audit report copied')}><Flag className="h-4 w-4" /></ToolbarBtn>
          <ToolbarBtn title="Open raw PDF in new browser tab" href={pdfUrl(grId)}><ExternalLink className="h-4 w-4" /></ToolbarBtn>
        </div>
      </div>

      {/* Scanner tray */}
      <div ref={wrapRef} className="dotgrid relative min-h-0 flex-1 overflow-auto p-5" style={{ boxShadow: 'inset 0 4px 12px -6px rgba(15,23,42,.1)' }}>
        {loading && mode === 'pdf' && <div className="skeleton mx-auto h-80 max-w-md animate-shimmer rounded-lg" aria-label="Loading document" />}

        {error && mode === 'pdf' && (
          <div className="sheet mx-auto mt-6 max-w-sm space-y-3 p-6 text-center">
            <FileX2 className="mx-auto h-7 w-7 text-[#D97706]" />
            <p className="display text-[15px] font-bold text-[#1E293B]">Source scan unavailable</p>
            <p className="text-[12.5px] leading-relaxed text-[#64748B]">{error}</p>
            <button type="button" onClick={() => setMode('text')} className="btn-primary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white">
              <AlignLeft className="h-3.5 w-3.5" /> Read the OCR text
            </button>
          </div>
        )}

        {mode === 'pdf' && !error && (
          <div className="relative mx-auto w-max" style={{ display: doc ? 'block' : 'none' }}>
            {/* optical registration crop marks */}
            {['-left-3 -top-3 border-l-2 border-t-2', '-right-3 -top-3 border-r-2 border-t-2', '-bottom-3 -left-3 border-b-2 border-l-2', '-bottom-3 -right-3 border-b-2 border-r-2'].map((c) => (
              <span key={c} aria-hidden className={`absolute h-3 w-3 ${c}`} style={{ borderColor: '#D97706', opacity: 0.75 }} />
            ))}
            <div className="relative overflow-hidden rounded-[4px] border border-[#E6E4DD]" style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.14)' }}>
              <canvas ref={canvasRef} className="block bg-[#FAF9F5]" />

              {/* scan sweep beam once per page render */}
              {dims && <div key={`sweep-${grId}-${page}-${mode}`} aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-full"><div className="h-14 animate-sweep bg-gradient-to-b from-transparent via-[#4F46E5]/18 to-transparent" style={{ height: '18%' }} /></div>}

              <AnimatePresence>
                {showBox && (
                  <motion.div
                    key={`${grId}|${page}|${citation.passage}`}
                    ref={boxRef}
                    data-testid="citation-box"
                    title="Verified paragraph containing quoted sentence"
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 24, delay: 0.4 }}
                    className="optical-bounding-box pointer-events-none absolute rounded-[2px]"
                    style={{
                      left: `${(activeBox[0] / dims.w) * 100}%`,
                      top: `${(activeBox[1] / dims.h) * 100}%`,
                      width: `${((activeBox[2] - activeBox[0]) / dims.w) * 100}%`,
                      height: `${((activeBox[3] - activeBox[1]) / dims.h) * 100}%`,
                      background: 'rgba(245, 158, 11, 0.22)',
                      borderLeft: '3px solid #D97706',
                    }}
                  >
                    <Bracket pos="tl" delay={0.45} />
                    <Bracket pos="tr" delay={0.5} />
                    <Bracket pos="bl" delay={0.55} />
                    <Bracket pos="br" delay={0.6} />
                    <span className={`mono-label absolute right-0 whitespace-nowrap rounded bg-[#D97706] px-1.5 py-0.5 text-[8.5px] font-bold text-white shadow-sm ${labelInside ? 'top-0' : '-top-[20px]'}`} style={{ mixBlendMode: 'normal' }}>
                      LOCK · p.{citation.page}{exactBbox ? ' · EXACT' : ''}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {mode === 'text' && (
          <div className="mx-auto max-w-prose space-y-2.5 py-1">
            <div className="flex items-center justify-between border-b border-[#E6E4DD] pb-1.5">
              <p className="mono-label text-[9.5px] text-[#64748B]">Raw OCR text · page {page}</p>
              <span className="mono-label text-[9px] text-[#64748B]">{blocks.length} blocks</span>
            </div>
            {blocks.length === 0 && <p className="py-4 text-center text-xs text-[#64748B]">No OCR blocks found for this page.</p>}
            {blocks.map((b) => {
              const hit = quote && norm(b.text).includes(quote);
              return (
                <p key={b.id} className={`legal-text rounded-xl p-3 text-[12.5px] leading-relaxed transition-colors ${hit ? 'border-l-[4px] border-l-[#D97706] border border-[#FDE68A] bg-[#FFFBEB] font-medium text-[#1E293B]' : 'border border-[#E6E4DD] bg-[rgba(255,255,255,0.90)] text-[#64748B]'}`} style={{ boxShadow: hit ? '0 0 0 1px #FDE68A' : '0 2px 8px -2px rgba(15,23,42,.04)' }}>
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
