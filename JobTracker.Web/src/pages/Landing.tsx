import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { runPendingGenerate } from '../lib/generatePending';
import AiLimitModal from '../components/AiLimitModal';
import TrialLimitModal from '../components/TrialLimitModal';
import type { ResumeTailorResult, TailorPreserveResponse } from '../types';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [jobDescription, setJobDescription] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showTrialLimitModal, setShowTrialLimitModal] = useState(false);

  if (loading) return null;

  const handleGenerate = async () => {
    if (!jobDescription.trim()) {
      setError('Please paste a job description first.');
      return;
    }
    setError(null);

    // ── Anonymous path ────────────────────────────────────────────────────────
    if (!user) {
      if (!resumeFile) {
        setError('Please upload your resume to generate documents.');
        return;
      }
      setGenerating(true);
      try {
        const resumeBase64 = await readFileAsDataUrl(resumeFile);
        const payload = { jobDescription: jobDescription.trim(), resumeBase64 };

        const [preserveRes, tailorRes, coverRes] = await Promise.all([
          api.post<TailorPreserveResponse>('/agents/anonymous/tailor-preserve', payload, { validateStatus: () => true }),
          api.post<ResumeTailorResult>('/agents/anonymous/tailor', payload, { validateStatus: () => true }),
          api.post<{ coverLetter: string }>('/agents/anonymous/cover-letter', payload, { validateStatus: () => true }),
        ]);

        if (preserveRes.status === 429 || tailorRes.status === 429 || coverRes.status === 429) {
          sessionStorage.removeItem('generateResults');
          setShowTrialLimitModal(true);
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
      return;
    }

    // ── Authenticated path ────────────────────────────────────────────────────
    setGenerating(true);
    localStorage.setItem('pendingJob', jobDescription.trim());
    try {
      const result = await runPendingGenerate(api, navigate);
      if (result === 'limit') {
        setShowLimitModal(true);
        setGenerating(false);
      }
    } catch {
      localStorage.removeItem('pendingJob');
      setError('Something went wrong. Please try again.');
      setGenerating(false);
    }
  };

  const canGenerate = !!jobDescription.trim() && (!!user || !!resumeFile);

  return (
    <>
      {showLimitModal      && <AiLimitModal      onClose={() => setShowLimitModal(false)}      />}
      {showTrialLimitModal && <TrialLimitModal    onClose={() => setShowTrialLimitModal(false)} />}
      <div className="min-h-screen bg-slate-950 flex flex-col">
        {/* minimal header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-white font-semibold text-sm">Job Tracker</span>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <Link
                to="/dashboard"
                className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-1.5 rounded-lg transition"
              >
                Go to Dashboard →
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-sm text-slate-400 hover:text-white transition">
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-1.5 rounded-lg transition"
                >
                  Get started free
                </Link>
              </>
            )}
          </div>
        </header>

        {/* hero */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
          <div className="w-full max-w-2xl">
            {/* headline */}
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 bg-indigo-600/15 border border-indigo-500/30 rounded-full px-3 py-1.5 mb-6">
                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
                <span className="text-xs font-medium text-indigo-300">Powered by Claude AI</span>
              </div>
              <h1 className="text-4xl font-extrabold text-white leading-tight mb-4">
                Get a tailored resume +<br />cover letter in 30 seconds
              </h1>
              <p className="text-slate-400 text-base leading-relaxed">
                Paste any job posting and AI writes everything —<br className="hidden sm:block" />
                perfectly matched to your resume and experience.
              </p>
            </div>

            {/* form card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm">
                  {error}
                </div>
              )}

              {/* Resume upload — only needed when not signed in */}
              {!user && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2">
                    Your Resume <span className="text-red-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center gap-3 bg-slate-800 border border-dashed border-slate-600 hover:border-indigo-500 rounded-xl px-4 py-3 transition text-left"
                  >
                    <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <span className={`text-sm truncate ${resumeFile ? 'text-white' : 'text-slate-500'}`}>
                      {resumeFile ? resumeFile.name : 'Upload your resume (.docx or .pdf)'}
                    </span>
                    {resumeFile && (
                      <span className="ml-auto text-xs text-emerald-400 shrink-0">✓ Ready</span>
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".doc,.docx,.pdf"
                    className="hidden"
                    onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
                  />
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
                disabled={generating || !canGenerate}
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

              {!user && (
                <p className="text-center text-xs text-slate-600">
                  First generation is free — no account needed.{' '}
                  <Link to="/register" className="text-indigo-400 hover:text-indigo-300 transition">
                    Sign up for more →
                  </Link>
                </p>
              )}
            </div>

            {!user && (
              <p className="text-center text-sm text-slate-600 mt-5">
                Already have an account?{' '}
                <Link to="/login" className="text-indigo-400 hover:text-indigo-300 transition">
                  Sign in →
                </Link>
              </p>
            )}
          </div>
        </main>

        {/* footer bar */}
        <footer className="border-t border-slate-800/60 px-6 py-4 flex items-center justify-between">
          <p className="text-xs text-slate-600">
            Track every application, never lose a lead.
          </p>
          <a
            href="https://chrome.google.com/webstore"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Or use our Chrome Extension on LinkedIn &amp; Indeed
          </a>
        </footer>
      </div>
    </>
  );
}
