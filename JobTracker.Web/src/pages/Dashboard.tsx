import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../lib/api';
import type { Application, PagedResult } from '../types';

const STATUSES = ['Applied', 'Responded', 'InterviewScheduled', 'Offer', 'Rejected', 'Ghosted'];

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  Applied:           { bg: 'bg-slate-800',    text: 'text-slate-300'  },
  Responded:         { bg: 'bg-amber-900/40', text: 'text-amber-300'  },
  InterviewScheduled:{ bg: 'bg-violet-900/40',text: 'text-violet-300' },
  Offer:             { bg: 'bg-emerald-900/40',text:'text-emerald-300'},
  Rejected:          { bg: 'bg-red-900/30',   text: 'text-red-300'    },
  Ghosted:           { bg: 'bg-stone-800/60', text: 'text-stone-400'  },
};

function pct(n: number, total: number) {
  return total === 0 ? '0%' : `${Math.round((n / total) * 100)}%`;
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-3xl font-bold text-white mt-1">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

function PipelineColumn({ status, apps }: { status: string; apps: Application[] }) {
  const navigate = useNavigate();
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.Applied;
  const label = status === 'InterviewScheduled' ? 'Interview' : status;

  return (
    <div className="flex-1 min-w-[130px]">
      <div className={`rounded-t-lg px-3 py-2 flex items-center justify-between ${s.bg}`}>
        <span className={`text-xs font-semibold ${s.text}`}>{label}</span>
        <span className={`text-xs font-bold ${s.text}`}>{apps.length}</span>
      </div>
      <div className="bg-slate-900 border border-t-0 border-slate-800 rounded-b-lg min-h-[80px] p-2 space-y-1.5">
        {apps.slice(0, 5).map((a) => (
          <button
            key={a.id}
            onClick={() => navigate(`/applications?id=${a.id}`)}
            className="w-full text-left bg-slate-800 hover:bg-slate-700 rounded px-2 py-1.5 transition"
          >
            <p className="text-xs font-medium text-white truncate">{a.company}</p>
            <p className="text-xs text-slate-500 truncate">{a.jobTitle}</p>
            {(a.coverLetter || a.tailoredResume) && (
              <div className="flex gap-1 mt-1">
                {a.coverLetter    && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Cover letter saved" />}
                {a.tailoredResume && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"  title="Tailored resume saved" />}
              </div>
            )}
          </button>
        ))}
        {apps.length > 5 && (
          <p className="text-xs text-slate-600 text-center pt-1">+{apps.length - 5} more</p>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Issue 6: /applications now returns PagedResult<Application>.
    // pageSize=500 loads all applications for the dashboard stats and pipeline board.
    api.get<PagedResult<Application>>('/applications?pageSize=500')
      .then((r) => setApps(r.data.items))
      .finally(() => setLoading(false));
  }, []);

  const total       = apps.length;
  const responded   = apps.filter((a) => ['Responded', 'InterviewScheduled', 'Offer'].includes(a.status)).length;
  const interviewed = apps.filter((a) => ['InterviewScheduled', 'Offer'].includes(a.status)).length;
  const offers      = apps.filter((a) => a.status === 'Offer').length;

  const byStatus = Object.fromEntries(
    STATUSES.map((s) => [s, apps.filter((a) => a.status === s)])
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Your job search at a glance</p>
        </div>

        {/* Stats row */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5 animate-pulse">
                <div className="h-3 bg-slate-800 rounded w-20 mb-3" />
                <div className="h-8 bg-slate-800 rounded w-12" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Applied"  value={total}                  />
            <StatCard label="Response Rate"  value={pct(responded, total)}  sub={`${responded} replied`}       />
            <StatCard label="Interview Rate" value={pct(interviewed, total)} sub={`${interviewed} interviews`} />
            <StatCard label="Offers"         value={offers}                 />
          </div>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            to="/chat"
            className="group bg-violet-600/10 hover:bg-violet-600/20 border border-violet-500/30 hover:border-violet-500/50 rounded-xl p-5 transition flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-white group-hover:text-violet-300 transition">AI Chat</p>
              <p className="text-xs text-slate-500 mt-0.5">Ask your AI coach anything about your job search</p>
            </div>
          </Link>

          <Link
            to="/applications"
            className="group bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl p-5 transition flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Track Applications</p>
              <p className="text-xs text-slate-500 mt-0.5">Log jobs, run match analysis, prep for interviews</p>
            </div>
          </Link>
        </div>

        {/* Pipeline board */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Pipeline</h2>
            <p className="text-xs text-slate-600">Click a card to open details</p>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {STATUSES.map((s) => (
              <PipelineColumn key={s} status={s} apps={byStatus[s] ?? []} />
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
