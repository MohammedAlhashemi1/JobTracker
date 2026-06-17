import { useState } from 'react';
import type { JobMatchResult, EmailInterpretResult } from '../types';

interface BaseProps {
  title: string;
  onClose: () => void;
}

interface TextResultProps extends BaseProps {
  type: 'text';
  content: string;
}

interface MatchResultProps extends BaseProps {
  type: 'match';
  result: JobMatchResult;
}

interface EmailResultProps extends BaseProps {
  type: 'email';
  result: EmailInterpretResult;
  onApplyStatus: (status: string) => void;
}

type AgentResultPanelProps = TextResultProps | MatchResultProps | EmailResultProps;

export default function AgentResultPanel(props: AgentResultPanelProps) {
  const [copied, setCopied] = useState(false);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-4 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">{props.title}</span>
        <button onClick={props.onClose} className="text-slate-500 hover:text-white transition text-xs">
          ✕ Close
        </button>
      </div>

      {props.type === 'match' && (
        <div className="p-4 space-y-4">
          {/* Score */}
          <div className="flex items-center gap-4">
            <div className={`text-4xl font-bold ${
              props.result.score >= 70 ? 'text-emerald-400' :
              props.result.score >= 40 ? 'text-amber-400' : 'text-red-400'
            }`}>
              {props.result.score}<span className="text-lg text-slate-500">/100</span>
            </div>
            <div className="flex-1 bg-slate-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  props.result.score >= 70 ? 'bg-emerald-500' :
                  props.result.score >= 40 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${props.result.score}%` }}
              />
            </div>
          </div>

          {/* Skills */}
          <div className="grid grid-cols-2 gap-3">
            {props.result.matchingSkills.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 mb-2">Matching skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {props.result.matchingSkills.map((s) => (
                    <span key={s} className="text-xs bg-emerald-900/40 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {props.result.missingSkills.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 mb-2">Missing skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {props.result.missingSkills.map((s) => (
                    <span key={s} className="text-xs bg-red-900/30 text-red-300 border border-red-800/50 px-2 py-0.5 rounded-full">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Emphasis */}
          {props.result.emphasis && (
            <div className="bg-indigo-900/20 border border-indigo-800/40 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">What to emphasize</p>
              <p className="text-sm text-slate-300">{props.result.emphasis}</p>
            </div>
          )}
        </div>
      )}

      {props.type === 'text' && (
        <div className="p-4">
          <div className="max-h-72 overflow-y-auto bg-slate-900 rounded-lg p-3 mb-3">
            <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{props.content}</p>
          </div>
          <button
            onClick={() => copy(props.content)}
            className="w-full text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg py-2 transition font-medium"
          >
            {copied ? '✓ Copied!' : 'Copy to clipboard'}
          </button>
        </div>
      )}

      {props.type === 'email' && (
        <div className="p-4 space-y-3">
          <p className="text-sm text-slate-300">{props.result.summary}</p>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">Suggested status:</span>
            <span className="text-xs font-semibold text-indigo-300 bg-indigo-900/30 border border-indigo-800/50 px-2.5 py-1 rounded-full">
              {props.result.suggestedStatus === 'InterviewScheduled' ? 'Interview Scheduled' : props.result.suggestedStatus}
            </span>
          </div>
          {props.result.explanation && (
            <p className="text-xs text-slate-500 italic">{props.result.explanation}</p>
          )}
          <button
            onClick={() => props.onApplyStatus(props.result.suggestedStatus)}
            className="w-full text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg py-2 transition font-medium"
          >
            Apply status update
          </button>
        </div>
      )}
    </div>
  );
}
