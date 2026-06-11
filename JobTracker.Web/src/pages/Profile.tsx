import { useEffect, useRef, useState } from 'react';
import Layout from '../components/Layout';
import api from '../lib/api';
import type { UserProfile } from '../types';

const EXPERIENCE_LEVELS = ['Junior', 'Mid', 'Senior'];

export default function Profile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({ fullName: '', experienceLevel: '', targetRoles: '' });
  const [formDirty, setFormDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const [resumeUploading, setResumeUploading] = useState(false);
  const [resumeMsg, setResumeMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get<UserProfile>('/profile')
      .then((r) => {
        setProfile(r.data);
        setForm({
          fullName:       r.data.fullName,
          experienceLevel: r.data.experienceLevel,
          targetRoles:    r.data.targetRoles,
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const set = (field: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [field]: e.target.value }));
      setFormDirty(true);
      setSaveMsg('');
    };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMsg('');
    try {
      const { data } = await api.put<UserProfile>('/profile', form);
      setProfile(data);
      setFormDirty(false);
      setSaveMsg('Saved!');
      setTimeout(() => setSaveMsg(''), 2500);
    } catch {
      setSaveMsg('Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setResumeMsg('File too large (max 5 MB).');
      return;
    }

    setResumeUploading(true);
    setResumeMsg('');

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        await api.post('/profile/resume', { resumeBase64: base64 });
        setProfile((p) => p ? { ...p, resumeUrl: base64 } : p);
        setResumeMsg('Resume uploaded successfully.');
      } catch {
        setResumeMsg('Upload failed. Please try again.');
      } finally {
        setResumeUploading(false);
        if (fileRef.current) fileRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-2xl space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-6 animate-pulse">
              <div className="h-3 bg-slate-800 rounded w-24 mb-4" />
              <div className="h-9 bg-slate-800 rounded" />
            </div>
          ))}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-xl font-bold text-white">Profile</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage your account and preferences</p>
        </div>

        {/* account info card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-white mb-5">Account</h2>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-500">Email</span>
              <span className="text-slate-300">{profile?.email}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-500">Member since</span>
              <span className="text-slate-300">
                {profile ? new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* edit profile form */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-white mb-5">Profile Settings</h2>
          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Full Name</label>
              <input
                type="text"
                required
                value={form.fullName}
                onChange={set('fullName')}
                className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Experience Level</label>
              <select
                value={form.experienceLevel}
                onChange={set('experienceLevel')}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              >
                {EXPERIENCE_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>{lvl}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Target Roles
                <span className="text-slate-600 font-normal ml-1">— comma separated</span>
              </label>
              <input
                type="text"
                value={form.targetRoles}
                onChange={set('targetRoles')}
                placeholder="Software Developer, Fullstack Engineer"
                className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={saving || !formDirty}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2 rounded-lg transition"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              {saveMsg && (
                <span className={`text-sm ${saveMsg === 'Saved!' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {saveMsg}
                </span>
              )}
            </div>
          </form>
        </div>

        {/* resume upload */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-white mb-1">Resume</h2>
          <p className="text-xs text-slate-500 mb-5">PDF or DOCX, max 5 MB. Stored securely for AI context.</p>

          {profile?.resumeUrl && (
            <div className="flex items-center gap-3 bg-slate-800 rounded-lg px-4 py-3 mb-4">
              <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-slate-300 flex-1">Resume uploaded</span>
              <a
                href={profile.resumeUrl}
                download="resume"
                className="text-xs text-indigo-400 hover:text-indigo-300 transition"
              >
                Download
              </a>
            </div>
          )}

          <div className="flex items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleFileChange}
              className="hidden"
              id="resume-upload"
            />
            <label
              htmlFor="resume-upload"
              className="cursor-pointer flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-300 text-sm px-4 py-2 rounded-lg transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              {resumeUploading ? 'Uploading…' : profile?.resumeUrl ? 'Replace Resume' : 'Upload Resume'}
            </label>
            {resumeMsg && (
              <span className={`text-xs ${resumeMsg.includes('success') ? 'text-emerald-400' : 'text-red-400'}`}>
                {resumeMsg}
              </span>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
