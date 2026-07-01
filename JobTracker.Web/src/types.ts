// Issue 6: paginated response wrapper returned by GET /api/applications
export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

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
  coverLetter?: string;
  tailoredResume?: string;
  interviewPrep?: string;
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

export interface JobMatchResult {
  score: number;
  matchingSkills: string[];
  missingSkills: string[];
  emphasis: string;
}

export interface ResumeTailorResult {
  tailoredResume: string;
  originalMatchScore?: number;
  tailoredMatchScore?: number;
  originalResumeText?: string;
}

export interface TailorPreserveResponse {
  tailoredResumeDocx: string;
  originalMatchScore?: number;
  tailoredMatchScore?: number;
  tailoredDocxText?: string;
}

export interface CoverLetterResult {
  coverLetter: string;
}

export interface StrategyResult {
  report: string;
}

export interface EmailInterpretResult {
  suggestedStatus: string;
  explanation: string;
  summary: string;
}

export interface InterviewPrepResult {
  prep: string;
}

export interface FollowUpResult {
  email: string;
}
