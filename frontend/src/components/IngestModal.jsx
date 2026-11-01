import React, { useState } from 'react';
import { UploadCloud, X, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export default function IngestModal({ isOpen, onClose, onIngestSuccess }) {
  const [pdfDir, setPdfDir] = useState('./data/grs');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  if (!isOpen) return null;

  const handleIngest = async () => {
    setLoading(true);
    setStatusMsg(null);

    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdf_dir: pdfDir.trim() })
      });

      if (!res.ok) {
        let errorDetail = `Server returned ${res.status}`;
        try {
          const errData = await res.json();
          errorDetail = errData.detail || errData.message || errorDetail;
        } catch (_) {}
        throw new Error(errorDetail);
      }
      const data = await res.json();

      setStatusMsg({
        type: 'success',
        text: data.message || `Background ingestion started for ${data.pdf_count || 0} PDF(s)! Extracting text, bounding boxes, and linking lineage.`
      });

      if (onIngestSuccess) {
        setTimeout(onIngestSuccess, 2000);
      }
    } catch (err) {
      setStatusMsg({
        type: 'error',
        text: err.message.startsWith('Failed to fetch') 
          ? 'Cannot connect to backend server. Ensure the FastAPI backend is running on port 8000.'
          : err.message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 flex items-center">
            <UploadCloud className="w-5 h-5 text-brand-600 mr-2" />
            Ingest Resolutions (GRs)
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Drop your PDF files into your project folder (<code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-800">./data/grs/</code>). 
          The dual pipeline routes scanned pages through Tesseract OCR and digital pages through PyMuPDF, extracting bounding boxes, metadata, and lineage relations automatically.
        </p>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">PDF Directory:</label>
          <input
            type="text"
            value={pdfDir}
            onChange={(e) => setPdfDir(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        </div>

        {statusMsg && (
          <div className={`p-3 rounded-lg text-xs flex items-start space-x-2 ${
            statusMsg.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}>
            {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
            <span>{statusMsg.text}</span>
          </div>
        )}

        <div className="pt-2 flex items-center justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={handleIngest}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition flex items-center space-x-1.5 shadow-xs disabled:opacity-50"
          >
            {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <span>{loading ? 'Triggering...' : 'Start Ingestion'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

