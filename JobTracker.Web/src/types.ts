export interface AuthResponse {
  token: string;
  fullName: string;
  email: string;
  userId: number;
}

export interface UserProfile {
  id: number;
  email: string;
  fullName: string;
  experienceLevel: string;
  targetRoles: string;
  resumeUrl?: string;
  createdAt: string;
}

export interface Application {
  id: number;
  userId: number;
  jobTitle: string;
  company: string;
  location: string;
  jobUrl?: string;
  jobDescription?: string;
  status: string;
  notes?: string;
  appliedAt: string;
  updatedAt: string;
  isAutoGhosted: boolean;
  daysSinceApplied: number;
}

export interface CreateApplicationRequest {
  jobTitle: string;
  company: string;
  location: string;
  jobUrl?: string;
  jobDescription?: string;
  status?: string;
  notes?: string;
  appliedAt?: string;
}

export interface UpdateApplicationRequest {
  jobTitle?: string;
  company?: string;
  location?: string;
  jobUrl?: string;
  jobDescription?: string;
  status?: string;
  notes?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
}

export interface ScrapeResponse {
  jobTitle?: string;
  company?: string;
  location?: string;
  jobDescription?: string;
  url: string;
}
