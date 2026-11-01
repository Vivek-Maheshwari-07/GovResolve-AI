import React, { useState } from 'react';
import { CheckSquare, Square, FileText } from 'lucide-react';

export default function ChecklistCard({ statements = [] }) {
  const [checked, setChecked] = useState({});

  const toggleCheck = (idx) => {
    setChecked(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  if (!statements || statements.length === 0) return null;

  return (
    <div className="bg-emerald-50/60 border border-emerald-200/90 rounded-xl p-4 shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center">
          <CheckSquare className="w-4 h-4 text-emerald-700 mr-1.5" />
          Document Requirements Checklist
        </h4>
        <span className="text-[11px] font-medium text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
          Official GAD Checklist
        </span>
      </div>

      <div className="space-y-2">
        {statements.map((stmt, idx) => {
          const isDone = !!checked[idx];
          return (
            <div 
              key={idx}
              onClick={() => toggleCheck(idx)}
              className={`p-2.5 rounded-lg border transition cursor-pointer flex items-start space-x-2.5 ${
                isDone 
                  ? 'bg-emerald-100/60 border-emerald-300 text-emerald-950' 
                  : 'bg-white border-slate-200 hover:border-emerald-300 text-slate-800'
              }`}
            >
              <div className="mt-0.5 text-emerald-700 shrink-0">
                {isDone ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-slate-400" />}
              </div>
              <div className="flex-1 text-xs leading-relaxed font-medium">
                <span className={isDone ? 'line-through text-slate-500' : ''}>
                  {stmt.text}
                </span>
                {stmt.citations && stmt.citations.length > 0 && (
                  <span className="block mt-1 text-[10px] text-slate-400 font-mono">
                    Cited: {stmt.citations[0].gr_number || stmt.citations[0].gr_id} (p.{stmt.citations[0].page})
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

