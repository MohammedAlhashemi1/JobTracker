import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../lib/api';
import type { Application } from '../types';

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
    api.get<Application[]>('/applications')
      .then((r) => setApps(r.data))
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
