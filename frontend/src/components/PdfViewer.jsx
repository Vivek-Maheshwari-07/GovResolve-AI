import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { 
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, 
  RotateCw, ExternalLink, Copy, Check, FileText, AlertCircle
} from 'lucide-react';

// Configure PDF.js worker using CDN matching library version
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export default function PdfViewer({ pdfUrl, initialPage = 1, passage, grNumber, issueDate, ocrConfidence }) {
  const canvasRef = useRef(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageNum, setPageNum] = useState(initialPage);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.15);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  // Sync pageNum when initialPage changes
  useEffect(() => {
    if (initialPage) {
      setPageNum(initialPage);
    }
  }, [initialPage, pdfUrl]);

  // Load PDF document
  useEffect(() => {
    if (!pdfUrl) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    const loadingTask = pdfjsLib.getDocument(pdfUrl);
    loadingTask.promise
      .then((doc) => {
        if (!isMounted) return;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Error loading PDF:', err);
        setError('Could not load original PDF file. It may not be present in ./data/grs/ yet.');
        setLoading(false);
      });

    return () => {
      isMounted = false;
      loadingTask.destroy();
    };
  }, [pdfUrl]);

  // Render Page on Canvas
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let renderTask = null;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    pdfDoc.getPage(pageNum).then((page) => {
      const viewport = page.getViewport({ scale });
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: ctx,
        viewport: viewport,
      };

      renderTask = page.render(renderContext);
      renderTask.promise.catch((err) => {
        if (err?.name !== 'RenderingCancelledException') {
          console.error('Render error:', err);
        }
      });
    });

    return () => {
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDoc, pageNum, scale]);

  const copyPassage = () => {
    if (!passage) return;
    navigator.clipboard.writeText(`"${passage}" — [GR No. ${grNumber || 'N/A'}, Page ${pageNum}]`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden rounded-xl border border-slate-200">
      
      {/* ── Toolbar ── */}
      <div className="bg-white px-4 py-2.5 border-b border-slate-200 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-slate-800 tracking-tight flex items-center">
            <FileText className="w-4 h-4 text-brand-600 mr-1.5" />
            {grNumber || 'Resolution Document'}
          </span>
          {issueDate && (
            <span className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-medium">
              {issueDate}
            </span>
          )}
        </div>

        {/* Page navigation & Zoom */}
        <div className="flex items-center space-x-1.5 text-xs">
          <button 
            disabled={pageNum <= 1}
            onClick={() => setPageNum(p => Math.max(1, p - 1))}
            className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40 text-slate-600 transition"
            title="Previous Page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <span className="px-2 py-1 text-slate-700 font-semibold text-xs">
            {pageNum} / {numPages || 1}
          </span>

          <button 
            disabled={pageNum >= numPages}
            onClick={() => setPageNum(p => Math.min(numPages, p + 1))}
            className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40 text-slate-600 transition"
            title="Next Page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <span className="w-px h-4 bg-slate-200 mx-1"></span>

          <button 
            onClick={() => setScale(s => Math.max(0.7, s - 0.15))}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-600 transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <button 
            onClick={() => setScale(s => Math.min(2.5, s + 0.15))}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-600 transition"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <a 
            href={pdfUrl} 
            target="_blank" 
            rel="noreferrer"
            className="p-1.5 rounded hover:bg-slate-100 text-slate-600 transition ml-1"
            title="Open Raw PDF in New Tab"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* ── Passage Callout Card (Pinned above canvas) ── */}
      {passage && (
        <div className="bg-amber-50/90 border-b border-amber-200 px-4 py-3 shrink-0 shadow-xs backdrop-blur-xs">
          <div className="flex items-start justify-between space-x-2">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 bg-amber-200/60 px-1.5 py-0.5 rounded">
                  Cited Official Passage (Page {initialPage})
                </span>
                {ocrConfidence && ocrConfidence < 0.6 && (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded flex items-center">
                    <AlertCircle className="w-3 h-3 mr-1" /> Weak OCR Scan
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-900 font-serif leading-relaxed verbatim-highlight inline-block">
                "{passage}"
              </p>
            </div>
            <button 
              onClick={copyPassage}
              className="p-1.5 rounded bg-white hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-semibold flex items-center space-x-1 shrink-0 transition"
              title="Copy Citation for Office Note"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Cite'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ── PDF Canvas Viewport ── */}
      <div className="flex-1 overflow-auto p-4 flex justify-center items-start">
        {loading && (
          <div className="py-20 text-center space-y-2">
            <div className="inline-block animate-spin w-7 h-7 border-3 border-brand-600 border-t-transparent rounded-full"></div>
            <p className="text-xs font-semibold text-slate-600">Rendering PDF Page {pageNum} via PDF.js...</p>
          </div>
        )}

        {error && (
          <div className="max-w-md my-auto p-6 bg-white border border-slate-200 rounded-xl text-center shadow-xs space-y-3">
            <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
            <h4 className="text-sm font-bold text-slate-800">Original Document Preview</h4>
            <p className="text-xs text-slate-600 leading-relaxed">{error}</p>
            <div className="p-3 bg-slate-50 rounded-lg text-left text-xs font-mono text-slate-600 border border-slate-100">
              <span className="font-bold text-slate-800 block mb-1">Passage Text Verified:</span>
              "{passage || 'N/A'}"
            </div>
          </div>
        )}

        <div className={`relative shadow-md bg-white ${loading || error ? 'hidden' : 'block'}`}>
          <canvas ref={canvasRef} className="block max-w-full" />
        </div>
      </div>

    </div>
  );
}

