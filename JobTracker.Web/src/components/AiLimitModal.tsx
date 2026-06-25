const STRIPE_URL = 'https://buy.stripe.com/test_dRmfZjb4C2Ih6AV7Bi1oI00';

export default function AiLimitModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>

        <h3 className="text-white font-semibold text-lg mb-2">
          You've used your 5 free AI credits
        </h3>
        <p className="text-slate-400 text-sm mb-6 leading-relaxed">
          Subscribe to Job Tracker Pro for $2.99/month and get unlimited AI credits —
          tailored resumes, cover letters, interview prep and more.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 text-sm border border-slate-700 text-slate-400 hover:text-white rounded-xl py-2.5 transition"
          >
            Maybe later
          </button>
          <a
            href={STRIPE_URL}
            target="_blank"
            rel="noreferrer"
            className="flex-1 text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl py-2.5 transition flex items-center justify-center"
          >
            Subscribe Now
          </a>
        </div>
      </div>
    </div>
  );
}
