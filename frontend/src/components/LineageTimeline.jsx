import React from 'react';
import { GitBranch, GitCommit, ArrowRight, AlertTriangle, ShieldCheck, FileText } from 'lucide-react';

export default function LineageTimeline({ chain = [], onSelectGR }) {
  if (!chain || chain.length === 0) {
    return (
      <div className="p-8 text-center bg-white border border-slate-200 rounded-xl">
        <GitBranch className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-xs text-slate-500 font-medium">
          No multi-step amendment lineage found for this document. It stands as an original isolated resolution.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg">
            <GitBranch className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Resolution Family Tree & Amendment Lineage
            </h4>
            <p className="text-[11px] text-slate-500">
              Tracks multi-step changes to ensure you act on the latest operative rule.
            </p>
          </div>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md">
          {chain.length} Orders in Chain
        </span>
      </div>

      {/* Timeline nodes */}
      <div className="relative pl-6 space-y-6 before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-200 before:z-0">
        {chain.map((node, i) => {
          const isLatest = i === chain.length - 1;
          const isSuperseded = node.status === 'Superseded';
          const isAmended = node.status === 'Amended';

          let statusBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
          let statusText = 'Operative / Active';
          let ringColor = 'bg-emerald-500 ring-4 ring-emerald-100';

          if (isSuperseded) {
            statusBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
            statusText = 'Superseded (Do Not Act)';
            ringColor = 'bg-rose-500 ring-4 ring-rose-100';
          } else if (isAmended) {
            statusBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
            statusText = 'Amended / Partial';
            ringColor = 'bg-amber-500 ring-4 ring-amber-100';
          }

          return (
            <div key={node.gr_id || i} className="relative z-10">
              {/* Dot indicator */}
              <div className={`absolute -left-6 top-3 w-4 h-4 rounded-full ${ringColor} transition`} />

              <div className={`p-4 rounded-xl border transition ${
                isLatest ? 'bg-brand-50/40 border-brand-200 shadow-xs' : 'bg-white border-slate-200 hover:border-slate-300'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-900 tracking-tight flex items-center">
                        <FileText className="w-3.5 h-3.5 mr-1 text-slate-500" />
                        {node.gr_number || node.gr_id}
                      </span>
                      {isLatest && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-brand-600 text-white rounded">
                          LATEST
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Issued: {node.date || 'Unknown Date'}
                    </p>
                  </div>

                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusBadgeClass}`}>
                    {statusText}
                  </span>
                </div>

                {/* Edges out (e.g. SUPERSEDES GAD-2014-001) */}
                {node.edges_out && node.edges_out.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1.5">
                    {node.edges_out.map((edge, eIdx) => (
                      <div key={eIdx} className="flex items-center space-x-2 text-xs">
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {edge.link_type}
                        </span>
                        <span className="text-slate-600 text-xs">
                          {edge.scope || 'Clause'}: <strong className="text-slate-800">{edge.to_gr_number || edge.to_gr_id}</strong>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

