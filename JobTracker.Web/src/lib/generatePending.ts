import type { AxiosInstance } from 'axios';
import type { NavigateFunction } from 'react-router-dom';
import type { ResumeTailorResult, TailorPreserveResponse } from '../types';

// Returns false  — no pending job
//         true   — generation succeeded and navigated to results
//         'limit' — user hit the 5-credit free tier limit
export async function runPendingGenerate(
  api: AxiosInstance,
  navigate: NavigateFunction
): Promise<boolean | 'limit'> {
  const pendingJob = localStorage.getItem('pendingJob');
  if (!pendingJob) return false;

  const { data: profile } = await api.get<{ resumeUrl?: string }>('/profile');

  if (!profile.resumeUrl) {
    navigate('/profile?resumeRequired=1');
    return false;
  }

  const payload = { jobDescription: pendingJob };

  const [preserveRes, tailorRes, coverRes] = await Promise.all([
    api.post<TailorPreserveResponse>('/agents/anonymous/tailor-preserve', payload, { validateStatus: () => true }),
    api.post<ResumeTailorResult>('/agents/anonymous/tailor', payload, { validateStatus: () => true }),
    api.post<{ coverLetter: string }>('/agents/anonymous/cover-letter', payload, { validateStatus: () => true }),
  ]);

  if (preserveRes.status === 403 || tailorRes.status === 403 || coverRes.status === 403) {
    localStorage.removeItem('pendingJob');
    sessionStorage.removeItem('generateResults');
    return 'limit';
  }

  localStorage.removeItem('pendingJob');

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
  return true;
}
