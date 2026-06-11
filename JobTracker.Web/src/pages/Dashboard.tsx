import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import Layout from '../components/Layout';
import api from '../lib/api';
import type { Application } from '../types';

// ── helpers ────────────────────────────────────────────────────────────────

const STATUSES = ['Applied', 'Responded', 'InterviewScheduled', 'Offer', 'Rejected', 'Ghosted'];

const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  Applied:           { bg: 'bg-slate-800',   text: 'text-slate-300',  dot: 'bg-slate-400'  },
  Responded:         { bg: 'bg-amber-900/40', text: 'text-amber-300',  dot: 'bg-amber-400'  },
  InterviewScheduled:{ bg: 'bg-violet-900/40',text: 'text-violet-300', dot: 'bg-violet-400' },
  Offer:             { bg: 'bg-emerald-900/40',text:'text-emerald-300',dot: 'bg-emerald-400'},
  Rejected:          { bg: 'bg-red-900/30',   text: 'text-red-300',    dot: 'bg-red-400'    },
  Ghosted:           { bg: 'bg-stone-800/60', text: 'text-stone-400',  dot: 'bg-stone-500'  },
};

function pct(n: number, total: number) {
  return total === 0 ? '0%' : `${Math.round((n / total) * 100)}%`;
}

function getMondayKey(iso: string): string {
  const d = new Date(iso);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

function formatWeekLabel(key: string): string {
  const d = new Date(key + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function buildChartData(apps: Application[]) {
  const map = new Map<string, number>();
  apps.forEach((a) => {
    const key = getMondayKey(a.appliedAt);
    map.set(key, (map.get(key) ?? 0) + 1);
  });
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => ({ week: formatWeekLabel(key), count }));
}

// ── sub-components ─────────────────────────────────────────────────────────

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
          <div key={a.id} className="bg-slate-800 rounded px-2 py-1.5">
            <p className="text-xs font-medium text-white truncate">{a.company}</p>
            <p className="text-xs text-slate-500 truncate">{a.jobTitle}</p>
          </div>
        ))}
        {apps.length > 5 && (
          <p className="text-xs text-slate-600 text-center pt-1">+{apps.length - 5} more</p>
        )}
      </div>
    </div>
  );
}

function InsightsCard() {
  const [insights, setInsights] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<string[]>('/ai/insights')
      .then((r) => setInsights(r.data))
      .catch(() => setInsights([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 rounded-md bg-indigo-600/30 flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-white">AI Insights</h3>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          Analysing your data…
        </div>
      ) : insights.length === 0 ? (
        <p className="text-sm text-slate-500">Add more applications to unlock insights.</p>
      ) : (
        <ul className="space-y-3">
          {insights.map((text, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
              <span className="text-sm text-slate-300">{text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── page ───────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Application[]>('/applications')
      .then((r) => setApps(r.data))
      .finally(() => setLoading(false));
  }, []);

  const total       = apps.length;
  const responded   = apps.filter((a) => ['Responded','InterviewScheduled','Offer'].includes(a.status)).length;
  const interviewed = apps.filter((a) => ['InterviewScheduled','Offer'].includes(a.status)).length;
  const offers      = apps.filter((a) => a.status === 'Offer').length;

  const chartData   = buildChartData(apps);
  const byStatus    = Object.fromEntries(
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
            <StatCard label="Total Applied"   value={total}               />
            <StatCard label="Response Rate"   value={pct(responded, total)}   sub={`${responded} replied`} />
            <StatCard label="Interview Rate"  value={pct(interviewed, total)} sub={`${interviewed} interviews`} />
            <StatCard label="Offers"          value={offers}              />
          </div>
        )}

        {/* Pipeline board + Insights */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Pipeline</h2>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {STATUSES.map((s) => (
                <PipelineColumn key={s} status={s} apps={byStatus[s] ?? []} />
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Insights</h2>
            <InsightsCard />
          </div>
        </div>

        {/* Line chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Applications Over Time</h2>
          {chartData.length < 2 ? (
            <p className="text-sm text-slate-500 text-center py-8">
              Not enough data yet — keep applying!
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="week"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#94a3b8' }}
                  itemStyle={{ color: '#818cf8' }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ fill: '#6366f1', r: 3 }}
                  activeDot={{ r: 5 }}
                  name="Applications"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </Layout>
  );
}
