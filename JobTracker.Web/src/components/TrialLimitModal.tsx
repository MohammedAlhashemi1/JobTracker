import { Link } from 'react-router-dom';

export default function TrialLimitModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        </div>

        <h3 className="text-white font-semibold text-lg mb-2">
          You've used your free trial
        </h3>
        <p className="text-slate-400 text-sm mb-6 leading-relaxed">
          Create a free account and get 5 more AI generations — tailored resumes,
          cover letters, match scores, and more.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 text-sm border border-slate-700 text-slate-400 hover:text-white rounded-xl py-2.5 transition"
          >
            Maybe later
          </button>
          <Link
            to="/register"
            className="flex-1 text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl py-2.5 transition flex items-center justify-center"
          >
            Create free account
          </Link>
        </div>
      </div>
    </div>
  );
}
