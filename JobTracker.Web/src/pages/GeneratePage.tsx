import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import AiLimitModal from '../components/AiLimitModal';
import api from '../lib/api';
import type { ResumeTailorResult, TailorPreserveResponse } from '../types';

const AGENTS = [
  {
    label: 'Analyze Match',
    description: 'Score how well your resume matches the job and surface skill gaps.',
  },
  {
    label: 'Tailor Resume',
    description: 'Rewrite your bullets to highlight what matters most for the role.',
  },
  {
    label: 'Cover Letter',
    description: 'Write a personalized cover letter matched to the job and your background.',
  },
  {
    label: 'Interview Prep',
    description: 'Get targeted questions and talking points before your interview.',
  },
  {
    label: 'Follow-up Email',
    description: 'Draft a professional follow-up after applying or interviewing.',
  },
  {
    label: 'Job Strategy',
    description: 'Analyze your overall job search and get strategic next-step advice.',
  },
];

export default function GeneratePage() {
  const navigate = useNavigate();
  const [jobDescription, setJobDescription] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLimitModal, setShowLimitModal] = useState(false);

  const handleGenerate = async () => {
    if (!jobDescription.trim()) {
      setError('Please paste a job description first.');
      return;
    }
    setError(null);
    setGenerating(true);

    try {
      const { data: profile } = await api.get<{ resumeUrl?: string }>('/profile');
      if (!profile.resumeUrl) {
        navigate('/profile?resumeRequired=1');
        return;
      }

      const payload = { jobDescription: jobDescription.trim() };

      const [preserveRes, tailorRes, coverRes] = await Promise.all([
        api.post<TailorPreserveResponse>('/agents/anonymous/tailor-preserve', payload, { validateStatus: () => true }),
        api.post<ResumeTailorResult>('/agents/anonymous/tailor', payload, { validateStatus: () => true }),
        api.post<{ coverLetter: string }>('/agents/anonymous/cover-letter', payload, { validateStatus: () => true }),
      ]);

      if (preserveRes.status === 403 || tailorRes.status === 403 || coverRes.status === 403) {
        sessionStorage.removeItem('generateResults');
        setShowLimitModal(true);
        setGenerating(false);
        return;
      }

      try {
        sessionStorage.setItem('generateResults', JSON.stringify({
          tailoredResumeDocx:  preserveRes.status === 200 ? preserveRes.data?.tailoredResumeDocx : undefined,
          tailoredResume:      tailorRes.status === 200 ? tailorRes.data.tailoredResume : undefined,
          coverLetter:         coverRes.status === 200 ? coverRes.data.coverLetter : '',
          originalMatchScore:  tailorRes.status === 200 ? tailorRes.data.originalMatchScore : undefined,
          tailoredMatchScore:  tailorRes.status === 200 ? tailorRes.data.tailoredMatchScore : undefined,
          originalResumeText:  tailorRes.status === 200 ? tailorRes.data.originalResumeText : undefined,
          tailoredDocxText:    preserveRes.status === 200 ? preserveRes.data?.tailoredDocxText : undefined,
        }));
      } catch { /* sessionStorage unavailable */ }

      navigate('/generate/results');
    } catch {
      setError('Something went wrong. Please try again.');
      setGenerating(false);
    }
  };

  return (
    <Layout>
      {showLimitModal && <AiLimitModal onClose={() => setShowLimitModal(false)} />}
      <div className="max-w-2xl mx-auto space-y-10">

        {/* ── Generate form ── */}
        <div>
          <h1 className="text-xl font-bold text-white mb-1">Generate documents</h1>
          <p className="text-sm text-slate-500 mb-6">
            Paste a job posting and get a tailored resume + cover letter in seconds.
          </p>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">
                Job Description <span className="text-red-400">*</span>
              </label>
              <textarea
                rows={8}
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the full job description here…"
                className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none transition leading-relaxed"
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating || !jobDescription.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 text-sm transition flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating your documents…
                </>
              ) : (
                <>
                  Generate documents
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── Per-application AI agents ── */}
        <div>
          <h2 className="text-base font-semibold text-white mb-1">Per-application AI agents</h2>
          <p className="text-sm text-slate-500 mb-4">
            These agents run against a specific application you're tracking — open any application in the{' '}
            <Link to="/applications" className="text-indigo-400 hover:text-indigo-300 transition">
              Applications
            </Link>{' '}
            page to use them.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
            {AGENTS.map(({ label, description }) => (
              <div
                key={label}
                className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3.5"
              >
                <p className="text-sm font-medium text-slate-200 mb-0.5">{label}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>

          <Link
            to="/applications"
            className="inline-flex items-center gap-2 text-sm bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white font-medium px-4 py-2.5 rounded-xl transition"
          >
            Go to Applications
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>

      </div>
    </Layout>
  );
}
