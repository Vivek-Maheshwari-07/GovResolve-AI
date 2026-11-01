import React, { useState, useEffect } from 'react';
import { 
  Scale, Search, ArrowRight, Sparkles, CheckCircle2, 
  AlertTriangle, XCircle, HelpCircle, FolderPlus, 
  GitBranch, FileText, Check, Copy, Keyboard, CheckSquare, 
  MessageSquareWarning, ExternalLink
} from 'lucide-react';

import PdfViewer from './components/PdfViewer';
import LineageTimeline from './components/LineageTimeline';
import GujaratiKeyboard from './components/GujaratiKeyboard';
import ChecklistCard from './components/ChecklistCard';
import IngestModal from './components/IngestModal';

export default function App() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [stats, setStats] = useState({ total_grs: 0, latest_date: null });
  const [activeTab, setActiveTab] = useState('pdf'); // 'pdf' | 'timeline'
  const [activeCitation, setActiveCitation] = useState(null);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [showIngestModal, setShowIngestModal] = useState(false);
  const [copiedNote, setCopiedNote] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [isChecklistMode, setIsChecklistMode] = useState(false);

  // Fetch backend statistics
  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.warn('Backend not responding yet:', err);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // Handle Search Submission
  const handleSearch = async (searchQuery) => {
    const q = (searchQuery || query).trim();
    if (!q) return;

    setLoading(true);
    setResponse(null);
    setActiveCitation(null);
    setFeedbackSent(false);

    // Auto-detect if user wants checklist mode
    if (q.toLowerCase().includes('document') || q.toLowerCase().includes('પુરાવા') || q.toLowerCase().includes('joie')) {
      setIsChecklistMode(true);
    } else {
      setIsChecklistMode(false);
    }

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q })
      });

      if (!res.ok) throw new Error(`Query failed with status ${res.status}`);
      const data = await res.json();
      setResponse(data);

      // Automatically select first citation if available
      if (data.citations && data.citations.length > 0) {
        setActiveCitation(data.citations[0]);
      } else if (data.statements && data.statements[0]?.citations?.length > 0) {
        setActiveCitation(data.statements[0].citations[0]);
      }
    } catch (err) {
      alert('Error searching resolutions: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Virtual Gujarati Keyboard Insert
  const insertChar = (char) => {
    setQuery(prev => prev + char);
  };

  // Copy Citation Note for Office Files / Tribunals
  const copyOfficeNote = () => {
    if (!response) return;
    const dateStr = new Date().toLocaleDateString();
    let text = `OFFICIAL FILE NOTE — GOVRESOLVE-AI VERIFICATION\n`;
    text += `Date: ${dateStr}\n`;
    text += `Question: ${response.question}\n`;
    text += `Status: ${response.answer_status}\n\n`;
    text += `SUMMARY:\n${response.summary}\n\n`;
    text += `AUTHORITATIVE CITATIONS:\n`;
    (response.citations || []).forEach(c => {
      text += `• GR No: ${c.gr_number || c.gr_id} (Dated: ${c.issue_date || 'N/A'}, Page ${c.page})\n`;
      text += `  Quote: "${c.passage}"\n`;
    });
    navigator.clipboard.writeText(text);
    setCopiedNote(true);
    setTimeout(() => setCopiedNote(false), 2000);
  };

  // Status Banner Configurations
  const getStatusConfig = (status) => {
    switch (status) {
      case 'Found, no later change':
        return {
          bg: 'bg-emerald-50 border-emerald-200 text-emerald-950',
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
          badge: 'Safe to Act',
          badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          desc: `No subsequent amending resolution found in available documents up to ${response?.collection_latest_date || 'latest gazette'}. Verify for newer orders.`
        };
      case 'Found, amended':
        return {
          bg: 'bg-amber-50 border-amber-200 text-amber-950',
          icon: <AlertTriangle className="w-5 h-5 text-amber-600" />,
          badge: 'Amended Rule',
          badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
          desc: 'This resolution has been modified by a subsequent order. Operative terms are reflected below.'
        };
      case 'Found, superseded':
        return {
          bg: 'bg-rose-50 border-rose-200 text-rose-950',
          icon: <XCircle className="w-5 h-5 text-rose-600" />,
          badge: 'Do Not Act: Superseded',
          badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
          desc: 'This resolution has been replaced or cancelled by a subsequent resolution.'
        };
      case 'Conflict':
        return {
          bg: 'bg-purple-50 border-purple-200 text-purple-950',
          icon: <Scale className="w-5 h-5 text-purple-600" />,
          badge: 'Legal Review Needed',
          badgeClass: 'bg-purple-100 text-purple-800 border-purple-300',
          desc: 'Contradictory directives found between department circulars. Requires administrative review.'
        };
      default:
        return {
          bg: 'bg-slate-100 border-slate-300 text-slate-800',
          icon: <HelpCircle className="w-5 h-5 text-slate-600" />,
          badge: response?.insufficient_reason || 'Insufficient Evidence',
          badgeClass: 'bg-slate-200 text-slate-700 border-slate-300',
          desc: 'Unable to locate an official gazetted resolution answering this query in the current corpus.'
        };
    }
  };

  const statusConfig = response ? getStatusConfig(response.answer_status) : null;

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden text-slate-800">
      
      {/* ── HEADER ── */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-xs z-20 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-700 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold tracking-tight text-slate-900">GovResolve-AI</h1>
              <span className="bg-blue-50 text-brand-700 text-xs font-semibold px-2 py-0.5 rounded-full border border-blue-200">
                PS000230
              </span>
              <span className="bg-emerald-50 text-emerald-700 text-xs font-medium px-2 py-0.5 rounded-full border border-emerald-200 flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                Bilingual RAG
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              Find the Right Government Resolution • Page Grounding • Temporal Lineage
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Collection Status */}
          <div className="hidden md:flex items-center space-x-2 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
            <span className="text-slate-600 font-medium">
              <strong className="text-slate-900 font-bold">{stats.total_grs}</strong> Resolutions
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500">GAD & Finance</span>
          </div>

          {/* Ingest Modal Button */}
          <button 
            onClick={() => setShowIngestModal(true)}
            className="inline-flex items-center space-x-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition"
          >
            <FolderPlus className="w-4 h-4 text-slate-500" />
            <span>Ingest PDFs</span>
          </button>
        </div>
      </header>

      {/* ── TWO-PANE SPLIT SCREEN (Squad 4) ── */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* ── LEFT PANE: SEARCH & GROUNDED ANSWERS ── */}
        <section className="w-full lg:w-1/2 flex flex-col border-r border-slate-200 bg-white overflow-hidden">
          
          {/* Search Box */}
          <div className="p-5 border-b border-slate-200 bg-slate-50/70 shrink-0 space-y-3">
            <form 
              onSubmit={(e) => { e.preventDefault(); handleSearch(); }}
              className="relative"
            >
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Search className="w-5 h-5" />
              </div>

              <input 
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask in Gujarati, English, or Gujlish (e.g. 'maternity leave mate kya documents joie?')"
                className="w-full pl-10 pr-24 py-3 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 shadow-xs transition"
              />

              <div className="absolute right-2 top-2 bottom-2 flex items-center space-x-1">
                {/* Virtual Keyboard Toggle */}
                <button
                  type="button"
                  onClick={() => setShowKeyboard(!showKeyboard)}
                  className={`p-1.5 rounded-lg border transition ${showKeyboard ? 'bg-brand-50 text-brand-700 border-brand-300' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                  title="Toggle Gujarati Virtual Keyboard"
                >
                  <Keyboard className="w-4 h-4" />
                </button>

                <button 
                  type="submit"
                  disabled={loading}
                  className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 shadow-xs transition disabled:opacity-50"
                >
                  <span>{loading ? 'Searching' : 'Find'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>

            {/* Virtual Keyboard Container */}
            {showKeyboard && (
              <GujaratiKeyboard 
                onInsert={insertChar}
                onClose={() => setShowKeyboard(false)}
              />
            )}

            {/* Preset Query Pills */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs text-slate-600">
              <span className="text-slate-400 font-medium shrink-0">Try:</span>
              <button 
                type="button" 
                onClick={() => { setQuery('maternity leave mate kya documents joie?'); handleSearch('maternity leave mate kya documents joie?'); }}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-md shrink-0 transition text-slate-700 font-medium"
              >
                🤰 Maternity documents (Gujlish)
              </button>
              <button 
                type="button" 
                onClick={() => { setQuery('refund leva mate su karvu pade?'); handleSearch('refund leva mate su karvu pade?'); }}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-md shrink-0 transition text-slate-700 font-medium"
              >
                💰 Refund procedure (Gujlish)
              </button>
              <button 
                type="button" 
                onClick={() => { setQuery('How many days of casual leave are allowed per year?'); handleSearch('How many days of casual leave are allowed per year?'); }}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-md shrink-0 transition text-slate-700 font-medium"
              >
                📅 Casual Leave rules
              </button>
              <button 
                type="button" 
                onClick={() => { setQuery('પ્રસૂતિ રજા માટે ક્યા ક્યા પુરાવા આપવા પડે?'); handleSearch('પ્રસૂતિ રજા માટે ક્યા ક્યા પુરાવા આપવા પડે?'); }}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-md shrink-0 transition text-slate-700 font-gujarati"
              >
                🏛️ પ્રસૂતિ રજા નિયમો
              </button>
            </div>
          </div>

          {/* Results Area */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            
            {/* Empty State */}
            {!response && !loading && (
              <div className="py-16 text-center max-w-md mx-auto space-y-4">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center border border-brand-100">
                  <FileText className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Official Government Resolution Search</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Ask questions in Gujarati script, English, or conversational Gujlish. 
                  Every returned provision is strictly verified against physical PDF bounding boxes, and later amendment lineages are checked automatically.
                </p>
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="py-20 text-center space-y-3">
                <div className="inline-block animate-spin w-8 h-8 border-3 border-brand-600 border-t-transparent rounded-full"></div>
                <p className="text-sm font-semibold text-slate-800">Processing Bilingual RAG Pipeline...</p>
                <p className="text-xs text-slate-500">Query normalization • Hybrid RRF • Lineage injection • Grounded synthesis</p>
              </div>
            )}

            {/* Answer Display */}
            {response && (
              <div className="space-y-4 animate-in fade-in duration-200">
                
                {/* Safe-to-Act Banner */}
                <div className={`p-4 rounded-xl border flex items-start space-x-3.5 transition shadow-xs ${statusConfig.bg}`}>
                  <div className="p-2 rounded-lg bg-white/80 shrink-0 mt-0.5">
                    {statusConfig.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold tracking-tight">{response.answer_status}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusConfig.badgeClass}`}>
                        {statusConfig.badge}
                      </span>
                    </div>
                    <p className="text-xs mt-1 text-slate-700 leading-relaxed font-medium">
                      {statusConfig.desc}
                    </p>
                  </div>
                </div>

                {/* Executive Summary */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center">
                      <Sparkles className="w-3.5 h-3.5 mr-1 text-brand-600" />
                      Executive Summary
                    </h4>
                    {/* One-click Export for Office Files (UI-13) */}
                    <button 
                      onClick={copyOfficeNote}
                      className="inline-flex items-center space-x-1 text-[11px] font-semibold text-slate-600 hover:text-brand-700 bg-white px-2 py-0.5 rounded border border-slate-200 transition"
                      title="Copy formatted note for office file"
                    >
                      {copiedNote ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedNote ? 'Copied Note' : 'Export Note'}</span>
                    </button>
                  </div>
                  <p className="text-sm text-slate-900 leading-relaxed font-medium">
                    {response.summary || 'Summary unavailable.'}
                  </p>
                </div>

                {/* Checklist Mode (UI-12) */}
                {isChecklistMode && response.statements && (
                  <ChecklistCard statements={response.statements} />
                )}

                {/* Grounded Statements Breakdown */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Verifiable Grounded Statements & Citations
                  </h4>

                  <div className="space-y-2">
                    {(response.statements || []).map((stmt, idx) => (
                      <div key={idx} className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2 hover:border-slate-300 transition">
                        <div className="flex items-start justify-between space-x-2">
                          <p className="text-xs text-slate-800 leading-relaxed font-medium">
                            {stmt.text}
                          </p>
                          <span className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${
                            stmt.label === 'Established' 
                              ? 'bg-blue-50 text-blue-700 border-blue-200' 
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {stmt.label}
                          </span>
                        </div>

                        {/* Citation Chips (UI-4) */}
                        {stmt.citations && stmt.citations.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-slate-100">
                            {stmt.citations.map((cit, cIdx) => (
                              <button
                                key={cIdx}
                                type="button"
                                onClick={() => { setActiveCitation(cit); setActiveTab('pdf'); }}
                                className={`inline-flex items-center space-x-1.5 px-2 py-1 rounded-md text-xs font-semibold transition border ${
                                  activeCitation?.passage === cit.passage
                                    ? 'bg-brand-600 text-white border-brand-700 shadow-xs'
                                    : 'bg-slate-100 hover:bg-brand-50 text-slate-700 hover:text-brand-700 border-slate-200 hover:border-brand-200'
                                }`}
                              >
                                <FileText className="w-3 h-3" />
                                <span>{cit.gr_number || cit.gr_id}</span>
                                <span className={activeCitation?.passage === cit.passage ? 'text-blue-100' : 'text-slate-400 font-normal'}>
                                  p.{cit.page}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ask-back / Clarification Box */}
                {response.follow_up_question && (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start space-x-2.5">
                    <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block mb-0.5">Clarification Required:</span>
                      <p className="text-amber-800">{response.follow_up_question}</p>
                    </div>
                  </div>
                )}

                {/* Wrong Answer Feedback (UI-11) */}
                <div className="pt-2 flex items-center justify-between text-xs text-slate-400 border-t border-slate-100">
                  <span>Is this administrative decision accurate?</span>
                  <button 
                    onClick={() => setFeedbackSent(true)}
                    disabled={feedbackSent}
                    className="inline-flex items-center space-x-1 text-slate-500 hover:text-rose-600 transition"
                  >
                    <MessageSquareWarning className="w-3.5 h-3.5" />
                    <span>{feedbackSent ? 'Feedback Logged ✓' : 'Report Issue'}</span>
                  </button>
                </div>

              </div>
            )}

          </div>
        </section>

        {/* ── RIGHT PANE: LIVE PDF.JS VIEWER & LINEAGE TIMELINE ── */}
        <section className="hidden lg:flex w-1/2 flex-col bg-slate-50 overflow-hidden">
          
          {/* Right Pane Navigation Header */}
          <div className="px-5 py-3 border-b border-slate-200 bg-white flex items-center justify-between shrink-0 shadow-xs">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setActiveTab('pdf')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition ${
                  activeTab === 'pdf' 
                    ? 'bg-brand-50 text-brand-700 border border-brand-200 shadow-xs' 
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Original PDF Viewer</span>
              </button>

              <button
                onClick={() => setActiveTab('timeline')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition ${
                  activeTab === 'timeline' 
                    ? 'bg-brand-50 text-brand-700 border border-brand-200 shadow-xs' 
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span>Lineage Family Tree</span>
                {response?.lineage_chain?.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 bg-indigo-100 text-indigo-700 text-[10px] rounded-full">
                    {response.lineage_chain.length}
                  </span>
                )}
              </button>
            </div>

            {activeCitation && activeTab === 'pdf' && (
              <span className="text-xs text-slate-500 font-medium">
                Cited on Page <strong className="text-slate-800">{activeCitation.page}</strong>
              </span>
            )}
          </div>

          {/* Right Pane Content */}
          <div className="flex-1 overflow-hidden p-4">
            
            {activeTab === 'pdf' ? (
              activeCitation ? (
                <PdfViewer 
                  pdfUrl={`/api/pdf/${activeCitation.gr_id}?page=${activeCitation.page}`}
                  initialPage={activeCitation.page}
                  passage={activeCitation.passage}
                  grNumber={activeCitation.gr_number || activeCitation.gr_id}
                  issueDate={activeCitation.issue_date}
                  ocrConfidence={activeCitation.ocr_confidence}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 bg-white border border-slate-200 rounded-xl space-y-2">
                  <FileText className="w-12 h-12 stroke-1 text-slate-300 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-700">Live PDF Document View</h4>
                  <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                    Execute a search on the left and click any citation chip to open the official gazette PDF at the exact cited page.
                  </p>
                </div>
              )
            ) : (
              <div className="h-full overflow-y-auto">
                <LineageTimeline chain={response?.lineage_chain || []} />
              </div>
            )}

          </div>

        </section>

      </main>

      {/* ── INGESTION MODAL ── */}
      <IngestModal 
        isOpen={showIngestModal} 
        onClose={() => setShowIngestModal(false)}
        onIngestSuccess={() => { setShowIngestModal(false); fetchStats(); }}
      />

    </div>
  );
}

