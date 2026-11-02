import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, ExternalLink, ClipboardCheck, Flag, FileText, ScanText, FileSearch, AlertCircle, Check,
} from 'lucide-react';
import { pdfUrl, pageBlocks } from '../api';
import { courtCitation, reportText } from '../lib/lineage';

// worker is bundled (no CDN), so the viewer works offline
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();

function Meta({ label, children, mono }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-[#8A94A6]">{label}</dt>
      <dd className={`truncate text-[12.5px] text-legal ${mono ? 'font-mono' : 'gu-text'}`}>{children || '—'}</dd>
    </div>
  );
}

function IconBtn({ onClick, title, active, disabled, children, href }) {
  const cls = `grid h-8 w-8 place-items-center rounded-lg border text-mist transition ${active ? 'border-[rgba(79,70,229,0.5)] bg-[rgba(79,70,229,0.18)] text-iris-700' : 'border-hair bg-sand/60 hover:text-legal'} disabled:opacity-35`;
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" title={title} aria-label={title} className={cls}>{children}</a>
  ) : (
    <button type="button" onClick={onClick} title={title} aria-label={title} aria-pressed={active} disabled={disabled} className={cls}>{children}</button>
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
  const [dims, setDims] = useState(null);          // page size in PDF points + rendered size in CSS px
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('pdf');         // 'pdf' | 'text'
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

  // load the PDF of the cited document
  useEffect(() => {
    if (!grId) return undefined;
    let alive = true;
    setDoc(null); setError(null); setLoading(true); setDims(null);
    const task = pdfjsLib.getDocument(pdfUrl(grId));
    task.promise
      .then((d) => { if (alive) { setDoc(d); setNumPages(d.numPages); setLoading(false); } })
      .catch(() => { if (alive) { setError('The original PDF is not available on this machine. The verified quote is shown instead.'); setLoading(false); } });
    return () => { alive = false; task.destroy(); };
  }, [grId]);

  // jump to the cited page whenever the citation changes
  useEffect(() => { if (citation) { setPage(citation.page || 1); setMode('pdf'); } }, [grId, citation?.page, citation?.passage]);

  // draw the page
  useEffect(() => {
    if (!doc || mode !== 'pdf' || !canvasRef.current) return undefined;
    let task;
    let alive = true;
    doc.getPage(Math.min(Math.max(page, 1), doc.numPages)).then((p) => {
      if (!alive) return;
      const unit = p.getViewport({ scale: 1 });
      const scale = Math.max(0.4, ((width - 24) / unit.width) * zoom);
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
      task.promise.then(() => { if (alive) setDims({ w: unit.width, h: unit.height, cssW: vp.width, cssH: vp.height }); }).catch(() => {});
    });
    return () => { alive = false; task?.cancel(); };
  }, [doc, page, zoom, width, mode]);

  const showBox = !!(citation?.bbox && dims && page === citation.page && mode === 'pdf');

  // bring the highlighted paragraph into view
  useEffect(() => {
    if (showBox) boxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [showBox, grId, citation?.passage, dims?.cssW]);

  // raw text of the page (the OCR text the answer was built from)
  useEffect(() => {
    if (mode !== 'text' || !grId) return undefined;
    let alive = true;
    pageBlocks(grId, page).then((b) => { if (alive) setBlocks(b); }).catch(() => { if (alive) setBlocks([]); });
    return () => { alive = false; };
  }, [mode, grId, page]);

  const quote = useMemo(() => norm(citation?.passage).slice(0, 60), [citation?.passage]);
  const flash = (msg) => { setNote(msg); setTimeout(() => setNote(''), 2200); };
  const copy = async (text, msg) => { try { await navigator.clipboard.writeText(text); flash(msg); } catch { flash('Copy blocked by the browser'); } };

  if (!citation) {
    return (
      <div className="glass grid h-full place-items-center rounded-2xl p-8 text-center">
        <div className="max-w-xs space-y-2">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-hair bg-sand/60 text-mist"><FileSearch className="h-5 w-5" /></div>
          <h3 className="text-sm font-semibold">Evidence inspector</h3>
          <p className="text-xs leading-relaxed text-mist">Ask a question, then click a citation chip or a document in the lineage. The original page opens here with the cited paragraph highlighted.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass flex h-full min-h-0 flex-col overflow-hidden rounded-2xl">
      {/* Document metadata */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={grId} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 360, damping: 30 }} className="border-b border-hair p-3.5">
          <div className="mb-2 flex items-start justify-between gap-3">
            <p className="gu-text line-clamp-2 text-[13px] font-medium leading-snug">{citation.subject || citation.gr_number}</p>
            <span className="shrink-0 rounded-md border border-hair bg-sand px-1.5 py-0.5 font-mono text-[10px] text-mist">{citation.language === 'gu' ? 'ગુજરાતી' : citation.language === 'en' ? 'English' : citation.language || '—'}</span>
          </div>
          <dl className="grid grid-cols-3 gap-3">
            <Meta label="GR number" mono>{citation.gr_number}</Meta>
            <Meta label="Issue date" mono>{citation.issue_date}</Meta>
            <Meta label="Department">{citation.department}</Meta>
          </dl>
        </motion.div>
      </AnimatePresence>

      {citation.passage && (
        <div className="border-b border-hair border-l-2 !border-l-[#D97706] bg-[#FFFBEB] px-3.5 py-2.5">
          <p className="mb-1 font-mono text-[9.5px] uppercase tracking-[0.14em] text-[#92400E]">Cited passage · page {citation.page}</p>
          <p className="legal-text line-clamp-4 text-[12.5px] text-legal">“{citation.passage}”</p>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-hair px-3 py-2">
        <IconBtn title="Previous page" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft className="h-4 w-4" /></IconBtn>
        <span className="min-w-[3.6rem] text-center font-mono text-[11px] text-mist">{page} / {numPages || '–'}</span>
        <IconBtn title="Next page" disabled={!numPages || page >= numPages} onClick={() => setPage((p) => Math.min(numPages, p + 1))}><ChevronRight className="h-4 w-4" /></IconBtn>
        <span className="mx-1 h-4 w-px bg-[#E6E4DD]" />
        <IconBtn title="Zoom out" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))}><ZoomOut className="h-4 w-4" /></IconBtn>
        <IconBtn title="Zoom in" onClick={() => setZoom((z) => Math.min(2.4, +(z + 0.15).toFixed(2)))}><ZoomIn className="h-4 w-4" /></IconBtn>
        <span className="mx-1 h-4 w-px bg-[#E6E4DD]" />
        <IconBtn title={mode === 'pdf' ? 'Show the raw OCR text of this page' : 'Show the original PDF'} active={mode === 'text'} onClick={() => setMode((m) => (m === 'pdf' ? 'text' : 'pdf'))}>
          {mode === 'pdf' ? <ScanText className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
        </IconBtn>
        <div className="ml-auto flex items-center gap-1.5">
          <AnimatePresence>{note && <motion.span initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="mr-1 inline-flex items-center gap-1 font-mono text-[10.5px] text-[#065F46]"><Check className="h-3 w-3" />{note}</motion.span>}</AnimatePresence>
          <IconBtn title="Copy a court-ready citation" onClick={() => copy(courtCitation(citation), 'Citation copied')}><ClipboardCheck className="h-4 w-4" /></IconBtn>
          <IconBtn title="Report a wrong citation (copies a report to send to the team)" onClick={() => copy(reportText(citation, question), 'Report copied')}><Flag className="h-4 w-4" /></IconBtn>
          <IconBtn title="Open the raw PDF in a new tab" href={pdfUrl(grId)}><ExternalLink className="h-4 w-4" /></IconBtn>
        </div>
      </div>

      {/* Page */}
      <div ref={wrapRef} className="relative min-h-0 flex-1 overflow-auto bg-[#EAE8E1] p-3">
        {loading && mode === 'pdf' && <div className="skeleton h-72 animate-shimmer rounded-xl" aria-label="Loading PDF" />}
        {error && mode === 'pdf' && (
          <div className="mx-auto mt-6 max-w-sm space-y-2 rounded-xl border border-hair bg-sand/60 p-4 text-center">
            <AlertCircle className="mx-auto h-6 w-6 text-[#92400E]" />
            <p className="text-xs leading-relaxed text-mist">{error}</p>
          </div>
        )}
        {mode === 'pdf' && !error && (
          <div className="relative mx-auto w-max rounded-md shadow-[0_8px_30px_-12px_rgba(15,23,42,0.25)]" style={{ display: doc ? 'block' : 'none' }}>
            <canvas ref={canvasRef} className="block rounded-md bg-white" />
            <AnimatePresence>
              {showBox && (
                <motion.div
                  key={`${grId}|${page}|${citation.passage}`}
                  ref={boxRef}
                  data-testid="citation-box"
                  title="The paragraph that contains the quoted sentence"
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
                    background: 'rgba(245, 158, 11, 0.22)',
                    borderLeft: '2px solid #D97706',
                    boxShadow: '0 0 0 1px rgba(217,119,6,0.25), 0 4px 18px -4px rgba(217,119,6,0.35)',
                  }}
                />
              )}
            </AnimatePresence>
          </div>
        )}
        {mode === 'text' && (
          <div className="mx-auto max-w-prose space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#8A94A6]">Raw OCR text · page {page}</p>
            {blocks.length === 0 && <p className="text-xs text-mist">No text for this page.</p>}
            {blocks.map((b) => {
              const hit = quote && norm(b.text).includes(quote);
              return (
                <p key={b.id} className={`legal-text rounded-lg p-2.5 text-[12.5px] ${hit ? 'border-l-2 border-[#D97706] bg-[#FFFBEB] text-legal' : 'border border-hair bg-sand/50 text-mist'}`}>
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
