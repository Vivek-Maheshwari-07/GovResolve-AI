import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw, ExternalLink,
  ClipboardCheck, Flag, FileText, ScanText, FileSearch, AlertCircle, Check, Sparkles,
} from 'lucide-react';
import { pdfUrl, pageBlocks } from '../api';
import { courtCitation, reportText } from '../lib/lineage';

// Bundled worker for offline resilience
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();

function MetaField({ label, children, mono }) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow text-mist">{label}</dt>
      <dd className={`truncate text-[12.5px] font-semibold text-legal ${mono ? 'font-mono' : 'gu-text'}`}>
        {children || '—'}
      </dd>
    </div>
  );
}

function ToolbarBtn({ onClick, title, active, disabled, children, href }) {
  const cls = `grid h-8 w-8 place-items-center rounded-xl border text-mist transition shadow-sm ${
    active
      ? 'border-iris-400 bg-iris-50 text-iris-800 ring-1 ring-iris-200'
      : 'border-hair bg-white hover:text-legal hover:border-iris-300 active:scale-95'
  } disabled:opacity-35 disabled:cursor-not-allowed`;

  return href ? (
    <a href={href} target="_blank" rel="noreferrer" title={title} aria-label={title} className={cls}>
      {children}
    </a>
  ) : (
    <button type="button" onClick={onClick} title={title} aria-label={title} aria-pressed={active} disabled={disabled} className={cls}>
      {children}
    </button>
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
      <div className="relative grid h-full place-items-center overflow-hidden rounded-2xl border border-hair bg-white p-8 text-center shadow-card">
                <div className="relative max-w-sm space-y-4">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-saffron-400 to-saffron-600 text-white shadow-[0_8px_20px_-6px_rgba(217,119,6,0.5)]">
            <FileSearch className="h-7 w-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-legal">Evidence & Document Inspector</h3>
            <p className="mt-1 text-xs leading-relaxed text-mist">
              The official Government Resolution will display here, automatically navigating to the cited page with the exact bounding box illuminated.
            </p>
          </div>
          <ol className="space-y-2 text-left pt-2">
            {[
              ['1', 'Submit an administrative inquiry in English, Gujarati or Gujlish', 'bg-indigo-100 text-indigo-700'],
              ['2', 'Click any verified statement or verbatim legal quote chip', 'bg-amber-100 text-amber-800'],
              ['3', 'Inspect the highlighted clause on the scanned official gazette', 'bg-iris-100 text-iris-700'],
              ['4', 'Explore prior & succeeding orders in the Amendment Lineage', 'bg-iris-100 text-iris-700'],
            ].map(([n, t, c]) => (
              <li key={n} className="flex items-center gap-2.5 rounded-xl border border-hair bg-white/80 px-3 py-2 text-xs text-legal shadow-sm">
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md font-mono text-[10px] font-bold ${c}`}>{n}</span>
                <span>{t}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card flex h-full min-h-0 flex-col overflow-hidden rounded-2xl shadow-lift">
      {/* Document Header Metadata */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={grId}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ type: 'spring', stiffness: 360, damping: 30 }}
          className="border-b border-hair p-3.5 bg-white/60"
        >
          <div className="mb-2 flex items-start justify-between gap-3">
            <h3 className="gu-text line-clamp-2 text-[13.5px] font-semibold leading-snug text-legal">
              {citation.subject || citation.gr_number}
            </h3>
            <span className="shrink-0 rounded-md border border-hair bg-sand px-2 py-0.5 font-mono text-[10.5px] font-medium text-mist">
              {citation.language === 'gu' ? 'ગુજરાતી' : citation.language === 'en' ? 'English' : citation.language || 'Official GR'}
            </span>
          </div>

          <dl className="grid grid-cols-3 gap-3 pt-1 border-t border-hair/60">
            <MetaField label="GR Number" mono>{citation.gr_number}</MetaField>
            <MetaField label="Issue Date" mono>{citation.issue_date}</MetaField>
            <MetaField label="Department">{citation.department}</MetaField>
          </dl>
        </motion.div>
      </AnimatePresence>

      {/* Cited Passage Banner */}
      {citation.passage && (
        <div className="border-b border-hair border-l-4 !border-l-amber-500 bg-amber-50/80 px-3.5 py-2.5">
          <div className="flex items-center justify-between mb-1">
            <p className="eyebrow text-amber-900">
              Verified Quoted Passage · Page {citation.page}
            </p>
            <span className="font-mono text-[10px] text-amber-800">Verbatim Match</span>
          </div>
          <p className="legal-text line-clamp-4 text-[12.5px] text-legal">“{citation.passage}”</p>
        </div>
      )}

      {/* Document Controls Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-hair bg-sand/40 px-3 py-2">
        <ToolbarBtn title="Previous page" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          <ChevronLeft className="h-4 w-4" />
        </ToolbarBtn>
        <span className="min-w-[3.8rem] text-center font-mono text-[11px] font-semibold text-legal">
          {page} / {numPages || '–'}
        </span>
        <ToolbarBtn title="Next page" disabled={!numPages || page >= numPages} onClick={() => setPage((p) => Math.min(numPages, p + 1))}>
          <ChevronRight className="h-4 w-4" />
        </ToolbarBtn>

        <span className="mx-1 h-4 w-px bg-hair" />

        <ToolbarBtn title="Zoom out" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))}>
          <ZoomOut className="h-4 w-4" />
        </ToolbarBtn>
        <button
          type="button"
          onClick={() => setZoom(1)}
          title="Reset zoom to 100%"
          className="rounded-lg border border-hair bg-white px-2 py-1 font-mono text-[10.5px] font-semibold text-mist hover:text-legal shadow-sm"
        >
          {Math.round(zoom * 100)}%
        </button>
        <ToolbarBtn title="Zoom in" onClick={() => setZoom((z) => Math.min(2.4, +(z + 0.15).toFixed(2)))}>
          <ZoomIn className="h-4 w-4" />
        </ToolbarBtn>

        <span className="mx-1 h-4 w-px bg-hair" />

        <ToolbarBtn
          title={mode === 'pdf' ? 'Switch to raw OCR text view' : 'Switch to scanned PDF view'}
          active={mode === 'text'}
          onClick={() => setMode((m) => (m === 'pdf' ? 'text' : 'pdf'))}
        >
          {mode === 'pdf' ? <ScanText className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
        </ToolbarBtn>

        <div className="ml-auto flex items-center gap-1.5">
          <AnimatePresence>
            {note && (
              <motion.span
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="mr-1 inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-emerald-800"
              >
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span>{note}</span>
              </motion.span>
            )}
          </AnimatePresence>

          <ToolbarBtn title="Copy court-ready citation" onClick={() => copy(courtCitation(citation), 'Court citation copied')}>
            <ClipboardCheck className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn title="Report wrong citation to engineers" onClick={() => copy(reportText(citation, question), 'Audit report copied')}>
            <Flag className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn title="Open raw PDF in new browser tab" href={pdfUrl(grId)}>
            <ExternalLink className="h-4 w-4" />
          </ToolbarBtn>
        </div>
      </div>

      {/* Viewer Canvas / OCR Area */}
      <div ref={wrapRef} className="relative min-h-0 flex-1 overflow-auto bg-[#E8E6DF] p-3">
        {loading && mode === 'pdf' && (
          <div className="skeleton h-80 animate-shimmer rounded-xl shadow-sm" aria-label="Loading document gazette" />
        )}

        {error && mode === 'pdf' && (
          <div className="mx-auto mt-8 max-w-sm space-y-2.5 rounded-2xl border border-amber-200 bg-white p-5 text-center shadow-card">
            <AlertCircle className="mx-auto h-7 w-7 text-amber-600" />
            <p className="text-xs leading-relaxed text-mist">{error}</p>
          </div>
        )}

        {mode === 'pdf' && !error && (
          <div
            className="relative mx-auto w-max rounded-lg shadow-[0_12px_36px_-10px_rgba(15,23,42,0.25)]"
            style={{ display: doc ? 'block' : 'none' }}
          >
            <canvas ref={canvasRef} className="block rounded-lg bg-white" />

            <AnimatePresence>
              {showBox && (
                <motion.div
                  key={`${grId}|${page}|${citation.passage}`}
                  ref={boxRef}
                  data-testid="citation-box"
                  title="Verified paragraph containing quoted sentence"
                  initial={{ opacity: 0, scaleY: 0.6 }}
                  animate={{ opacity: 1, scaleY: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.15 }}
                  className="pointer-events-none absolute origin-top rounded-[3px]"
                  style={{
                    left: `${(citation.bbox[0] / dims.w) * 100}%`,
                    top: `${(citation.bbox[1] / dims.h) * 100}%`,
                    width: `${((citation.bbox[2] - citation.bbox[0]) / dims.w) * 100}%`,
                    height: `${((citation.bbox[3] - citation.bbox[1]) / dims.h) * 100}%`,
                    background: 'rgba(245, 158, 11, 0.24)',
                    borderLeft: '3px solid #D97706',
                    boxShadow: '0 0 0 1px rgba(217,119,6,0.3), 0 4px 18px -4px rgba(217,119,6,0.4)',
                  }}
                />
              )}
            </AnimatePresence>
          </div>
        )}

        {mode === 'text' && (
          <div className="mx-auto max-w-prose space-y-2.5 py-2">
            <div className="flex items-center justify-between pb-1 border-b border-hair">
              <p className="eyebrow text-mist">
                Raw OCR Text · Page {page}
              </p>
              <span className="font-mono text-[10px] text-mist">{blocks.length} text blocks</span>
            </div>

            {blocks.length === 0 && (
              <p className="text-xs text-mist py-4 text-center">No OCR blocks found for this page.</p>
            )}

            {blocks.map((b) => {
              const hit = quote && norm(b.text).includes(quote);
              return (
                <p
                  key={b.id}
                  className={`legal-text rounded-xl p-3 text-[12.5px] leading-relaxed transition-colors ${
                    hit
                      ? 'border-l-4 border-amber-500 bg-amber-50/90 text-legal font-medium shadow-sm'
                      : 'border border-hair bg-white text-mist'
                  }`}
                >
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
