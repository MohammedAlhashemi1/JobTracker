import type { AxiosInstance } from 'axios';
import type { NavigateFunction } from 'react-router-dom';

export async function runPendingGenerate(
  api: AxiosInstance,
  navigate: NavigateFunction
): Promise<boolean> {
  const pendingJob = localStorage.getItem('pendingJob');
  if (!pendingJob) return false;

  const { data: profile } = await api.get<{ resumeUrl?: string }>('/profile');

  if (!profile.resumeUrl) {
    navigate('/profile?resumeRequired=1');
    return false;
  }

  const payload = { jobDescription: pendingJob, resumeBase64: profile.resumeUrl };

  const [tailorRes, coverRes] = await Promise.all([
    api.post<{ tailoredBullets: string }>('/agents/anonymous/tailor', payload),
    api.post<{ coverLetter: string }>('/agents/anonymous/cover-letter', payload),
  ]);

  localStorage.removeItem('pendingJob');
  navigate('/generate', {
    state: {
      tailoredResume: tailorRes.data.tailoredBullets,
      coverLetter:    coverRes.data.coverLetter,
    },
  });
  return true;
}
