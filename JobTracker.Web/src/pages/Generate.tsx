import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { downloadDocx, resumeToPreviewText } from '../lib/downloadDocx';

interface GenerateState {
  tailoredResume?: string;
  tailoredResumeDocx?: string; // base64 DOCX when design-preserve was used
  coverLetter: string;
}

function downloadBase64Docx(base64: string, filename: string) {
  const byteChars = atob(base64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.docx') ? filename : `${filename}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function Generate() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const state = location.state as GenerateState | null;

  const [activeTab, setActiveTab] = useState<'resume' | 'coverLetter'>('resume');
  const [copied, setCopied] = useState(false);
  // Default to "Keep my design" when a preserved DOCX is available
  const [useMyDesign, setUseMyDesign] = useState(!!state?.tailoredResumeDocx);

  useEffect(() => {
    if (!state?.tailoredResume && !state?.tailoredResumeDocx && !state?.coverLetter) {
      navigate('/', { replace: true });
    }
  }, [state, navigate]);

  if (!state) return null;

  const hasDocx   = !!state.tailoredResumeDocx;
  // DOCX-preserve mode: user has a preserved DOCX and has chosen "Keep my design"
  const isDocxMode = hasDocx && activeTab === 'resume' && useMyDesign;

  const rawContent = activeTab === 'resume'
    ? (state.tailoredResume ?? '')
    : state.coverLetter;
  const content = isDocxMode
    ? '✅ Your resume was tailored while preserving your original design.\n\nClick "Download .docx" to get the updated file — it keeps your original formatting, fonts, and layout. Only the profile, bullets, and skills were updated to match this role.'
    : (activeTab === 'resume' ? resumeToPreviewText(rawContent) : rawContent);

  const docxName = activeTab === 'resume' ? 'tailored-resume' : 'cover-letter';

  const handleCopy = () => {
    // In DOCX-preserve mode, copy the plain-text version extracted from the preserved file
    navigator.clipboard.writeText(isDocxMode ? content : content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* minimal header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-white font-semibold text-sm">Job Tracker</span>
        </Link>
        <div className="flex items-center gap-3">
          {user ? (
            <Link
              to="/dashboard"
              className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-1.5 rounded-lg transition"
            >
              Dashboard →
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
                Save & track free
              </Link>
            </>
          )}
        </div>
      </header>

      {/* content */}
      <main className="flex-1 flex flex-col items-center px-4 py-12">
        <div className="w-full max-w-3xl space-y-6">
          {/* heading */}
          <div className="text-center">
            <div className="inline-flex items-center gap-2 bg-emerald-600/15 border border-emerald-500/30 rounded-full px-3 py-1.5 mb-4">
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-xs font-medium text-emerald-300">Documents ready</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Your documents are ready</h1>
            <p className="text-sm text-slate-400 mt-1">Your resume text is optimized for this role — same jobs, same experience, keywords and phrasing adjusted to match the posting. Download and paste into your template.</p>
          </div>

          {/* tabs */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="flex border-b border-slate-800">
              {([
                { key: 'resume',      label: 'Tailored Resume'         },
                { key: 'coverLetter', label: 'Cover Letter'            },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => { setActiveTab(key); setCopied(false); }}
                  className={`flex-1 py-3.5 text-sm font-medium transition ${
                    activeTab === key
                      ? 'text-white border-b-2 border-indigo-500 bg-indigo-600/10'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* document content */}
            <div className="p-5">
              {/* Design toggle — only shown on resume tab when a preserved DOCX is available */}
              {activeTab === 'resume' && hasDocx && (
                <div className="flex items-center gap-1 p-1 bg-slate-800/60 border border-slate-700 rounded-lg mb-4">
                  <button
                    onClick={() => setUseMyDesign(true)}
                    className={`flex-1 text-xs font-medium py-1.5 px-3 rounded-md transition ${
                      useMyDesign ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    Keep my design
                  </button>
                  <button
                    onClick={() => setUseMyDesign(false)}
                    className={`flex-1 text-xs font-medium py-1.5 px-3 rounded-md transition ${
                      !useMyDesign ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    Use our template
                  </button>
                </div>
              )}

              <div className="bg-slate-800 rounded-xl p-5 max-h-[480px] overflow-y-auto">
                <pre className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed font-sans">
                  {content}
                </pre>
              </div>

              {/* action buttons */}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleCopy}
                  className="flex-1 flex items-center justify-center gap-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg py-2.5 transition"
                >
                  {copied ? (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy
                    </>
                  )}
                </button>
                <button
                  onClick={() =>
                    isDocxMode
                      ? downloadBase64Docx(state.tailoredResumeDocx!, docxName)
                      : downloadDocx(docxName, rawContent)
                  }
                  className="flex items-center justify-center gap-2 text-sm border border-slate-700 bg-slate-800 hover:border-slate-600 text-slate-300 hover:text-white px-5 py-2.5 rounded-lg transition"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download .docx
                </button>
              </div>
            </div>
          </div>

          {/* CTA box */}
          <div className="bg-gradient-to-br from-indigo-900/40 to-violet-900/30 border border-indigo-700/40 rounded-2xl p-6 text-center">
            {user ? (
              <>
                <h2 className="text-base font-semibold text-white mb-2">
                  Save and track this application
                </h2>
                <p className="text-sm text-slate-400 mb-5 leading-relaxed">
                  Add this job to your pipeline, run the Match Analyzer, and<br className="hidden sm:block" />
                  keep all your applications organized in one place.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link
                    to="/applications"
                    className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm px-6 py-2.5 rounded-lg transition"
                  >
                    Add to Applications
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </Link>
                  <Link
                    to="/dashboard"
                    className="inline-flex items-center justify-center text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-6 py-2.5 rounded-lg transition"
                  >
                    Go to Dashboard
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-base font-semibold text-white mb-2">
                  Save your results and track this application
                </h2>
                <p className="text-sm text-slate-400 mb-5 leading-relaxed">
                  Create a free account to save these documents, log the application,<br className="hidden sm:block" />
                  run the Job Match Analyzer, and track your entire pipeline.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link
                    to="/register"
                    className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm px-6 py-2.5 rounded-lg transition"
                  >
                    Create free account
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                  <Link
                    to="/login"
                    className="inline-flex items-center justify-center text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-6 py-2.5 rounded-lg transition"
                  >
                    Sign in
                  </Link>
                </div>
              </>
            )}
          </div>

          {/* generate again link */}
          <p className="text-center text-sm text-slate-600">
            <button
              onClick={() => navigate('/')}
              className="text-slate-500 hover:text-slate-300 transition"
            >
              ← Try with a different job posting
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}
