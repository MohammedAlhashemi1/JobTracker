import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import StatusBadge from '../components/StatusBadge';
import AgentResultPanel from '../components/AgentResultPanel';
import api from '../lib/api';
import { downloadDocx } from '../lib/downloadDocx';
import type {
  Application,
  CreateApplicationRequest,
  UpdateApplicationRequest,
  JobMatchResult,
  ResumeTailorResult,
  CoverLetterResult,
  InterviewPrepResult,
} from '../types';

const STATUSES = ['Applied', 'Responded', 'InterviewScheduled', 'Offer', 'Rejected', 'Ghosted'];

// ── Drawer ─────────────────────────────────────────────────────────────────

function Drawer({
  app,
  onClose,
  onUpdated,
  onDeleted,
}: {
  app: Application;
  onClose: () => void;
  onUpdated: (updated: Application) => void;
  onDeleted: (id: number) => void;
}) {
  const [notes, setNotes] = useState(app.notes ?? '');
  const [notesDirty, setNotesDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // agent state
  type AgentKey = 'match' | 'resume-tailor' | 'cover-letter';
  type AgentResult =
    | { type: 'match'; data: JobMatchResult }
    | { type: 'text'; label: string; data: string };

  const [pendingAgent, setPendingAgent] = useState<AgentKey | null>(null);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentResult, setAgentResult] = useState<AgentResult | null>(null);
  const [agentError, setAgentError] = useState('');

  // saved doc state — initialised from DB, updated after agent runs
  const [savedCoverLetter, setSavedCoverLetter] = useState<string | null>(app.coverLetter ?? null);
  const [savedTailoredResume, setSavedTailoredResume] = useState<string | null>(app.tailoredResume ?? null);

  // interview prep
  const [savedInterviewPrep, setSavedInterviewPrep] = useState<string | null>(app.interviewPrep ?? null);
  const [interviewPrepExpanded, setInterviewPrepExpanded] = useState(false);
  const [interviewPrepLoading, setInterviewPrepLoading] = useState(false);
  const [interviewPrepError, setInterviewPrepError] = useState('');

  const runAgent = async (key: AgentKey) => {
    setPendingAgent(null);
    setAgentLoading(true);
    setAgentResult(null);
    setAgentError('');
    try {
      if (key === 'match') {
        const { data } = await api.post<JobMatchResult>(`/agents/match/${app.id}`);
        setAgentResult({ type: 'match', data });
      } else if (key === 'resume-tailor') {
        const { data } = await api.post<ResumeTailorResult>(`/agents/resume-tailor/${app.id}`);
        setSavedTailoredResume(data.tailoredBullets);
        onUpdated({ ...app, tailoredResume: data.tailoredBullets });
      } else if (key === 'cover-letter') {
        const { data } = await api.post<CoverLetterResult>(`/agents/cover-letter/${app.id}`);
        setSavedCoverLetter(data.coverLetter);
        onUpdated({ ...app, coverLetter: data.coverLetter });
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setAgentError(msg || 'Agent failed. Please try again.');
    } finally {
      setAgentLoading(false);
    }
  };

  const patch = async (payload: UpdateApplicationRequest) => {
    const { data } = await api.put<Application>(`/applications/${app.id}`, payload);
    onUpdated(data);
  };

  const handleStatusChange = async (status: string) => {
    await patch({ status });
  };

  const handleSaveNotes = async () => {
    setSaving(true);
    await patch({ notes });
    setNotesDirty(false);
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${app.jobTitle}" at ${app.company}?`)) return;
    setDeleting(true);
    await api.delete(`/applications/${app.id}`);
    onDeleted(app.id);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* backdrop */}
      <div className="flex-1 bg-black/50" onClick={onClose} />

      {/* panel */}
      <div className="w-full max-w-lg bg-slate-900 border-l border-slate-800 overflow-y-auto flex flex-col">
        {/* header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-800">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-white truncate">{app.jobTitle}</h2>
            <p className="text-sm text-slate-400 mt-0.5">{app.company} · {app.location || '—'}</p>
          </div>
          <button onClick={onClose} className="ml-4 text-slate-500 hover:text-white transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6 flex-1">
          {/* meta row */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500 text-xs mb-1">Applied</p>
              <p className="text-slate-300">{new Date(app.appliedAt).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Days since</p>
              <p className="text-slate-300">{app.daysSinceApplied}d</p>
            </div>
            {app.jobUrl && (
              <div className="col-span-2">
                <p className="text-slate-500 text-xs mb-1">Job URL</p>
                <a href={app.jobUrl} target="_blank" rel="noreferrer"
                  className="text-indigo-400 hover:text-indigo-300 text-sm truncate block">
                  {app.jobUrl}
                </a>
              </div>
            )}
          </div>

          {/* status */}
          <div>
            <p className="text-slate-500 text-xs mb-2">Status</p>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition border ${
                    app.status === s
                      ? 'border-indigo-500 bg-indigo-600/20 text-indigo-300'
                      : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  {s === 'InterviewScheduled' ? 'Interview' : s}
                </button>
              ))}
            </div>
          </div>

          {/* job description */}
          {app.jobDescription && (
            <div>
              <p className="text-slate-500 text-xs mb-2">Job Description</p>
              <div className="bg-slate-800 rounded-lg p-3 max-h-48 overflow-y-auto">
                <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {app.jobDescription}
                </p>
              </div>
            </div>
          )}

          {/* notes */}
          <div>
            <p className="text-slate-500 text-xs mb-2">Notes</p>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => { setNotes(e.target.value); setNotesDirty(true); }}
              placeholder="Add notes about this application…"
              className="w-full bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none transition"
            />
            {notesDirty && (
              <button
                onClick={handleSaveNotes}
                disabled={saving}
                className="mt-2 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white px-3 py-1.5 rounded-lg transition"
              >
                {saving ? 'Saving…' : 'Save notes'}
              </button>
            )}
          </div>

          {/* Interview Prep — shown only when status is InterviewScheduled */}
          {app.status === 'InterviewScheduled' && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <p className="text-slate-500 text-xs uppercase tracking-wider">Interview Prep</p>
              </div>

              {/* saved prep — view mode */}
              {savedInterviewPrep && !interviewPrepExpanded && (
                <div className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-emerald-400">✓</span>
                    <span className="text-xs text-slate-300 font-medium">Interview prep ready</span>
                  </div>
                  <button
                    onClick={() => setInterviewPrepExpanded(true)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition"
                  >
                    View
                  </button>
                </div>
              )}

              {/* saved prep — expanded mode */}
              {savedInterviewPrep && interviewPrepExpanded && (
                <div className="mb-3">
                  <div className="max-h-96 overflow-y-auto bg-slate-800 border border-slate-700 rounded-lg p-4 mb-2">
                    <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{savedInterviewPrep}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setInterviewPrepExpanded(false)}
                      className="flex-1 text-xs border border-slate-600 text-slate-400 hover:text-white rounded-lg py-1.5 transition"
                    >
                      Collapse
                    </button>
                    <button
                      onClick={() => { navigator.clipboard.writeText(savedInterviewPrep); }}
                      className="flex-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg py-1.5 transition"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}

              {/* no saved prep — generate button */}
              {!savedInterviewPrep && (
                <div>
                  {interviewPrepError && (
                    <div className="mb-2 text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
                      {interviewPrepError}
                    </div>
                  )}
                  <button
                    onClick={async () => {
                      setInterviewPrepLoading(true);
                      setInterviewPrepError('');
                      try {
                        const { data } = await api.post<InterviewPrepResult>(`/agents/interview-prep/${app.id}`);
                        setSavedInterviewPrep(data.prep);
                        onUpdated({ ...app, interviewPrep: data.prep });
                      } catch (err: unknown) {
                        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
                        setInterviewPrepError(msg || 'Failed to generate. Please try again.');
                      } finally {
                        setInterviewPrepLoading(false);
                      }
                    }}
                    disabled={interviewPrepLoading}
                    className="flex items-center gap-2 text-xs border border-slate-700 bg-slate-800 text-slate-300 hover:border-indigo-500 hover:text-indigo-300 disabled:opacity-50 px-3 py-1.5 rounded-lg transition"
                  >
                    {interviewPrepLoading ? (
                      <>
                        <span className="w-3 h-3 border border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        Generating…
                      </>
                    ) : (
                      'Generate Interview Prep'
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* AI Agents */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <p className="text-slate-500 text-xs uppercase tracking-wider">AI Agents</p>
              <span className="text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5">
                uses more credits
              </span>
            </div>

            {/* Saved documents */}
            {(savedCoverLetter || savedTailoredResume) && (
              <div className="mb-4 space-y-2">
                {savedCoverLetter && (
                  <div className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-emerald-400">✓</span>
                      <span className="text-xs text-slate-300 font-medium">Cover Letter saved</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => downloadDocx(`cover-letter-${app.company.replace(/\s+/g, '-')}`, savedCoverLetter)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 transition"
                      >
                        Download .docx
                      </button>
                      <span className="text-slate-700">·</span>
                      <button
                        onClick={() => { setSavedCoverLetter(null); setPendingAgent('cover-letter'); }}
                        className="text-xs text-slate-500 hover:text-slate-300 transition"
                      >
                        Regenerate
                      </button>
                    </div>
                  </div>
                )}
                {savedTailoredResume && (
                  <div className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-emerald-400">✓</span>
                      <span className="text-xs text-slate-300 font-medium">Tailored Resume saved</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => downloadDocx(`tailored-resume-${app.company.replace(/\s+/g, '-')}`, savedTailoredResume)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 transition"
                      >
                        Download .docx
                      </button>
                      <span className="text-slate-700">·</span>
                      <button
                        onClick={() => { setSavedTailoredResume(null); setPendingAgent('resume-tailor'); }}
                        className="text-xs text-slate-500 hover:text-slate-300 transition"
                      >
                        Regenerate
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Credit warning confirmation */}
            {pendingAgent && !agentLoading && (
              <div className="mb-3 bg-amber-900/20 border border-amber-700/40 rounded-lg p-3">
                <p className="text-xs text-amber-300 mb-3">
                  This agent call uses more API credits than a regular chat message.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPendingAgent(null)}
                    className="flex-1 text-xs border border-slate-600 text-slate-400 hover:text-white rounded-lg py-1.5 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => runAgent(pendingAgent)}
                    className="flex-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg py-1.5 transition"
                  >
                    Run agent
                  </button>
                </div>
              </div>
            )}

            {/* Loading */}
            {agentLoading && (
              <div className="flex items-center gap-2 text-slate-400 text-xs py-3">
                <div className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                Running agent…
              </div>
            )}

            {/* Error */}
            {agentError && (
              <div className="mb-3 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2.5 text-xs text-red-400">
                {agentError}
              </div>
            )}

            {/* Agent buttons */}
            {!pendingAgent && !agentLoading && (
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'match' as AgentKey,        label: 'Analyze Match' },
                  { key: 'resume-tailor' as AgentKey, label: 'Tailor Resume' },
                  { key: 'cover-letter' as AgentKey,  label: 'Cover Letter'  },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => { setAgentResult(null); setAgentError(''); setPendingAgent(key); }}
                    className="text-xs border border-slate-700 bg-slate-800 text-slate-300 hover:border-indigo-500 hover:text-indigo-300 px-3 py-1.5 rounded-lg transition"
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Result */}
            {agentResult && (
              agentResult.type === 'match' ? (
                <AgentResultPanel
                  type="match"
                  title="Job Match Analysis"
                  result={agentResult.data}
                  onClose={() => setAgentResult(null)}
                />
              ) : (
                <AgentResultPanel
                  type="text"
                  title={agentResult.label}
                  content={agentResult.data}
                  onClose={() => setAgentResult(null)}
                />
              )
            )}
          </div>
        </div>

        {/* footer */}
        <div className="p-6 border-t border-slate-800">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="w-full text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 border border-red-900/40 rounded-lg py-2 transition disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete application'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add Modal ──────────────────────────────────────────────────────────────

function AddModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (app: Application) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<CreateApplicationRequest>({
    jobTitle: '',
    company: '',
    location: '',
    jobUrl: '',
    notes: '',
    appliedAt: today,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => { firstRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (field: keyof CreateApplicationRequest) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post<Application>('/applications', {
        ...form,
        appliedAt: form.appliedAt ? new Date(form.appliedAt).toISOString() : undefined,
      });
      onCreated(data);
      onClose();
    } catch {
      setError('Failed to create application.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <h2 className="text-base font-semibold text-white">Add Application</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-2.5 text-sm">
              {error}
            </div>
          )}

          {([
            { field: 'jobTitle', label: 'Job Title', placeholder: 'Software Engineer', required: true },
            { field: 'company',  label: 'Company',   placeholder: 'Acme Corp',          required: true },
            { field: 'location', label: 'Location',  placeholder: 'Remote / Toronto',   required: false },
            { field: 'jobUrl',   label: 'Job URL',   placeholder: 'https://…',          required: false },
          ] as const).map(({ field, label, placeholder, required }) => (
            <div key={field}>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
              <input
                ref={field === 'jobTitle' ? firstRef : undefined}
                type="text"
                required={required}
                value={(form[field] as string) ?? ''}
                onChange={set(field)}
                placeholder={placeholder}
                className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>
          ))}

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Date Applied</label>
            <input
              type="date"
              value={form.appliedAt ?? today}
              onChange={set('appliedAt')}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Job Description</label>
            <textarea
              rows={4}
              value={form.jobDescription ?? ''}
              onChange={set('jobDescription')}
              placeholder="Paste the job description here so AI agents can analyze it…"
              className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none transition"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Notes</label>
            <textarea
              rows={2}
              value={form.notes ?? ''}
              onChange={set('notes')}
              placeholder="Optional notes…"
              className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none transition"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg py-2 transition">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold rounded-lg py-2 transition">
              {loading ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function Applications() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Application | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [searchParams] = useSearchParams();

  // filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  useEffect(() => {
    api.get<Application[]>('/applications')
      .then((r) => setApps(r.data))
      .finally(() => setLoading(false));
  }, []);

  // auto-open drawer when navigated here with ?id=<appId>
  useEffect(() => {
    const id = searchParams.get('id');
    if (id && apps.length > 0) {
      const found = apps.find((a) => a.id === parseInt(id, 10));
      if (found) setSelected(found);
    }
  }, [searchParams, apps]);

  const filtered = apps.filter((a) => {
    if (filterStatus   && a.status !== filterStatus) return false;
    if (filterLocation && !a.location.toLowerCase().includes(filterLocation.toLowerCase())) return false;
    if (filterFrom     && new Date(a.appliedAt) < new Date(filterFrom)) return false;
    if (filterTo       && new Date(a.appliedAt) > new Date(filterTo + 'T23:59:59')) return false;
    return true;
  });

  const handleUpdated = (updated: Application) => {
    setApps((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    setSelected(updated);
  };

  const handleDeleted = (id: number) => {
    setApps((prev) => prev.filter((a) => a.id !== id));
    setSelected(null);
  };

  const handleCreated = (app: Application) => {
    setApps((prev) => [app, ...prev]);
  };

  return (
    <Layout>
      <div className="space-y-5">
        {/* header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Applications</h1>
            <p className="text-sm text-slate-500 mt-0.5">{apps.length} total</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Manually
          </button>
        </div>

        {/* filters */}
        <div className="flex flex-wrap gap-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s === 'InterviewScheduled' ? 'Interview' : s}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Filter by location…"
            value={filterLocation}
            onChange={(e) => setFilterLocation(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-300 placeholder-slate-500 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-44"
          />

          <input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <span className="self-center text-slate-600 text-sm">to</span>
          <input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          {(filterStatus || filterLocation || filterFrom || filterTo) && (
            <button
              onClick={() => { setFilterStatus(''); setFilterLocation(''); setFilterFrom(''); setFilterTo(''); }}
              className="text-xs text-slate-500 hover:text-white transition px-2"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-500 text-sm">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-slate-500 text-sm">
                {apps.length === 0 ? 'No applications yet. Add your first one!' : 'No results match your filters.'}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  {['Company', 'Job Title', 'Location', 'Status', 'Applied', 'Days'].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((app) => (
                  <tr
                    key={app.id}
                    onClick={() => setSelected(app)}
                    className="border-b border-slate-800/60 hover:bg-slate-800/50 cursor-pointer transition"
                  >
                    <td className="px-4 py-3 font-medium text-white">{app.company}</td>
                    <td className="px-4 py-3 text-slate-300">{app.jobTitle}</td>
                    <td className="px-4 py-3 text-slate-400">{app.location || '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={app.status} /></td>
                    <td className="px-4 py-3 text-slate-400">
                      {new Date(app.appliedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{app.daysSinceApplied}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selected && (
        <Drawer
          app={selected}
          onClose={() => setSelected(null)}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      )}

      {showAdd && (
        <AddModal
          onClose={() => setShowAdd(false)}
          onCreated={handleCreated}
        />
      )}
    </Layout>
  );
}
