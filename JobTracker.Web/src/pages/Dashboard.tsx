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
import type { Application, StrategyResult, FollowUpResult } from '../types';

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

function StrategistCard() {
  const [state, setState] = useState<'idle' | 'confirming' | 'loading' | 'done'>('idle');
  const [report, setReport] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const run = async () => {
    setState('loading');
    setError('');
    try {
      const { data } = await api.post<StrategyResult>('/agents/strategy');
      setReport(data.report);
      setState('done');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Strategy analysis failed. Please try again.');
      setState('idle');
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mt-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 rounded-md bg-violet-600/30 flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Strategy Analysis</h3>
          <span className="text-xs text-amber-400/80">uses more credits</span>
        </div>
      </div>

      {state === 'idle' && (
        <button
          onClick={() => setState('confirming')}
          className="w-full text-sm border border-violet-700/60 bg-violet-900/20 text-violet-300 hover:bg-violet-900/40 font-medium rounded-lg py-2.5 transition"
        >
          Run Strategy Analysis
        </button>
      )}

      {state === 'confirming' && (
        <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg p-3 space-y-3">
          <p className="text-xs text-amber-300">
            This runs a deep analysis of your full application history and uses more API credits than a chat message.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setState('idle')}
              className="flex-1 text-xs border border-slate-600 text-slate-400 hover:text-white rounded-lg py-1.5 transition"
            >
              Cancel
            </button>
            <button
              onClick={run}
              className="flex-1 text-xs bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-lg py-1.5 transition"
            >
              Run analysis
            </button>
          </div>
        </div>
      )}

      {state === 'loading' && (
        <div className="flex items-center gap-2 text-slate-400 text-sm py-2">
          <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          Analysing your job search…
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2.5 text-xs text-red-400">
          {error}
        </div>
      )}

      {state === 'done' && report && (
        <div>
          <div className="max-h-96 overflow-y-auto bg-slate-800 rounded-lg p-4 mb-3">
            <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{report}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={copy}
              className="flex-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg py-2 transition"
            >
              {copied ? '✓ Copied!' : 'Copy report'}
            </button>
            <button
              onClick={() => { setState('idle'); setReport(''); }}
              className="text-xs border border-slate-700 text-slate-400 hover:text-white rounded-lg px-3 py-2 transition"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FollowUpCard({ apps }: { apps: Application[] }) {
  const overdue = apps.filter((a) => a.status === 'Applied' && a.daysSinceApplied > 7);

  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState<Record<number, boolean>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [copied, setCopied] = useState<Record<number, boolean>>({});

  if (overdue.length === 0) return null;

  const draft = async (appId: number) => {
    setLoading((p) => ({ ...p, [appId]: true }));
    setErrors((p) => ({ ...p, [appId]: '' }));
    try {
      const { data } = await api.post<FollowUpResult>(`/agents/follow-up/${appId}`);
      setDrafts((p) => ({ ...p, [appId]: data.email }));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErrors((p) => ({ ...p, [appId]: msg || 'Failed to generate email.' }));
    } finally {
      setLoading((p) => ({ ...p, [appId]: false }));
    }
  };

  const copy = (appId: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied((p) => ({ ...p, [appId]: true }));
    setTimeout(() => setCopied((p) => ({ ...p, [appId]: false })), 2000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 rounded-md bg-amber-600/30 flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Follow-up Reminders</h3>
          <p className="text-xs text-slate-500">{overdue.length} application{overdue.length !== 1 ? 's' : ''} with no response after 7+ days</p>
        </div>
      </div>

      <div className="space-y-3">
        {overdue.map((a) => (
          <div key={a.id} className="bg-slate-800 border border-slate-700 rounded-lg p-3">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{a.company}</p>
                <p className="text-xs text-slate-400 truncate">{a.jobTitle}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-amber-400 bg-amber-900/30 border border-amber-800/40 px-2 py-0.5 rounded-full whitespace-nowrap">
                  {a.daysSinceApplied}d ago
                </span>
                {!drafts[a.id] && (
                  <button
                    onClick={() => draft(a.id)}
                    disabled={loading[a.id]}
                    className="text-xs bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 px-2.5 py-1 rounded-lg transition whitespace-nowrap"
                  >
                    {loading[a.id] ? (
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 border border-slate-400 border-t-transparent rounded-full animate-spin inline-block" />
                        Drafting…
                      </span>
                    ) : 'Draft Follow-up'}
                  </button>
                )}
              </div>
            </div>

            {errors[a.id] && (
              <p className="text-xs text-red-400 mt-1">{errors[a.id]}</p>
            )}

            {drafts[a.id] && (
              <div className="mt-2">
                <div className="bg-slate-900 rounded-lg p-3 mb-2 max-h-48 overflow-y-auto">
                  <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{drafts[a.id]}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => copy(a.id, drafts[a.id])}
                    className="flex-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg py-1.5 transition"
                  >
                    {copied[a.id] ? '✓ Copied!' : 'Copy email'}
                  </button>
                  <button
                    onClick={() => setDrafts((p) => { const n = { ...p }; delete n[a.id]; return n; })}
                    className="text-xs border border-slate-700 text-slate-400 hover:text-white rounded-lg px-3 py-1.5 transition"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
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
            <StrategistCard />
          </div>
        </div>

        {/* Follow-up Reminders */}
        {!loading && <FollowUpCard apps={apps} />}

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
