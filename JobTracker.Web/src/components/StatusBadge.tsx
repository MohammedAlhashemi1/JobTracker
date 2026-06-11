const STYLES: Record<string, string> = {
  Applied:            'bg-slate-700 text-slate-300',
  Responded:          'bg-amber-900/50 text-amber-300',
  InterviewScheduled: 'bg-violet-900/50 text-violet-300',
  Offer:              'bg-emerald-900/50 text-emerald-300',
  Rejected:           'bg-red-900/40 text-red-300',
  Ghosted:            'bg-stone-800 text-stone-400',
};

const LABELS: Record<string, string> = {
  InterviewScheduled: 'Interview',
};

export default function StatusBadge({ status }: { status: string }) {
  const cls = STYLES[status] ?? 'bg-slate-700 text-slate-300';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${cls}`}>
      {LABELS[status] ?? status}
    </span>
  );
}
